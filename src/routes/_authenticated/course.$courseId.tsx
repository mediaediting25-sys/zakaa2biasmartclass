import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/useSession";
import {
  getCourse,
  listDocuments,
  loadCurriculum,
  uploadCourseDocument,
} from "@/lib/api";
import { processDocument, publishCourse } from "@/lib/teacher.functions";
import { PacingPanel } from "@/components/LessonTools";
import { TeacherMaterialsPanel } from "@/components/CourseMaterials";
import { AssessmentWorkspace } from "@/components/AssessmentWorkspace";
import { grantRetake, listCourseReports, setTeacherComment } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/course/$courseId")({
  head: () => ({
    meta: [
      { property: "og:title", content: "استوديو المنهج — ذكاؤبيا سمارت كلاس" },
      { property: "og:description", content: "مراجعة المنهج والأسئلة ونشر الأنشطة ومتابعة تقارير الطلاب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "استوديو المنهج — ذكاؤبيا سمارت كلاس" },
      { name: "description", content: "مراجعة المنهج والأسئلة ونشر الأنشطة ومتابعة تقارير الطلاب." },
    ],
  }),
  component: CourseStudio,
});

function CourseStudio() {
  const { tr, locale, message } = useI18n();
const docStatusLabel: Record<string, string> = {
  pending: tr("في الانتظار"),
  uploaded: tr("تم الرفع"),
  processing: tr("جارٍ المعالجة"),
  processed: tr("تمت المعالجة"),
  failed: tr("فشلت"),
};

const statusLabel: Record<string, string> = {
  draft: tr("يحتاج مراجعة"),
  approved: tr("معتمد"),
  published: tr("منشور"),
  rejected: tr("مرفوض"),
};


  const { courseId } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const process = useServerFn(processDocument);
  const publish = useServerFn(publishCourse);
  const [category, setCategory] = useState<"curriculum" | "previous_exams">("curriculum");
  const [language, setLanguage] = useState<"ar" | "en">("ar");

  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => getCourse(courseId) });
  const docs = useQuery({ queryKey: ["docs", courseId], queryFn: () => listDocuments(courseId),
    refetchInterval: (q) => (q.state.data?.some((d) => d.processing_status === "processing" || d.processing_status === "pending") ? 3000 : false),
  });
  const cur = useQuery({ queryKey: ["curriculum", courseId], queryFn: () => loadCurriculum(courseId) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["docs", courseId] });
    qc.invalidateQueries({ queryKey: ["curriculum", courseId] });
    qc.invalidateQueries({ queryKey: ["course", courseId] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Please sign in");
      const id = await uploadCourseDocument({ courseId, userId: user.id, file, category });
      refresh();
      return process({ data: { documentId: id, language } });
    },
    onSuccess: (r) => {
      toast.success(tr("تم التحليل: {0} وحدة، {1} درس", r.units, r.lessons));
      r.warnings.slice(0, 3).forEach((w) => toast.warning(message(w)));
      refresh();
    },
    onError: (e: Error) => {
      toast.error(message(e.message));
      refresh();
    },
  });

  const publishAll = useMutation({
    mutationFn: () => publish({ data: { courseId } }),
    onSuccess: (r) => {
      toast.success(tr("تم نشر {0} سؤال معتمد للطلاب", r.published));
      r.rejected.slice(0, 3).forEach((x) => toast.warning(tr("لم يُنشر «{0}»: {1}", x.stem, x.reasons.map(message).join(locale === "ar" ? "، " : ", "))));
      refresh();
    },
    onError: (e: Error) => toast.error(message(e.message)),
  });

  const c = cur.data;
  return (
    <AppShell
      title={course.data?.title ?? tr("المقرر")}
      subtitle={tr("ارفع الكتاب، راجع ما استخرجه الذكاء الاصطناعي مع المصدر، ثم اعتمد وانشر")}
      homeTo="/teacher"
      nav={[{ to: "/teacher", label: tr("مقرراتي") }]}
      actions={
        <div className="flex items-center gap-3">
          {(course.data as any)?.join_code && (
            <span className="rounded-lg border px-3 py-1 text-sm">
              {tr("رمز الانضمام للطلاب:")} <b className="font-mono tracking-widest">{(course.data as any).join_code}</b>
            </span>
          )}
          <Button onClick={() => publishAll.mutate()} disabled={publishAll.isPending || !c}>
            {tr("نشر المعتمد")}
          </Button>
        </div>
      }
    >
      <section className="surface mb-8 rounded-2xl p-5">
        <h2 className="mb-3 font-display text-lg font-bold">{tr("ملفات المقرر")}</h2>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="curriculum">{tr("كتاب / منهج")}</option>
            <option value="previous_exams">{tr("امتحانات سابقة")}</option>
          </select>
          <label className="flex items-center gap-2 text-sm">{tr("لغة التوليد")}<select className="h-10 rounded-md border bg-background px-3" value={language} onChange={e => setLanguage(e.target.value as "ar" | "en")}><option value="ar">العربية</option><option value="en">English</option></select></label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <FileUp className="size-4" />
            {upload.isPending ? tr("جارٍ الرفع والتحليل…") : tr("رفع PDF")}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={upload.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <ul className="space-y-2 text-sm">
          {docs.data?.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{d.file_name}</span>
                {d.processing_status === "processing" && (
                  <span className="mt-1 block">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full w-1/3 animate-pulse rounded-full bg-primary" />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tr("جارٍ قراءة الصفحات")}{d.page_count ? tr(" ({0} صفحة)", d.page_count) : ""} {tr("— الكتب المصورة والكبيرة (أكثر من 200 صفحة) قد تستغرق عدة دقائق، لا تغلق الصفحة.")}
                    </span>
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                {d.processing_error && <span className="max-w-xs truncate text-destructive">{message(d.processing_error)}</span>}
                <Badge variant="secondary">{docStatusLabel[d.processing_status] ?? d.processing_status}</Badge>
                {d.processing_status === "failed" && (
                  <Button size="sm" variant="outline" onClick={() => process({ data: { documentId: d.id, language } }).then(refresh, (e) => toast.error(message(e.message)))}>
                    {tr("إعادة")}
                  </Button>
                )}
              </span>
            </li>
          ))}
          {!docs.data?.length && <li className="text-muted-foreground">{tr("لم يُرفع أي ملف بعد.")}</li>}
        </ul>
      </section>

      <TeacherMaterialsPanel courseId={courseId} />
      <PacingPanel courseId={courseId} />

      {c && <AssessmentWorkspace courseId={courseId} curriculum={c} refresh={refresh} />}

      <StudentReports courseId={courseId} />
    </AppShell>
  );
}

type Report = {
  id: string;
  studentName: string;
  activityTitle: string;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
  teacherComment: string | null;
  retakeGranted: boolean;
  answers: { stem: string; choice: string | null; correctAnswer: string | null; isCorrect: boolean | null; score: number | null; points: number }[];
};

function StudentReports({ courseId }: { courseId: string }) {
  const { tr, locale, message } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["course-reports", courseId],
    queryFn: () => listCourseReports({ data: { courseId } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["course-reports", courseId] });

  const retake = useMutation({
    mutationFn: (attemptId: string) => grantRetake({ data: { attemptId } }),
    onSuccess: () => { toast.success(tr("تم السماح للطالب بإعادة الحل")); refresh(); },
    onError: (e: Error) => toast.error(message(e.message)),
  });
  const comment = useMutation({
    mutationFn: (a: { attemptId: string; comment: string }) => setTeacherComment({ data: a }),
    onSuccess: () => { toast.success(tr("تم حفظ التعليق — سيظهر للطالب وولي أمره")); refresh(); },
    onError: (e: Error) => toast.error(message(e.message)),
  });

  const reports = (data?.reports ?? []) as Report[];
  return (
    <section className="surface mt-8 rounded-2xl p-5">
      <h2 className="mb-3 font-display text-lg font-bold">{tr("تقارير الطلاب")}</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{tr("جارٍ التحميل…")}</p>
      ) : !reports.length ? (
        <p className="text-sm text-muted-foreground">{tr("لم يسلّم أي طالب نشاطاً بعد.")}</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.studentName === "طالب" ? tr("طالب") : r.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.activityTitle} · {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString(locale) : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={Number(r.score) / Number(r.maxScore || 1) >= 0.5 ? "default" : "destructive"}>
                    {r.score ?? 0} / {r.maxScore ?? 0}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    {open === r.id ? tr("إخفاء الإجابات") : tr("عرض الإجابات")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={r.retakeGranted || retake.isPending}
                    onClick={() => retake.mutate(r.id)}
                  >
                    {r.retakeGranted ? tr("إعادة الحل مفتوحة") : tr("السماح بإعادة الحل")}
                  </Button>
                </div>
              </div>

              {open === r.id && (
                <ul className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                  {r.answers.map((an, i) => (
                    <li key={i} className="rounded-lg bg-muted/50 p-3">
                      <p className="mb-1 font-medium">{i + 1}. {an.stem}</p>
                      <p>
                        {tr("إجابة الطالب:")} <span className={an.isCorrect ? "text-primary" : "text-destructive"}>{an.choice ?? "—"}</span>
                        {an.isCorrect ? " ✓" : tr(" — الصحيحة: {0}", an.correctAnswer ?? "—")}
                      </p>
                    </li>
                  ))}
                  {!r.answers.length && <li className="text-muted-foreground">{tr("لا توجد إجابات مسجلة.")}</li>}
                </ul>
              )}

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  comment.mutate({ attemptId: r.id, comment: drafts[r.id] ?? r.teacherComment ?? "" });
                }}
              >
                <Input
                  placeholder={tr("تعليقك على نتيجة الطالب (يظهر للطالب وولي أمره)")}
                  value={drafts[r.id] ?? r.teacherComment ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                />
                <Button type="submit" size="sm" disabled={comment.isPending}>{tr("حفظ التعليق")}</Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
