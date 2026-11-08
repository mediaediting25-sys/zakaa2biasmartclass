import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/useSession";
import { createCourse, listMyCourses } from "@/lib/api";
import { getTeacherDashboard } from "@/lib/teacher-dashboard.functions";
import { TeacherDirectoryPanel } from "@/components/TeacherDirectoryPanel";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({
    meta: [
      { property: "og:title", content: "لوحة المعلم — ذكاؤبيا سمارت كلاس" },
      { property: "og:description", content: "إدارة المقررات والملفات وتقارير الطلاب في ذكاؤبيا سمارت كلاس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "لوحة المعلم — ذكاؤبيا سمارت كلاس" },
      { name: "description", content: "إدارة المقررات والملفات وتقارير الطلاب في ذكاؤبيا سمارت كلاس." },
    ],
  }),
  component: TeacherHome,
});

function TeacherHome() {
  const { tr, locale, message } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: listMyCourses });
  const dashboard = useQuery({ queryKey: ["teacher-dashboard"], queryFn: () => getTeacherDashboard() });
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

  const rows = (dashboard.data?.students ?? []).filter(
    (s) => selectedCourse === "all" || s.courseId === selectedCourse,
  );

  const create = useMutation({
    mutationFn: () =>
      {
      if (!user) throw new Error("Please sign in");
      return createCourse({ title, subject, grade_level: grade, content_language: "ar", teacher_id: user.id });
    },
    onSuccess: () => {
      setTitle("");
      setSubject("");
      setGrade("");
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success(tr("تم إنشاء المقرر"));
    },
    onError: (e: Error) => toast.error(message(e.message)),
  });

  return (
    <AppShell title={tr("لوحة المعلم")} subtitle={tr("مقرراتك ومحتواها المعتمد")} homeTo="/teacher">
      <form
        className="surface mb-8 grid gap-3 rounded-2xl p-4 sm:grid-cols-[2fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && user) create.mutate();
        }}
      >
        <Input placeholder={tr("اسم المقرر")} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input placeholder={tr("المادة")} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Input placeholder={tr("الصف")} value={grade} onChange={(e) => setGrade(e.target.value)} />
        <Button type="submit" disabled={create.isPending}>
          <Plus className="size-4" /> {tr("مقرر جديد")}
        </Button>
      </form>

      {courses.isLoading ? (
        <p className="text-muted-foreground">{tr("جارٍ التحميل…")}</p>
      ) : !courses.data?.length ? (
        <p className="text-muted-foreground">{tr("لا توجد مقررات بعد. أنشئ أول مقرر بالأعلى.")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data.map((c) => (
            <Link
              key={c.id}
              to="/course/$courseId"
              params={{ courseId: c.id }}
              className="surface rounded-2xl p-5 transition-shadow hover:shadow-lg"
            >
              <div className="mb-3 flex items-center justify-between">
                <BookOpen className="size-5 text-primary" />
                <Badge variant={c.status === "published" ? "default" : "secondary"}>
                  {c.status === "published" ? tr("منشور") : tr("مسودة")}
                </Badge>
              </div>
              <h3 className="font-display text-lg font-bold">{c.title}</h3>
              <p className="text-sm text-muted-foreground">
                {[c.subject, c.grade_level].filter(Boolean).join(" · ") || "—"}
              </p>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Users className="size-5 text-primary" /> {tr("طلاب المواد")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedCourse === "all" ? "default" : "outline"}
              onClick={() => setSelectedCourse("all")}
            >
              {tr("كل المواد")}
            </Button>
            {(dashboard.data?.courses ?? []).map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={selectedCourse === c.id ? "default" : "outline"}
                onClick={() => setSelectedCourse(c.id)}
              >
                {c.title}
              </Button>
            ))}
          </div>
        </div>

        {dashboard.isLoading ? (
          <p className="text-muted-foreground">{tr("جارٍ تحميل الطلاب…")}</p>
        ) : dashboard.isError ? (
          <p className="text-muted-foreground">{tr("تعذر تحميل بيانات الطلاب.")}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">{tr("لا يوجد طلاب مسجلون بعد في هذه المادة.")}</p>
        ) : (
          <div className="surface overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-start text-muted-foreground">
                  <th className="p-3 text-start font-medium">{tr("الطالب")}</th>
                  <th className="p-3 text-start font-medium">{tr("المادة")}</th>
                  <th className="p-3 text-start font-medium">{tr("التقدم")}</th>
                  <th className="p-3 text-start font-medium">{tr("النتيجة")}</th>
                  <th className="p-3 text-start font-medium">{tr("الحالة")}</th>
                  <th className="p-3 text-start font-medium">{tr("التقرير")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const course = dashboard.data?.courses.find((c) => c.id === s.courseId);
                  return (
                    <tr key={`${s.courseId}-${s.studentId}`} className="border-b border-border/50 last:border-0">
                      <td className="p-3">
                        <div className="font-medium">{s.name === "طالب" ? tr("طالب") : s.name}</div>
                        {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                      </td>
                      <td className="p-3">{course?.title ?? "—"}</td>
                      <td className="p-3">
                        {s.completed}/{s.total} {tr("نشاط")}
                      </td>
                      <td className="p-3">
                        {s.percentage !== null ? `${s.percentage}%` : "—"}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            s.status === "completed"
                              ? "default"
                              : s.status === "in_progress"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {s.status === "completed"
                            ? tr("أكمل كل الأنشطة")
                            : s.status === "in_progress"
                              ? tr("قيد التقدم")
                              : tr("لم يبدأ")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Link
                          to="/course/$courseId"
                          params={{ courseId: s.courseId }}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {tr("عرض التقرير")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {user && <TeacherDirectoryPanel userId={user.id} courses={courses.data ?? []} />}
    </AppShell>
  );
}
