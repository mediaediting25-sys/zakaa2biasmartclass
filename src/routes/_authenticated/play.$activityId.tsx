import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { getStudentActivity, submitAttempt } from "@/lib/student.functions";
import learningCompanions from "@/assets/learning-companions.jpg";

export const Route = createFileRoute("/_authenticated/play/$activityId")({
  head: () => ({
    meta: [
      { property: "og:title", content: "النشاط — سمارت كلاس" },
      { property: "og:description", content: "حل أسئلة النشاط في سمارت كلاس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "النشاط — سمارت كلاس" },
      { name: "description", content: "حل أسئلة النشاط في سمارت كلاس." },
    ],
  }),
  component: Player,
});

function Player() {
  const { tr, locale, message } = useI18n();
  const { activityId } = Route.useParams();
  const [startedAt] = useState(() => new Date().toISOString());
  const [secs, setSecs] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ["play", activityId],
    queryFn: () => getStudentActivity({ data: { activityId } }),
  });
  const submit = useMutation({
    mutationFn: () =>
      submitAttempt({
        data: {
          activityId,
          startedAt,
          answers: (data?.questions ?? []).map((q) => ({ questionId: q.id, choice: choices[q.id] ?? null })),
        },
      }),
  });
  useEffect(() => {
    if (submit.data) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [submit.data]);

  const result = submit.data;
  const resById = new Map(result?.results.map((r) => [r.questionId, r]));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const young = (data?.activity.target_age ?? 12) <= 9;
  const activeIndex = Math.min(data?.questions.length ? data.questions.length - 1 : 0, Object.keys(choices).length);

  return (
    <AppShell title={data?.activity.title ?? tr("النشاط")} homeTo="/student" actions={<span className="font-mono text-sm">{mm}:{ss}</span>}>
      {isLoading && <p>{tr("جارٍ التحميل…")}</p>}
      {error && <p className="text-destructive">{message((error as Error).message)}</p>}
      {data?.locked && (
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <p className="mb-2 text-lg font-semibold">{tr("لقد حللت هذا النشاط من قبل")}</p>
          <p className="mb-4 text-muted-foreground">{tr("لا يمكنك إعادة الحل إلا إذا أذن لك المعلم بذلك.")}</p>
          <Button asChild><Link to="/student">{tr("العودة إلى لوحة الطالب")}</Link></Button>
        </Card>
      )}
      {data && !data.locked && (
        <div className="mx-auto max-w-2xl space-y-4">
          {young && <img src={learningCompanions} alt="" width={1152} height={576} className="aspect-[2/1] w-full rounded-lg object-cover" />}
          <p className="text-sm text-muted-foreground">{Object.keys(choices).length} / {data.questions.length} {tr("مكتمل")}</p>
          {data.activity.instructions && <p className="text-muted-foreground">{data.activity.instructions}</p>}
          {data.questions.map((q, i) => {
            if (young && !result && i !== activeIndex) return null;
            const r = resById.get(q.id);
            return (
              <Card key={q.id} className="p-5">
                <p className="mb-3 font-medium">{i + 1}. {q.stem}</p>
                <div className="grid gap-2">
                  {(q.kind === "fill_blank" || q.kind === "short_answer") && <Input aria-label={tr("إجابتك")} placeholder={tr("إجابتك")} value={choices[q.id] ?? ""} disabled={!!result || submit.isPending} onChange={e => setChoices(c => ({ ...c, [q.id]: e.target.value }))} />}
                  {(q.kind === "fill_blank" || q.kind === "short_answer" ? [] : q.options).map((o) => (
                    <Button
                      key={o}
                      type="button"
                      variant={choices[q.id] === o ? "default" : "outline"}
                      className={young ? "min-h-16 justify-start whitespace-normal border-2 px-5 py-4 text-start text-lg" : "h-auto justify-start whitespace-normal py-2 text-start"}
                      disabled={!!result || submit.isPending}
                      onClick={() => setChoices((c) => ({ ...c, [q.id]: o }))}
                    >
                      {o}
                    </Button>
                  ))}
                </div>
                {r && (
                  <p className={`mt-3 text-sm ${r.correct ? "text-primary" : "text-destructive"}`}>
                    {r.correct ? tr("إجابة صحيحة ✓") : tr("إجابة غير صحيحة")} {r.explanation ? `— ${r.explanation}` : ""}
                  </p>
                )}
              </Card>
            );
          })}
          {young && !result && <div className="flex flex-wrap gap-2">{data.questions.map((q, i) => <Button key={q.id} variant={choices[q.id] ? "default" : "outline"} size="sm" onClick={() => document.getElementById(q.id)?.focus()} disabled>{i + 1}{choices[q.id] ? " ✓" : ""}</Button>)}</div>}
          {!data.questions.length && <p>{tr("لا توجد أسئلة في هذا النشاط.")}</p>}
          {result ? (
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold">{result.score} / {result.max}</p>
              <Button asChild className="mt-3"><Link to="/student">{tr("العودة")}</Link></Button>
            </Card>
          ) : (
            <Button className="w-full" disabled={submit.isPending || !data.questions.length} onClick={() => submit.mutate()}>
              {submit.isPending ? tr("جارٍ التصحيح…") : tr("تسليم الإجابات")}
            </Button>
          )}
          {submit.error && <p className="text-destructive">{message((submit.error as Error).message)}</p>}
        </div>
      )}
    </AppShell>
  );
}
