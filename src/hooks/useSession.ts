import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "teacher" | "student" | "parent";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useRole(user: User | null) {
  return useQuery({
    queryKey: ["my-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return "student" as AppRole;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      const priority: AppRole[] = ["admin", "teacher", "parent", "student"];
      return priority.find((r) => roles.includes(r)) ?? ("student" as AppRole);
    },
  });
}

export function useProfile(user: User | null) {
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, ui_locale, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function homeForRole(role: AppRole | undefined) {
  switch (role) {
    case "admin":
      return "/admin" as const;
    case "teacher":
      return "/teacher" as const;
    case "parent":
      return "/parent" as const;
    default:
      return "/student" as const;
  }
}
