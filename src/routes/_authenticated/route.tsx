import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: blocked, error: blockError } = await supabase.rpc("is_account_blocked");
    if (blockError) throw blockError;
    if (blocked) throw redirect({ to: "/blocked" });
    if (location.pathname !== "/onboarding") {
      const { data: choice } = await supabase
        .from("role_choices")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!choice) throw redirect({ to: "/onboarding" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
