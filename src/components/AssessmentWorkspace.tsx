import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { generateAssessmentBatch, generateExamStyleQuestions, publishAssessment, deleteRejectedQuestion } from "@/lib/teacher.functions";
import { Check, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { loadCurriculum, setItemStatus } from "@/lib/api";
import { assessmentSection } from "@/lib/assessment";
import { LessonPresentationTools, usePresentations } from "./LessonTools";

type Curriculum = Awaited<ReturnType<typeof loadCurriculum>>;
export function AssessmentWorkspace({ courseId, curriculum, refresh }: { courseId: string; curriculum: Curriculum; refresh: () => void }) {
  const { tr, message, locale } = useI18n();
  const [tab, setTab] = useState("practice");
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [language, setLanguage] = useState<"ar" | "en" | "both">("ar");
  const [age, setAge] = useState(12);
  const [grade, setGrade] = useState("");
  const [reviewKind, setReviewKind] = useState("all");
  const [warnings, setWarnings] = useState<string[]>([]);
  const generate = useServerFn(generateAssessmentBatch);
  const exam = useServerFn(generateExamStyleQuestions);
  const publish = useServerFn(publishAssessment);
  const deleteQuestion = useServerFn(deleteRejectedQuestion);
  const deletion = useMutation({ mutationFn: (questionId: string) => deleteQuestion({ data: { questionId } }), onSuccess: refresh, onError: (e: Error) => toast.error(message(e.message)) });
  const pres = usePresentations(courseId);
  const generation = useMutation({
    mutationFn: () => tab === "exam" ? exam({ data: { lessonId, topic, count, age, grade, language } }) : generate({ data: { courseId, unitId: unitId || undefined, lessonId: lessonId || undefined, topic, count, age, grade, language, kind: tab === "homework" ? "homework" : "practice" } }),
    onSuccess: r => { setWarnings(r.warnings); toast.success(tr("تم توليد {0} سؤال موثّق للمراجعة", r.created)); refresh(); setTab("review"); },
    onError: (e: Error) => toast.error(message(e.message)),
  });
  const publication = useMutation({ mutationFn: (a: { activityId: string; publish: boolean }) => publish({ data: a }), onSuccess: refresh, onError: (e: Error) => toast.error(message(e.message)) });
  const approve = useMutation({ mutationFn: (a: { id: string; status: "approved" | "rejected" }) => setItemStatus("questions", a.id, a.status), onSuccess: refresh, onError: (e: Error) => toast.error(message(e.message)) });
  const tabs = ["practice", "homework", "exam", "presentations", "review", "history"] as const;
  const names = { practice: "توليد أسئلة", homework: "توليد واجب", exam: "بأسلوب الامتحانات", presentations: "العروض", review: "المراجعة والاعتماد", history: "السجل" };
  const lessons = curriculum.lessons.filter(l => !unitId || l.unit_id === unitId);
  const batches = (section: string) => curriculum.activities.filter(a => assessmentSection(a) === section && (reviewKind === "all" || a.kind === reviewKind));
  const questionList = (activityId: string) => curriculum.questions.filter(q => q.activity_id === activityId);
  const renderBatches = (section: "review" | "history") => <div className="space-y-5">
    <label className="flex flex-wrap items-center gap-3 text-sm">{tr("نوع النشاط")}<select className="h-11 rounded-md border bg-background px-3" value={reviewKind} onChange={e => setReviewKind(e.target.value)}><option value="all">{tr("الكل")}</option><option value="practice">{tr("توليد أسئلة")}</option><option value="homework">{tr("توليد واجب")}</option><option value="exam">{tr("بأسلوب الامتحانات")}</option></select></label>
    {!batches(section).length && <p className="py-8 text-muted-foreground">{tr("لا توجد دفعات هنا بعد.")}</p>}
    {batches(section).map(a => <article key={a.id} className="surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{a.title}</h3><p className="text-sm text-muted-foreground">{new Date(a.created_at).toLocaleString(locale)} · {questionList(a.id).length} {tr("سؤال")} · {a.target_age ? `${tr("سن الطالب")}: ${a.target_age}` : ""}</p>{a.target_topic && <p className="text-sm">{a.target_topic}</p>}</div><Button disabled={publication.isPending} onClick={() => publication.mutate({ activityId: a.id, publish: a.status !== "published" })}>{a.status === "published" ? tr("إلغاء النشر") : section === "history" ? tr("إعادة النشر") : tr("نشر للطلاب")}</Button></div>
      <details open={section === "review"}><summary className="cursor-pointer py-2 font-medium">{tr("عرض الأسئلة")}</summary><ul className="space-y-3">{questionList(a.id).map(q => <li key={q.id} className="rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{q.stem}</p><Badge variant="secondary">{tr(q.status === "published" ? "منشور" : q.status === "approved" ? "معتمد" : q.status === "rejected" ? "مرفوض" : "يحتاج مراجعة")}</Badge></div><ul className="mt-2 list-inside list-disc text-sm">{(Array.isArray(q.options) ? q.options : []).map((o, i) => <li key={i}>{String(o)}</li>)}</ul><p className="mt-2 text-sm text-primary">{tr("الإجابة الصحيحة")}: {String((q.correct_answer as { value?: unknown } | null)?.value ?? "")}</p><p className="mt-2 text-xs text-muted-foreground">{tr("المصدر ص")} {q.source_page}: {q.source_quote}</p>{q.status === "rejected" && <Button className="mt-3" size="icon" variant="outline" title={tr("حذف السؤال المرفوض")} aria-label={tr("حذف السؤال المرفوض")} disabled={deletion.isPending} onClick={() => { if (window.confirm(tr("هل تريد حذف السؤال المرفوض نهائيًا؟"))) deletion.mutate(q.id); }}><Trash2 className="size-4" /></Button>}{q.status === "draft" && <div className="mt-3 flex gap-2"><Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: q.id, status: "approved" })}>{tr("اعتماد")}</Button><Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate({ id: q.id, status: "rejected" })}>{tr("رفض")}</Button></div>}</li>)}</ul></details>
    </article>)}
    {section === "history" && curriculum.lessons.map(l => <LessonPresentationTools key={l.id} courseId={courseId} lessonId={l.id} presentations={pres.data ?? []} mode="history" />)}
  </div>;
  return <Tabs value={tab} onValueChange={setTab} className="my-8">
    <div className="overflow-x-auto"><TabsList className="h-auto min-w-max gap-1 bg-muted p-2">{tabs.map(t => <TabsTrigger key={t} value={t} disabled={generation.isPending} className="min-h-11">{tr(names[t])}</TabsTrigger>)}</TabsList></div>
    {["practice", "homework", "exam"].map(mode => <TabsContent key={mode} value={mode} className="py-6"><form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={e => { e.preventDefault(); setWarnings([]); generation.mutate(); }}>
      <label className="grid gap-2 text-sm">{tr("الوحدة")}<select className="h-11 rounded-md border bg-background px-3" value={unitId} onChange={e => { setUnitId(e.target.value); setLessonId(""); }}><option value="">{tr("المنهج كامل")}</option>{curriculum.units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}</select></label>
      <label className="grid gap-2 text-sm">{tr("الدرس")}<select required={mode === "exam"} className="h-11 rounded-md border bg-background px-3" value={lessonId} onChange={e => setLessonId(e.target.value)}><option value="">{tr("كل دروس الجزء المختار")}</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
      <label className="grid gap-2 text-sm">{tr("الجزئية المطلوبة")}<Input value={topic} maxLength={300} onChange={e => setTopic(e.target.value)} placeholder={tr("مثال: دورة الماء فقط")} /></label>
      <label className="grid gap-2 text-sm">{tr("عدد الأسئلة")}<Input type="number" min={1} max={15} required value={count} onChange={e => setCount(Number(e.target.value))} /></label>
      <label className="grid gap-2 text-sm">{tr("لغة التوليد")}<select className="h-11 rounded-md border bg-background px-3" value={language} onChange={e => setLanguage(e.target.value as "ar" | "en" | "both")}><option value="ar">العربية</option><option value="en">English</option><option value="both">{tr("العربية والإنجليزية — العدد لكل لغة")}</option></select></label>
      <label className="grid gap-2 text-sm">{tr("سن الطالب")}<Input type="number" min={4} max={22} required value={age} onChange={e => setAge(Number(e.target.value))} /></label>
      <label className="grid gap-2 text-sm">{tr("الصف")}<Input value={grade} maxLength={80} onChange={e => setGrade(e.target.value)} /></label>
      <Button type="submit" disabled={generation.isPending || !lessons.length}>{generation.isPending ? tr("جارٍ التوليد…") : tr(names[mode as "practice" | "homework" | "exam"])}</Button>
    </form></TabsContent>)}
    <TabsContent value="presentations" className="space-y-4 py-6">{curriculum.lessons.map(l => <section key={l.id}><h3 className="font-bold">{l.title}</h3><LessonPresentationTools courseId={courseId} lessonId={l.id} presentations={pres.data ?? []} mode="generation" /></section>)}</TabsContent>
    <TabsContent value="review" className="py-6">{renderBatches("review")}{curriculum.lessons.map(l => <LessonPresentationTools key={l.id} courseId={courseId} lessonId={l.id} presentations={pres.data ?? []} mode="review" />)}</TabsContent>
    <TabsContent value="history" className="py-6">{renderBatches("history")}</TabsContent>
    {warnings.length > 0 && <ul role="status" className="mt-4 list-inside list-disc text-sm text-muted-foreground">{warnings.map((w, i) => <li key={i}>{message(w)}</li>)}</ul>}
  </Tabs>;
}