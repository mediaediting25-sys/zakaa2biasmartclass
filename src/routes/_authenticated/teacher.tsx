import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ChevronDown, ChevronUp, Plus, TrendingUp, Users } from "lucide-react";
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
import { TeacherSubscription } from "@/components/SubscriptionManager";
import { useRole } from "@/hooks/useSession";

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

type DashboardData = NonNullable<Awaited<ReturnType<typeof getTeacherDashboard>>>;

function TeacherHome() {
  const { tr, message } = useI18n();
  const { user } = useSession();
  const role = useRole(user);
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: listMyCourses });
  const dashboard = useQuery({ queryKey: ["teacher-dashboard"], queryFn: () => getTeacherDashboard() });
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

  const data = dashboard.data as DashboardData | undefined;
  const dashReady = dashboard.isSuccess && !!data;
  const groups = data?.courses ?? [];
  const students = data?.students ?? [];

  const totalStudents = new Set(students.map((s) => s.studentId)).size;
  const percents = students.filter((s) => s.percentage !== null).map((s) => s.percentage as number);
  const avgProgress = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null;

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
      qc.invalidateQueries({ queryKey: ["teacher-dashboard"] });
      toast.success(tr("تم إنشاء المقرر"));
    },
    onError: (e: Error) => toast.error(message(e.message)),
  });

  return (
    <AppShell title={tr("لوحة المعلم")} subtitle={tr("مجموعاتك وطلابك وتقاريرهم في مكان واحد")} homeTo="/teacher">
      {user && role.data === "teacher" && <TeacherSubscription userId={user.id} />}
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

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="surface flex items-center gap-3 rounded-2xl p-4">
          <BookOpen className="size-6 shrink-0 text-primary" />
          <div>
            <div className="text-2xl font-bold">{dashReady ? groups.length : "—"}</div>
            <div className="text-sm text-muted-foreground">{tr("مجموعات (مقررات)")}</div>
          </div>
        </div>
        <div className="surface flex items-center gap-3 rounded-2xl p-4">
          <Users className="size-6 shrink-0 text-primary" />
          <div>
            <div className="text-2xl font-bold">{dashReady ? totalStudents : "—"}</div>
            <div className="text-sm text-muted-foreground">{tr("إجمالي الطلاب")}</div>
          </div>
        </div>
        <div className="surface flex items-center gap-3 rounded-2xl p-4">
          <TrendingUp className="size-6 shrink-0 text-primary" />
          <div>
            <div className="text-2xl font-bold">{dashReady && avgProgress !== null ? `${avgProgress}%` : "—"}</div>
            <div className="text-sm text-muted-foreground">{tr("متوسط النتائج")}</div>
          </div>
        </div>
      </div>

      {dashboard.isLoading ? (
        <p className="text-muted-foreground">{tr("جارٍ التحميل…")}</p>
      ) : dashboard.isError ? (
        <p className="text-muted-foreground">{tr("تعذر تحميل بيانات الطلاب.")}</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">{tr("لا توجد مقررات بعد. أنشئ أول مقرر بالأعلى.")}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g, index) => {
            const rows = students.filter((s) => s.courseId === g.id);
            const groupPercents = rows.filter((r) => r.percentage !== null).map((r) => r.percentage as number);
            const groupAvg = groupPercents.length
              ? Math.round(groupPercents.reduce((a, b) => a + b, 0) / groupPercents.length)
              : null;
            const isOpen = openMap[g.id] ?? index === 0;
            return (
              <section key={g.id} className="surface overflow-hidden rounded-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BookOpen className="size-5 shrink-0 text-primary" />
                      <Link
                        to="/course/$courseId"
                        params={{ courseId: g.id }}
                        className="font-display text-lg font-bold underline-offset-4 hover:underline"
                      >
                        {g.title}
                      </Link>
                      <Badge variant={g.status === "published" ? "default" : "secondary"}>
                        {g.status === "published" ? tr("منشور") : tr("مسودة")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[g.subject, g.grade_level].filter(Boolean).join(" · ") || "—"}
                      {" · "}
                      {tr("{0} طالب", rows.length)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {groupAvg !== null && (
                      <div className="hidden text-center sm:block">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${groupAvg}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {tr("متوسط نتائج المجموعة {0}%", groupAvg)}
                        </span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenMap((m) => ({ ...m, [g.id]: !isOpen }))}
                    >
                      {isOpen ? (
                        <>
                          <ChevronUp className="size-4" /> {tr("إخفاء التفاصيل")}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-4" /> {tr("عرض التفاصيل")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  rows.length === 0 ? (
                    <p className="border-t border-border p-5 text-sm text-muted-foreground">
                      {tr("لا يوجد طلاب مسجلون بعد في هذه المجموعة.")}
                    </p>
                  ) : (
                    <div className="overflow-x-auto border-t border-border">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="text-start text-muted-foreground">
                            <th className="p-3 text-start font-medium">{tr("الطالب")}</th>
                            <th className="p-3 text-start font-medium">{tr("التقدم")}</th>
                            <th className="p-3 text-start font-medium">{tr("النسبة")}</th>
                            <th className="p-3 text-start font-medium">{tr("الحالة")}</th>
                            <th className="p-3 text-start font-medium">{tr("التقرير")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s) => (
                            <tr key={`${s.courseId}-${s.studentId}`} className="border-t border-border/50">
                              <td className="p-3">
                                <div className="font-medium">{s.name === "طالب" ? tr("طالب") : s.name}</div>
                                {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary"
                                      style={{ width: `${s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0}%` }}
                                    />
                                  </div>
                                  <span>
                                    {s.completed}/{s.total} {tr("نشاط")}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3">{s.percentage !== null ? `${s.percentage}%` : "—"}</td>
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </section>
            );
          })}
        </div>
      )}

      {user && <TeacherDirectoryPanel userId={user.id} courses={courses.data ?? []} />}
    </AppShell>
  );
}
