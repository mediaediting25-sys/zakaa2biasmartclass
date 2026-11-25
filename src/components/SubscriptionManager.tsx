import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Gift, Check, X, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import { accessStatus, teacherAccessStatus, subscriptionEnd } from "@/lib/subscriptions";
import { TEACHER_ACCESS_EXPIRED } from "@/lib/teacher-access";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { SubscriptionPaymentDialog } from "./SubscriptionPaymentDialog";
import { DepartedAuditHistory } from "./DepartedAuditHistory";

export function SubscriptionManager({ userId }: { userId: string }) {
  const { tr, locale } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ teacherId: string; name: string; requestId?: string; planId?: string; cycle?: string } | null>(null);
  const [kind, setKind] = useState("complimentary");
  const [grantCycle, setGrantCycle] = useState<"monthly" | "yearly">("monthly");
  const openEditor = (target: NonNullable<typeof editing>) => {
    setKind(target.requestId ? "manual_subscription" : "complimentary");
    setGrantCycle(target.cycle === "yearly" ? "yearly" : "monthly");
    setEditing(target);
  };
  const data = useQuery({ queryKey: ["subscription-admin", userId], queryFn: async () => {
    const [teachers, periods, requests] = await Promise.all([
      supabase.rpc("admin_subscription_teachers"),
      supabase.from("teacher_access_periods").select("*").order("ends_at", { ascending: false }),
      supabase.from("teacher_renewal_requests").select("*").order("created_at", { ascending: false }),
    ]);
    if (teachers.error || periods.error || requests.error) throw new Error("Unable to load subscriptions");
    return { teachers: teachers.data ?? [], periods: periods.data ?? [], requests: requests.data ?? [] };
  } });
  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["subscription-admin"] }), qc.invalidateQueries({ queryKey: ["teacher-subscription"] })]);
    toast.success(tr("تم الحفظ"));
  };
  const save = useMutation({ mutationFn: async (form: HTMLFormElement) => {
    if (!editing) throw new Error("Teacher required");
    const f = new FormData(form);
    const days = Number(f.get("days"));
    const kind = String(f.get("kind"));
    const cycle = editing.cycle ?? String(f.get("cycle"));
    const reason = String(f.get("reason"));
    const result = editing.requestId
      ? await supabase.rpc("review_teacher_subscription", { _request_id: editing.requestId, _approve: true, _days: days, _kind: kind, _reason: reason })
      : kind === "manual_subscription"
        ? await supabase.rpc("grant_teacher_subscription", { _teacher_id: editing.teacherId, _plan_id: String(f.get("plan")), _billing_cycle: cycle, _reason: reason })
        : await supabase.rpc("grant_teacher_access", { _teacher_id: editing.teacherId, _plan_id: String(f.get("plan")), _days: days, _kind: kind, _reason: reason });
    if (result.error) throw result.error;
  }, onSuccess: async () => { setEditing(null); await refresh(); }, onError: () => toast.error(tr("تعذر حفظ المدة")) });
  const reject = useMutation({ mutationFn: async (id: string) => {
    const { error } = await supabase.rpc("review_teacher_renewal", { _request_id: id, _approve: false, _days: 0, _kind: "complimentary", _reason: "" });
    if (error) throw error;
  }, onSuccess: refresh, onError: () => toast.error(tr("تعذر الحفظ")) });
  const date = (value: string) => new Date(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB");
  const statusLabel = { active: tr("مدة سارية"), expired: tr("انتهت المدة"), upcoming: tr("مدة قادمة"), unset: tr("لم تُحدد مدة بعد") };
  if (data.isPending) return <p role="status">{tr("جارٍ التحميل…")}</p>;
  if (data.isError) return <p role="alert" className="text-destructive">{tr("تعذر تحميل الاشتراكات")}</p>;
  const pending = data.data.requests.filter(r => r.status === "pending");
  return <section aria-label={tr("إدارة الاشتراكات والمدد المجانية")} className="space-y-6">
    <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarClock className="size-5 text-primary" />{tr("إدارة الاشتراكات والمدد المجانية")}</h2>
    <Input aria-label={tr("البحث بالاسم أو البريد")} placeholder={tr("البحث بالاسم أو البريد")} value={search} onChange={e => setSearch(e.target.value)} className="max-w-lg" />
    <div className="space-y-3">{data.data.teachers.filter(t => `${t.full_name} ${t.email}`.toLowerCase().includes(search.toLowerCase())).map(t => {
      const periods = data.data.periods.filter(p => p.teacher_id === t.user_id);
      const status = accessStatus(periods);
      const last = periods[0];
      return <article key={t.user_id} className="surface space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="font-bold">{t.full_name || tr("معلم")}</h3><p dir="ltr" className="break-all text-sm text-muted-foreground">{t.email}</p></div><Button variant="outline" onClick={() => openEditor({ teacherId: t.user_id, name: t.full_name || tr("معلم") })}><Gift className="size-4" />{tr("إضافة مدة")}</Button></div>
        <p className={status.status === "expired" ? "text-destructive" : "text-primary"}>{statusLabel[status.status]}</p>
        {last && <p className="text-sm">{tr("نهاية المدد المسجلة")}: {date(last.ends_at)}</p>}
        {!!periods.length && <details><summary className="cursor-pointer text-sm text-muted-foreground">{tr("سجل المدَد")}</summary><ul className="mt-3 space-y-3">{periods.map(p => <li key={p.id} className="border-t border-border pt-2 text-sm"><p>{PLANS.find(plan => plan.id === p.plan_id)?.[locale].name} · {tr(p.kind === "complimentary" ? "مدة مجانية" : "اشتراك يدوي")}</p><p>{date(p.starts_at)} — {date(p.ends_at)}</p>{p.reason && <p className="break-words text-muted-foreground">{p.reason}</p>}</li>)}</ul></details>}
      </article>;
    })}</div>
    <h3 className="text-lg font-semibold">{tr("طلبات التجديد")}</h3>
    {!pending.length && <p className="text-muted-foreground">{tr("لا توجد طلبات تجديد معلقة")}</p>}
    {pending.map(r => {
      const teacher = data.data.teachers.find(t => t.user_id === r.teacher_id);
      return <article key={r.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4"><div><h4 className="font-bold">{teacher?.full_name || tr("معلم")}</h4><p className="text-sm">{PLANS.find(p => p.id === r.plan_id)?.[locale].name} · {date(r.created_at)} · {tr(r.billing_cycle === "yearly" ? "سنة كاملة — بسعر عشرة أشهر" : "شهر كامل")}</p></div><div className="flex gap-2"><Button onClick={() => openEditor({ teacherId: r.teacher_id, name: teacher?.full_name || tr("معلم"), requestId: r.id, planId: r.plan_id, cycle: r.billing_cycle })}><Check className="size-4" />{tr("اعتماد")}</Button><Button variant="destructive" disabled={reject.isPending} onClick={() => { if (window.confirm(tr("رفض طلب التجديد؟"))) reject.mutate(r.id); }}><X className="size-4" />{tr("رفض")}</Button></div></article>;
    })}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !save.isPending) setEditing(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{tr("إضافة مدة")} — {editing?.name}</DialogTitle></DialogHeader>{editing && <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(e.currentTarget); }}>
      <label className="block">{tr("الباقة")}<select name="plan" defaultValue={editing.planId ?? "pro"} disabled={!!editing.requestId} className="mt-1 w-full rounded-md border border-input bg-background p-2">{PLANS.filter(p => kind === "complimentary" || p.id !== "starter").map(p => <option key={p.id} value={p.id}>{p[locale].name}</option>)}</select></label>
      <label className="block">{tr("نوع المدة")}<select name="kind" value={kind} onChange={e => setKind(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-2"><option value="complimentary">{tr("مدة مجانية")}</option><option value="manual_subscription">{tr("اشتراك يدوي")}</option></select></label>
      {kind === "complimentary" ? <label className="block">{tr("عدد الأيام")}<Input name="days" type="number" min={1} max={3650} step={1} required /></label> : <label className="block">{tr("دورة الاشتراك")}<select name="cycle" value={grantCycle} onChange={e => setGrantCycle(e.target.value === "yearly" ? "yearly" : "monthly")} disabled={!!editing.requestId} className="mt-1 w-full rounded-md border border-input bg-background p-2"><option value="monthly">{tr("شهر كامل")}</option><option value="yearly">{tr("سنة كاملة — بسعر عشرة أشهر")}</option></select></label>}
      {kind === "manual_subscription" && <p className="text-sm text-muted-foreground">{tr("نهاية المدة المتوقعة")}: {date(subscriptionEnd(data.data.periods.find(p => p.teacher_id === editing.teacherId && Date.parse(p.ends_at) > Date.now())?.ends_at ?? new Date().toISOString(), editing.cycle === "yearly" || (!editing.requestId && grantCycle === "yearly") ? "yearly" : "monthly"))}</p>}
      <label className="block">{tr("سبب الإضافة")}<Textarea name="reason" maxLength={1000} /></label>
      <Button disabled={save.isPending} type="submit"><Save className="size-4" />{tr("حفظ المدة")}</Button>
    </form>}</DialogContent></Dialog>
    <DepartedAuditHistory />
  </section>;
}

export function TeacherSubscription({ userId }: { userId: string }) {
  const { tr, locale } = useI18n();
  const qc = useQueryClient();
  const [plan, setPlan] = useState("pro");
  const [cycle, setCycle] = useState("monthly");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const data = useQuery({ queryKey: ["teacher-subscription", userId], queryFn: async () => {
    const [periods, requests, profile, access] = await Promise.all([
      supabase.from("teacher_access_periods").select("*").eq("teacher_id", userId).order("ends_at", { ascending: false }),
      supabase.from("teacher_renewal_requests").select("*").eq("teacher_id", userId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("created_at").eq("id", userId).single(),
      supabase.rpc("teacher_access_active"),
    ]);
    if (periods.error || requests.error || profile.error || access.error) throw new Error("Unable to load subscriptions");
    return { periods: periods.data ?? [], requests: requests.data ?? [], createdAt: profile.data.created_at, active: access.data === true };
  }, refetchInterval: 60_000 });
  const request = useMutation({ mutationFn: async () => {
    const { error } = await supabase.rpc("request_teacher_subscription", { _plan_id: plan, _billing_cycle: cycle });
    if (error) throw error;
  }, onSuccess: async () => { setPaymentOpen(false); await qc.invalidateQueries({ queryKey: ["teacher-subscription", userId] }); toast.success(tr("تم إرسال طلب التجديد")); }, onError: () => toast.error(tr("تعذر إرسال طلب التجديد")) });
  if (data.isPending) return <p role="status">{tr("جارٍ التحميل…")}</p>;
  if (data.isError) return <p role="alert" className="text-destructive">{tr("تعذر تحميل الاشتراكات")}</p>;
  const status = teacherAccessStatus(data.data.periods, data.data.createdAt);
  const pending = data.data.requests.some(r => r.status === "pending");
  const labels = { active: tr("مدة سارية"), expired: tr("انتهت المدة"), upcoming: tr("مدة قادمة"), unset: tr("لم تُحدد مدة بعد") };
  return <section aria-label={tr("اشتراكي")} className="mb-8 border-b border-border pb-6">
    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><CalendarClock className="size-5 text-primary" />{tr("اشتراكي")}</h2>
    <p className={!data.data.active ? "text-destructive" : "text-primary"}>{data.data.active ? status.period?.isTrial ? tr("تجربة مجانية — 30 يومًا") : tr("مدة سارية") : labels[status.status]}</p>
    {!data.data.active && <p role="alert" className="mt-3 text-destructive">{tr(TEACHER_ACCESS_EXPIRED)}</p>}
    {status.period && <p className="mt-2 text-sm">{PLANS.find(p => p.id === status.period?.plan_id)?.[locale].name} · {tr("نهاية المدة")}: {new Date(status.period.ends_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}</p>}
    {pending ? <div className="mt-3 space-y-3"><p className="text-muted-foreground">{tr("طلب التجديد قيد المراجعة")} · {tr(data.data.requests.find(r => r.status === "pending")?.billing_cycle === "yearly" ? "سنة كاملة — بسعر عشرة أشهر" : "شهر كامل")}</p><Button variant="outline" onClick={() => setPaymentOpen(true)}>{tr("طرق الاشتراك")}</Button></div> : <form className="mt-4 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); setPaymentOpen(true); }}><select aria-label={tr("الباقة")} value={plan} onChange={e => setPlan(e.target.value)} className="min-w-0 max-w-full rounded-md border border-input bg-background p-2">{PLANS.filter(p => p.id !== "starter").map(p => <option key={p.id} value={p.id}>{p[locale].name}</option>)}</select><select aria-label={tr("دورة الاشتراك")} value={cycle} onChange={e => setCycle(e.target.value)} className="min-w-0 max-w-full rounded-md border border-input bg-background p-2"><option value="monthly">{tr("شهر كامل")}</option><option value="yearly">{tr("سنة كاملة — بسعر عشرة أشهر")}</option></select><Button type="submit" disabled={request.isPending}><CalendarClock className="size-4" />{tr("طلب تجديد الاشتراك")}</Button></form>}
    <SubscriptionPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} planName={PLANS.find(p => p.id === (pending ? data.data.requests.find(r => r.status === "pending")?.plan_id : plan))?.[locale].name ?? ""} cycle={pending ? data.data.requests.find(r => r.status === "pending")?.billing_cycle ?? "monthly" : cycle} {...(!pending ? { onRequest: () => request.mutate() } : {})} requestPending={request.isPending} />
    {data.data.requests[0]?.status === "rejected" && !pending && <p className="mt-2 text-destructive">{tr("لم يُقبل طلب التجديد السابق")}</p>}
  </section>;
}