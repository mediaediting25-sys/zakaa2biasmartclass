import { createMiddleware } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * requireSupabaseAuth only checks the token's signature, so the token of a deleted or blocked account keeps
 * working until it expires. This runs after it and asks the auth system and the block list, so service-role
 * functions cannot be used with such a token. Fails closed.
 */
export const requireLiveAccount = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertAccountLive } = await import("@/server/account-deletion.server");
    await assertAccountLive(supabaseAdmin as never, context.userId);
    return next();
  });
