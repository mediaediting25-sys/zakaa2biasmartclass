import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { homeForRole, type AppRole } from "@/hooks/useSession";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zakaa2biasmartclass.lovable.app/auth" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "تسجيل الدخول — سمارت كلاس | Sign in to SmartClass" },
      {
        name: "description",
        content: "سجّل الدخول أو أنشئ حسابًا كمعلم أو طالب أو ولي أمر لمتابعة المنهج والتقدم.",
      },
      { property: "og:title", content: "تسجيل الدخول — سمارت كلاس" },
      {
        property: "og:description",
        content: "حساب واحد للمعلم والطالب وولي الأمر داخل سمارت كلاس.",
      },
    ],
    links: [{ rel: "canonical", href: "https://zakaa2biasmartclass.lovable.app/auth" }],
  }),
  component: AuthPage,
});

const ROLES: AppRole[] = ["teacher", "student", "parent"];

async function resolveRoleAndGo(userId: string, go: (path: string) => void) {
  const { data: choice } = await supabase.from("role_choices").select("user_id").eq("user_id", userId).maybeSingle();
  if (!choice) return go("/onboarding");
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  const priority: AppRole[] = ["admin", "teacher", "parent", "student"];
  go(homeForRole(priority.find((r) => roles.includes(r)) ?? "student"));
}

function AuthPage() {
  const { t, locale, toggleLocale, message } = useI18n();
  const ar = locale === "ar";
  const navigate = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("teacher");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void resolveRoleAndGo(data.session.user.id, (path) =>
          navigate({ to: path, replace: true }),
        );
      }
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, role, ui_locale: locale },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        await resolveRoleAndGo(data.session.user.id, (path) =>
          navigate({ to: path, replace: true }),
        );
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await resolveRoleAndGo(data.user.id, (path) => navigate({ to: path, replace: true }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? message(err.message) : ar ? "تعذّر إكمال العملية" : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      setBusy(false);
      toast.error(ar ? "تعذّر الدخول بحساب Google" : "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await resolveRoleAndGo(data.user.id, (path) => navigate({ to: path, replace: true }));
    }
    setBusy(false);
  }

  return (
    <div className="relative grid min-h-screen place-items-center gradient-hero px-4 py-10">
      <BackButton className="absolute top-4 start-4" />
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            {t("app.name")}
          </Link>
          <Button variant="ghost" size="sm" onClick={toggleLocale}>
            {t("nav.language")}
          </Button>
        </div>

        <div className="surface p-7">
          <h1 className="font-display text-2xl font-bold">
            {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("app.tagline")}</p>

          {sent ? (
            <p className="mt-6 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
              {t("auth.checkEmail")}
            </p>
          ) : (
            <>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("auth.role")}</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {ROLES.map((r) => (
                          <Button
                            key={r}
                            type="button"
                            variant={role === r ? "default" : "outline"}
                            onClick={() => setRole(r)}
                          >
                            {t(`role.${r}` as const)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onGoogle}
                disabled={busy}
              >
                {t("auth.google")}
              </Button>

              <button
                type="button"
                className="mt-5 w-full text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? t("auth.toSignUp") : t("auth.toSignIn")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
