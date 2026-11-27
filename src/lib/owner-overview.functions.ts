import { createServerFn } from "@tanstack/react-start";

import { requireLiveAccount } from "@/lib/live-account-middleware";
import { buildOverview } from "./owner-overview";

type Db = import("@supabase/supabase-js").SupabaseClient;

/** Reads every row in pages, because one request returns at most 1000 rows. */
async function readAll<T>(db: Db, table: string, columns: string, orderBy = "id"): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order(orderBy, { ascending: true }).range(from, from + 999);
    if (error) throw new Error("Unable to load overview");
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export const getOwnerOverview = createServerFn({ method: "GET" })
  .middleware([requireLiveAccount])
  .handler(async ({ context }) => {
    // Owner only, fail closed: any error or a non-true answer means no data.
    const { data: isOwner, error } = await context.supabase.rpc("is_platform_owner");
    if (error || isOwner !== true) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as Db;
    const [roles, profiles, courses, enrollments, periods, owners] = await Promise.all([
      readAll<{ user_id: string; role: string }>(db, "user_roles", "id, user_id, role"),
      readAll<{ id: string; full_name: string | null; email: string | null; created_at: string | null }>(db, "profiles", "id, full_name, email, created_at"),
      readAll<{ id: string; teacher_id: string; status: string }>(db, "courses", "id, teacher_id, status"),
      readAll<{ course_id: string; student_id: string }>(db, "enrollments", "id, course_id, student_id"),
      readAll<{ teacher_id: string; starts_at: string; ends_at: string; plan_id: string }>(db, "teacher_access_periods", "id, teacher_id, starts_at, ends_at, plan_id"),
      readAll<{ user_id: string }>(db, "platform_owners", "user_id", "user_id"),
    ]);
    return buildOverview({ roles, profiles, courses, enrollments, periods, owners: owners.map((o) => o.user_id) });
  });
