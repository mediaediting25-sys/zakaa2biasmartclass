import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Languages, LogOut } from "lucide-react";

import { NotificationBell } from "@/components/NotificationBell";
import { BackButton } from "@/components/BackButton";
import { InstallButton } from "@/components/InstallButton";
import { useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { homeForRole, useProfile, useRole, useSession } from "@/hooks/useSession";
import { useI18n } from "@/lib/i18n";

export function SiteHeader() {
  const { t, tr, toggleLocale } = useI18n();
  const { user, loading } = useSession();
  const { data: role } = useRole(user);
  const { data: profile } = useProfile(user);
  const roleLabel: Record<string, string> = { teacher: tr("معلم"), student: tr("طالب"), parent: tr("ولي أمر"), admin: tr("مدير") };
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-sidebar backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span>{t("app.name")}</span>
        </Link>

        <div className="flex items-center gap-2">
          {pathname !== "/" && <BackButton />}
          <InstallButton />
          <Button asChild variant="ghost" size="sm">
            <Link to="/teachers">{tr("المدرسون")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/pricing">{tr("الباقات والأسعار")}</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleLocale}>
            <Languages className="size-4" />
            {t("nav.language")}
          </Button>

          {!loading && user ? (
            <>
              <NotificationBell userId={user.id} />
              <span className="hidden text-sm sm:inline">
                <span className="font-medium">{profile?.full_name || user.email}</span>
                {role && <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{roleLabel[role]}</span>}
              </span>
              <Button asChild size="sm">
                <Link to={homeForRole(role)}>{t("nav.dashboard")}</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} aria-label={t("nav.signOut")}>
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            !loading && (
              <Button asChild size="sm">
                <Link to="/auth">{t("nav.signIn")}</Link>
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
