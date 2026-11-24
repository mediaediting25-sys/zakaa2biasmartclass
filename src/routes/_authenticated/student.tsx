import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { StudentMaterials } from "@/components/CourseMaterials";
import { listMyAttempts, listStudentActivities, listStudentCourses } from "@/lib/api";
import { displayActivityTitle } from "@/lib/assessment";

export const Route = createFileRoute("/_authenticated/student")({
  head: () => ({
    meta: [
      { property: "og:title", content: "لوحة الطالب — ذكاؤبيا سمارت كلاس" },
      { property: "og:description", content: "مقرراتك وأنشطتك ونتائجك في ذكاؤبيا سمارت كلاس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "لوحة الطالب — ذكاؤبيا سمارت كلاس" },
      { name: "description", content: "مقرراتك وأنشطتك ونتائجك في ذكاؤبيا سمارت كلاس." },
    ],
  }),
  component: StudentHome,
});

function CourseActivities({ courseId }: { courseId: string }) {
  const { tr, locale } = useI18n();
  const [showHistory, setShowHistory] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["student-activities", courseId],
    queryFn: () => listStudentActivities(courseId),
  });
  const { data: attempts = [] } = useQuery({ queryKey: ["my-attempts"], queryFn: () => listMyAttempts() });
  const { data: grants = [] } = useQuery({
    queryKey: ["my-retake-grants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("retake_grants").select("activity_id").is("consumed_at", null);
      if (error) throw error;
      return data ?? [];
    },
    refetchOnWindowFocus: true,
  });
  if (!data.length) return <p className="text-sm text-muted-foreground">{tr("لا توجد أنشطة منشورة بعد.")}</p>;
  const granted = new Set(grants.map((g) => g.activity_id));
  const latest = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (a.submitted_at && !latest.has(a.activity_id)) latest.set(a.activity_id, a);
  const current = data.filter((a) => !latest.has(a.id) || granted.has(a.id));
  const done = data.filter((a) => latest.has(a.id));
  return (
    <div className="space-y-3">
      {current.length ? (
        <ul className="space-y-2">
          {current.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3">
              <span>{displayActivityTitle(a.title)}{granted.has(a.id) && <span className="ms-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{tr("متاح للإعادة")}</span>}</span>
              <Button asChild size="sm">
                <Link to="/play/$activityId" params={{ activityId: a.id }}>{tr("ابدأ")}</Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{tr("لا توجد أنشطة جديدة الآن.")}</p>
      )}
      {done.length > 0 && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? tr("إخفاء السجل") : tr("السجل")} ({done.length})
          </Button>
          {showHistory && (
            <ul className="mt-2 space-y-2">
              {done.map((a) => {
                const at = latest.get(a.id)!;
                const retake = granted.has(a.id);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {displayActivityTitle(a.title)}
                      <span className="ms-2 text-xs text-muted-foreground">{at.score} / {at.max_score} · {new Date(at.submitted_at!).toLocaleDateString(locale)}</span>
                    </span>
                    {retake ? (
                      <Button asChild size="sm"><Link to="/play/$activityId" params={{ activityId: a.id }}>{tr("ابدأ")}</Link></Button>
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs">{tr("تم الانتهاء ✓")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StudentHome() {
  const { tr, locale, message } = useI18n();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const { data: courses = [] } = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const { data: attempts = [] } = useQuery({ queryKey: ["my-attempts"], queryFn: () => listMyAttempts() });

  const join = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("join_course", { _code: code });
      if (error) throw new Error(tr("رمز غير صحيح أو المقرر غير منشور"));
    },
    onSuccess: () => {
      toast.success(tr("تم الانضمام للمقرر"));
      setCode("");
      qc.invalidateQueries({ queryKey: ["student-courses"] });
    },
    onError: (e: Error) => toast.error(message(e.message)),
  });

  return (
    <AppShell title={tr("لوحة الطالب")} homeTo="/student">
      <Card className="mb-6 p-5">
        <h2 className="mb-3 font-semibold">{tr("الانضمام لمقرر")}</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) join.mutate();
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={tr("رمز المقرر (6 أحرف)")} maxLength={6} />
          <Button type="submit" disabled={join.isPending}>{tr("انضمام")}</Button>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((c: any) => (
          <Card key={c.id} className="p-5">
            <h3 className="mb-1 text-lg font-semibold">{c.title}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{[c.subject, c.grade_level].filter(Boolean).join(" · ")}</p>
            <CourseActivities courseId={c.id} />
            <StudentMaterials courseId={c.id} />
          </Card>
        ))}
        {!courses.length && <p className="text-muted-foreground">{tr("لم تنضم لأي مقرر بعد. اطلب الرمز من معلمك.")}</p>}
      </div>

      <ParentLinkCard />

      {attempts.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-semibold">{tr("محاولاتي")}</h2>
          <ul className="space-y-1 text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="space-y-1">
                <div className="flex justify-between">
                  <span>{new Date(a.started_at).toLocaleDateString(locale)}</span>
                  <span>{a.score} / {a.max_score}</span>
                </div>
                {(a as any).teacher_comment && (
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {tr("تعليق المعلم:")} {(a as any).teacher_comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}

function ParentLinkCard() {
  const { tr, locale, message } = useI18n();
  const [code, setCode] = useState<string | null>(null);
  const gen = useMutation({
    mutationFn: async (regenerate: boolean) => {
      const { data, error } = await supabase.rpc("get_my_link_code", { _regenerate: regenerate });
      if (error) throw new Error(tr("تعذّر إنشاء رمز الربط"));
      return data as string;
    },
    onSuccess: setCode,
    onError: (e: Error) => toast.error(message(e.message)),
  });
  return (
    <Card className="mt-6 p-5">
      <h2 className="mb-1 font-semibold">{tr("ربط ولي الأمر")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{tr("أعطِ هذا الرمز لولي أمرك. يظل متاحًا طوال تسجيلك في مقرر غير مؤرشف، ولا يُستهلك بعد الربط.")}</p>
      {code ? (
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-muted px-4 py-2 font-mono text-xl tracking-widest" dir="ltr">{code}</span>
          <Button variant="outline" size="sm" onClick={() => gen.mutate(true)} disabled={gen.isPending}>{tr("رمز جديد")}</Button>
        </div>
      ) : (
        <Button onClick={() => gen.mutate(false)} disabled={gen.isPending}>{tr("إظهار رمز الربط")}</Button>
      )}
    </Card>
  );
}
