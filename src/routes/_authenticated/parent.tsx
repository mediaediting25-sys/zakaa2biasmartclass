import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/parent")({
  head: () => ({
    meta: [
      { property: "og:title", content: "لوحة ولي الأمر — ذكاؤبيا سمارت كلاس" },
      { property: "og:description", content: "تابع تقدم أبنائك ودرجاتهم ومستوى إتقانهم في ذكاؤبيا سمارت كلاس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "لوحة ولي الأمر — ذكاؤبيا سمارت كلاس" },
      { name: "description", content: "تابع تقدم أبنائك ودرجاتهم ومستوى إتقانهم في ذكاؤبيا سمارت كلاس." },
    ],
  }),
  component: ParentHome,
});

type Report = {
  courses: { id: string; title: string; subject: string | null; activities: number; completed: number }[];
  attempts: { id: string; activity: string; course: string; score: number | null; max_score: number | null; submitted_at: string; teacher_comment: string | null }[];
  mastery: { label: string; course: string; mastery: number; evidence: number; correct: number }[];
};

const pct = (v: number) => Math.round(Number(v) <= 1 ? Number(v) * 100 : Number(v));

function ChildReport({ studentId }: { studentId: string }) {
  const { tr, locale, message } = useI18n();
  const linkCode = useQuery({ queryKey: ["child-link-code", studentId], queryFn: async () => {
    const { data, error } = await supabase.from("student_link_codes").select("code").eq("student_id", studentId).maybeSingle();
    if (error) throw error;
    return data?.code ?? null;
  } });
  const { data, isLoading } = useQuery({
    queryKey: ["child-report", studentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("child_report", { _student_id: studentId });
      if (error) throw error;
      return data as unknown as Report;
    },
  });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{tr("جارٍ التحميل…")}</p>;

  const strong = data.mastery.filter((m) => pct(m.mastery) >= 70);
  const weak = data.mastery.filter((m) => pct(m.mastery) < 50);
  const scored = data.attempts.filter((a) => a.max_score);
  const avg = scored.length
    ? Math.round((scored.reduce((s, a) => s + Number(a.score ?? 0) / Number(a.max_score), 0) / scored.length) * 100)
    : null;

  return (
    <div className="space-y-5">
      {linkCode.data && <p className="text-sm">{tr("رمز ربط الطالب")}: <b className="font-mono" dir="ltr">{linkCode.data}</b></p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-muted-foreground">{tr("المقررات")}</div><div className="text-2xl font-bold">{data.courses.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">{tr("الأنشطة المكتملة")}</div><div className="text-2xl font-bold">{data.attempts.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">{tr("متوسط الدرجات")}</div><div className="text-2xl font-bold">{avg === null ? "—" : `${avg}%`}</div></Card>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">{tr("المقررات والتقدم")}</h3>
        {!data.courses.length && <p className="text-sm text-muted-foreground">{tr("لم ينضم لأي مقرر بعد.")}</p>}
        <ul className="space-y-2">
          {data.courses.map((c) => {
            const p = c.activities ? Math.round((c.completed / c.activities) * 100) : 0;
            return (
              <li key={c.id}>
                <div className="flex justify-between text-sm"><span>{c.title}</span><span>{c.completed}/{c.activities}</span></div>
                <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${p}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="mb-2 font-semibold">{tr("نقاط القوة")}</h3>
          {!strong.length ? <p className="text-sm text-muted-foreground">{tr("لا توجد بيانات كافية بعد.")}</p> : (
            <ul className="space-y-1 text-sm">{strong.map((m, i) => <li key={i}>✓ {m.label} — {pct(m.mastery)}%</li>)}</ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 font-semibold">{tr("تحتاج إلى دعم")}</h3>
          {!weak.length ? <p className="text-sm text-muted-foreground">{tr("لا توجد نقاط ضعف واضحة.")}</p> : (
            <ul className="space-y-1 text-sm text-destructive">{weak.map((m, i) => <li key={i}>• {m.label} — {pct(m.mastery)}%</li>)}</ul>
          )}
        </section>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">{tr("آخر النتائج")}</h3>
        {!data.attempts.length && <p className="text-sm text-muted-foreground">{tr("لا توجد محاولات مسلّمة بعد.")}</p>}
        <ul className="divide-y text-sm">
          {data.attempts.map((a) => (
            <li key={a.id} className="space-y-1 py-2">
              <div className="flex justify-between gap-3">
                <span>{a.activity} <span className="text-muted-foreground">· {a.course}</span></span>
                <span className="font-medium">{a.score ?? 0}/{a.max_score ?? 0}</span>
              </div>
              {a.teacher_comment && (
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {tr("تعليق المعلم:")} {a.teacher_comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ParentHome() {
  const { tr, locale, message } = useI18n();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { data: children = [] } = useQuery({
    queryKey: ["my-children"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_my_children");
      if (error) throw error;
      return data ?? [];
    },
  });

  const link = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("redeem_link_code", { _code: code });
      if (error) throw new Error(tr("رمز الربط غير صحيح أو منتهي الصلاحية"));
      return data as string;
    },
    onSuccess: (id) => {
      toast.success(tr("تم ربط الابن بحسابك"));
      setCode("");
      setSelected(id);
      qc.invalidateQueries({ queryKey: ["my-children"] });
    },
    onError: (e: Error) => toast.error(message(e.message)),
  });

  const active = selected ?? children[0]?.student_id ?? null;

  return (
    <AppShell title={tr("لوحة ولي الأمر")} homeTo="/parent">
      <Card className="mb-6 p-5">
        <h2 className="mb-1 font-semibold">{tr("ربط ابن جديد")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{tr("اطلب من ابنك رمز الربط من لوحة الطالب الخاصة به.")}</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) link.mutate(); }}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={tr("رمز الربط (8 خانات)")} maxLength={8} />
          <Button type="submit" disabled={link.isPending}>{tr("ربط")}</Button>
        </form>
      </Card>

      {!children.length ? (
        <p className="text-muted-foreground">{tr("لا يوجد أبناء مرتبطون بحسابك بعد.")}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {children.map((c) => (
              <Button key={c.student_id} variant={c.student_id === active ? "default" : "outline"} onClick={() => setSelected(c.student_id)}>
                {c.full_name || c.email}
              </Button>
            ))}
          </div>
          {active && <Card className="p-5"><ChildReport studentId={active} /></Card>}
        </>
      )}
    </AppShell>
  );
}
