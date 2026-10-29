import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Home, Languages, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useProfile, useSession } from "@/hooks/useSession";
import { NotificationBell } from "@/components/NotificationBell";
import { BackButton } from "@/components/BackButton";
import { InstallButton } from "@/components/InstallButton";

type NavItem = { to: string; label: string };

export function AppShell({
  title,
  subtitle,
  nav = [],
  actions,
  homeTo,
  children,
}: {
  title: string;
  subtitle?: string;
  nav?: NavItem[];
  actions?: ReactNode;
  homeTo?: string;
  children: ReactNode;
}) {
  const { t, tr, toggleLocale } = useI18n();
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="app-header border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            {t("app.name")}
          </Link>
          <div className="flex items-center gap-1">
            <BackButton className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            <InstallButton className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            {homeTo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: homeTo })}
                aria-label={tr("الرئيسية")}
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Home className="size-4" />
                <span className="hidden sm:inline">{tr("الرئيسية")}</span>
              </Button>
            )}
            <span className="me-2 hidden text-sm opacity-80 sm:inline">
              {profile?.full_name ?? profile?.email}
            </span>
            {user && <NotificationBell userId={user.id} />}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLocale}
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Languages className="size-4" />
              {t("nav.language")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              aria-label={t("nav.signOut")}
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        {nav.length > 0 && (
          <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium opacity-90 transition-colors hover:bg-sidebar-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
