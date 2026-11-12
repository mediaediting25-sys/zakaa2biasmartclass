import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManageBlock } from "@/lib/admin";

export const setAccountBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), blocked: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: isOwner, error: ownerError }, { data: allowed, error: permissionError }] = await Promise.all([
      context.supabase.rpc("is_platform_owner"),
      context.supabase.rpc("has_admin_permission", { _permission: "users" }),
    ]);
    if (ownerError || permissionError || !allowed) throw new Error("Forbidden");

    const { data: accounts, error: listError } = await context.supabase.rpc("admin_list_accounts");
    if (listError) throw new Error("Forbidden");
    const target = (accounts ?? []).find((account) => account.user_id === data.userId);
    if (!target || !canManageBlock(isOwner === true, context.userId, target)) throw new Error("Forbidden");

    const { error: recordError } = await context.supabase.rpc("admin_set_blocked", {
      _user_id: data.userId,
      _blocked: data.blocked,
    });
    if (recordError) throw new Error("Unable to change account access");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.blocked ? "876000h" : "none",
    });
    if (authError) {
      await context.supabase.rpc("admin_set_blocked", { _user_id: data.userId, _blocked: target.is_blocked });
      throw new Error("Unable to change account access");
    }

    if (data.blocked) await supabaseAdmin.auth.admin.signOut(data.userId, "global");
    return { blocked: data.blocked };
  });
