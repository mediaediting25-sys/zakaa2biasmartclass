import { useI18n } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { homeForRole, type AppRole } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { property: "og:title", content: "اختر نوع حسابك — ذكاؤبيا سمارت كلاس" },
      { property: "og:description", content: "حدّد نوع حسابك لإكمال إنشاء حساب ذكاؤبيا سمارت كلاس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "اختر نوع حسابك — ذكاؤبيا سمارت كلاس" },
      { name: "description", content: "حدّد إن كنت معلماً أو طالباً أو ولي أمر لإكمال إنشاء حسابك." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { tr, locale, message } = useI18n();
const OPTIONS: { role: AppRole; label: string; hint: string }[] = [
  { role: "teacher", label: tr("معلم"), hint: tr("أنشئ المقررات وارفع الكتب وتابع طلابك") },
  { role: "student", label: tr("طالب"), hint: tr("انضم للمقررات وحل الأنشطة") },
  { role: "parent", label: tr("ولي أمر"), hint: tr("تابع تقدم أبنائك ونتائجهم") },
];


  const [role, setRole] = useState<AppRole | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function confirm() {
    if (!role) return;
    setBusy(true);
    const { error } = await supabase.rpc("choose_my_role", { _role: role });
    setBusy(false);
    if (error && !error.message.includes("already")) {
      toast.error(tr("تعذّر حفظ نوع الحساب"));
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-role"] });
    navigate({ to: homeForRole(role), replace: true });
  }

  return (
    <AppShell title={tr("مرحباً بك! اختر نوع حسابك")}>
      <p className="mb-5 text-muted-foreground">{tr("لا يمكن تغيير نوع الحساب لاحقاً، فاختر بعناية.")}</p>
      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map((o) => (
          <Card
            key={o.role}
            role="button"
            onClick={() => setRole(o.role)}
            className={`cursor-pointer p-5 transition ${role === o.role ? "border-primary ring-2 ring-primary" : ""}`}
          >
            <div className="text-lg font-semibold">{o.label}</div>
            <div className="mt-1 text-sm text-muted-foreground">{o.hint}</div>
          </Card>
        ))}
      </div>
      <Button className="mt-6" disabled={!role || busy} onClick={confirm}>{tr("متابعة")}</Button>
    </AppShell>
  );
}
