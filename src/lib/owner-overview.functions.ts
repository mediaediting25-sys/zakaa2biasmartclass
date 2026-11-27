import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireLiveAccount } from "@/lib/live-account-middleware";
import { buildOverview, buildTeacherDetail } from "./owner-overview";

type Db = import("@supabase/supabase-js").SupabaseClient;
type Query = { in: (column: string, values: string[]) => Query } & Record<string, unknown>;

/** Reads every row in pages, because one request returns at most 1000 rows. */
async function readAll<T>(db: Db, table: string, columns: string, orderBy = "id", filter?: (q: Query) => Query): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = db.from(table).select(columns) as unknown as Query;
    if (filter) query = filter(query);
    const { data, error } = await (query as unknown as { order: (c: string, o: { ascending: boolean }) => { range: (a: number, b: number) => Promise<{ data: unknown[] | null; error: unknown }> } })
      .order(orderBy, { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error("Unable to load overview");
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Same read split into chunks, because a long list of ids does not fit in one request. */
async function readIn<T>(db: Db, table: string, columns: string, column: string, ids: string[], orderBy = "id"): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    out.push(...(await readAll<T>(db, table, columns, orderBy, (q) => q.in(column, part))));
  }
  return out;
}

/** Owner or general administrator only, fail closed: any error or a non-true answer means no data. */
async function assertOwnerOrGeneralAdmin(context: { supabase: { rpc: (name: "has_admin_permission", args: { _permission: string }) => PromiseLike<{ data: unknown; error: unknown }> } }) {
  const { data, error } = await context.supabase.rpc("has_admin_permission", { _permission: "general_admin" });
  if (error || data !== true) throw new Error("Forbidden");
}

export const getOwnerOverview = createServerFn({ method: "GET" })
  .middleware([requireLiveAccount])
  .handler(async ({ context }) => {
    await assertOwnerOrGeneralAdmin(context);

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

export const getTeacherDetail = createServerFn({ method: "POST" })
  .middleware([requireLiveAccount])
  .inputValidator((input: unknown) => z.object({ teacherId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnerOrGeneralAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as Db;
    const teacherId = data.teacherId;
    const [role, profile] = await Promise.all([
      readIn<{ user_id: string; role: string }>(db, "user_roles", "id, user_id, role", "user_id", [teacherId]),
      readIn<{ id: string; full_name: string | null; email: string | null; created_at: string | null }>(db, "profiles", "id, full_name, email, created_at", "id", [teacherId]),
    ]);
    if (!role.some((r) => r.role === "teacher") || !profile[0]) throw new Error("Not found");

    const courses = await readIn<{ id: string; title: string; subject: string | null; grade_level: string | null; status: string }>(db, "courses", "id, title, subject, grade_level, status", "teacher_id", [teacherId]);
    const courseIds = courses.map((c) => c.id);
    const [enrollments, activities, attempts, periods, owners] = await Promise.all([
      readIn<{ course_id: string; student_id: string; created_at: string }>(db, "enrollments", "id, course_id, student_id, created_at", "course_id", courseIds),
      readIn<{ id: string; course_id: string; status: string }>(db, "activities", "id, course_id, status", "course_id", courseIds),
      readIn<{ id: string; course_id: string; student_id: string; activity_id: string; score: number | null; max_score: number | null; submitted_at: string | null }>(db, "attempts", "id, course_id, student_id, activity_id, score, max_score, submitted_at", "course_id", courseIds),
      readIn<{ teacher_id: string; starts_at: string; ends_at: string; plan_id: string }>(db, "teacher_access_periods", "id, teacher_id, starts_at, ends_at, plan_id", "teacher_id", [teacherId]),
      readAll<{ user_id: string }>(db, "platform_owners", "user_id", "user_id"),
    ]);
    const studentIds = [...new Set(enrollments.map((e) => e.student_id))];
    const studentProfiles = await readIn<{ id: string; full_name: string | null; email: string | null }>(db, "profiles", "id, full_name, email", "id", studentIds);
    const known = new Set(studentProfiles.map((p) => p.id));
    const missing = studentIds.filter((id) => !known.has(id));
    const departedRows = await readIn<{ user_id: string; full_name: string | null; email: string | null }>(db, "departed_accounts", "user_id, full_name, email", "user_id", missing, "user_id");

    return buildTeacherDetail({
      teacher: profile[0],
      courses,
      enrollments,
      // Only published activities count as "total", and only submitted attempts count, as on the teacher's own dashboard.
      activities: activities.filter((a) => a.status === "published"),
      attempts: attempts.filter((a) => a.submitted_at),
      studentProfiles,
      departed: departedRows.map((d) => ({ id: d.user_id, full_name: d.full_name, email: d.email })),
      periods,
      owners: owners.map((o) => o.user_id),
    });
  });
