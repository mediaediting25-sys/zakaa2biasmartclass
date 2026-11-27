import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/lib/i18n";
import { getOwnerOverview, getTeacherDetail } from "@/lib/owner-overview.functions";
import { ENDING_SOON_DAYS, type TeacherStatus } from "@/lib/owner-overview";

function TeacherDetailView({ teacherId, onBack, statusLabel, statusClass, date }: {
  teacherId: string;
  onBack: () => void;
  statusLabel: Record<TeacherStatus, string>;
  statusClass: Record<TeacherStatus, string>;
  date: (v: string | null) => string;
}) {
  const { tr } = useI18n();
  const { user } = useSession();
  const load = useServerFn(getTeacherDetail);
  const { data, isPending, isError } = useQuery({
    queryKey: ["owner-teacher-detail", user?.id, teacherId],
    enabled: !!user,
    queryFn: () => load({ data: { teacherId } }),
    retry: false,
  });
  const courseStatus: Record<string, string> = { published: tr("منشور"), draft: tr("مسودة"), archived: tr("مؤرشف") };
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 text-sm font-semibold text-primary">{tr("رجوع لكل المعلمين")}</button>
      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">{tr("جارٍ التحميل…")}</p>
      ) : isError || !data ? (
        <p role="alert" className="text-sm text-destructive">{tr("تعذر تحميل تفاصيل المعلم")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-xl font-bold">{data.teacher.name || tr("معلم")}</h3>
              <p dir="ltr" className="break-all text-start text-sm text-muted-foreground">{data.teacher.email}</p>
            </div>
            <span className={"rounded-full px-3 py-0.5 text-xs font-bold " + statusClass[data.teacher.status]}>
              {statusLabel[data.teacher.status]}{data.teacher.status !== "owner" && data.teacher.endsAt ? " · " + date(data.teacher.endsAt) : ""}
            </span>
          </div>
          <div className="my-4 grid grid-cols-3 gap-3">
            {[
              [data.teacher.courses, tr("المقررات")],
              [data.teacher.students, tr("الطلاب")],
              [data.averagePercentage === null ? "—" : data.averagePercentage + "%", tr("متوسط النتائج")],
            ].map(([n, label], i) => (
              <div key={i} className="min-w-0 rounded-xl border border-border p-3">
                <b className="block font-display text-2xl text-primary">{n}</b>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <h4 className="mb-2 font-semibold">{tr("المقررات")}</h4>
          {!data.courses.length ? (
            <p className="mb-4 text-sm text-muted-foreground">{tr("لا توجد مقررات بعد.")}</p>
          ) : (
            <ul className="mb-4 space-y-2">
              {data.courses.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border p-3 text-sm">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{[c.subject, c.grade].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-bold">{courseStatus[c.status] ?? c.status}</span>
                  <span>{tr("الطلاب")}: <b>{c.students}</b></span>
                </li>
              ))}
            </ul>
          )}

          <h4 className="mb-2 font-semibold">{tr("الطلاب")}</h4>
          {!data.students.length ? (
            <p className="text-sm text-muted-foreground">{tr("لا يوجد طلاب منضمون بعد.")}</p>
          ) : (
            <ul className="space-y-2">
              {data.students.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border p-3 text-sm">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold">{s.name === "طالب" ? tr("طالب") : s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.courseTitle}</p>
                  </div>
                  <span>{tr("أنشطة مكتملة")}: <b>{s.completed}</b></span>
                  <span>{tr("متوسط النتيجة")}: <b>{s.percentage === null ? "—" : s.percentage + "%"}</b></span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function OwnerOverview() {
  const [selected, setSelected] = useState<string | null>(null);
  const { tr, locale } = useI18n();
  const { user } = useSession();
  const load = useServerFn(getOwnerOverview);
  const { data, isPending, isError } = useQuery({ queryKey: ["owner-overview", user?.id], enabled: !!user, queryFn: () => load(), retry: false });
  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") : "—");
  const statusLabel: Record<TeacherStatus, string> = {
    active: tr("ساري"),
    soon: tr("ينتهي قريباً"),
    expired: tr("منتهي"),
    none: tr("بدون اشتراك"),
    trial: tr("تجربة"),
    upcoming: tr("يبدأ لاحقاً"),
    owner: tr("مالك المنصة"),
  };
  const statusClass: Record<TeacherStatus, string> = {
    active: "bg-primary/15 text-primary",
    soon: "bg-warning text-warning-foreground",
    expired: "bg-destructive/15 text-destructive",
    none: "bg-muted text-muted-foreground",
    trial: "bg-primary/15 text-primary",
    upcoming: "bg-muted text-foreground",
    owner: "bg-primary/15 text-primary",
  };

  return (
    <section className="surface mb-6 rounded-2xl p-5" aria-label={tr("نظرة عامة على المنصة")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{tr("نظرة عامة على المنصة")}</h2>
        <span className="rounded-full border border-border px-3 py-0.5 text-xs font-bold text-primary">{tr("للمالك والإدارة العامة فقط")}</span>
      </div>
      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">{tr("جارٍ التحميل…")}</p>
      ) : isError || !data ? (
        <p role="alert" className="text-sm text-destructive">{tr("تعذر تحميل النظرة العامة")}</p>
      ) : selected ? (
        <TeacherDetailView teacherId={selected} onBack={() => setSelected(null)} statusLabel={statusLabel} statusClass={statusClass} date={date} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [data.totals.teachers, tr("معلمون")],
              [data.totals.students, tr("طلاب")],
              [data.totals.parents, tr("أولياء أمور")],
              [data.totals.admins, tr("مديرون")],
              [data.totals.courses, tr("مقررات ({0} منشور · {1} مسودة · {2} مؤرشف)", data.totals.publishedCourses, data.totals.draftCourses, data.totals.archivedCourses)],
              [data.totals.enrolledStudents, tr("طلاب منضمون لمقررات")],
              [data.totals.activeSubscriptions, tr("اشتراكات سارية")],
              [data.totals.endingSoon, tr("اشتراكات تنتهي خلال {0} يوم", ENDING_SOON_DAYS)],
            ].map(([n, label], i) => (
              <div key={i} className="min-w-0 rounded-xl border border-border p-3">
                <b className="block font-display text-2xl text-primary">{n}</b>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <h3 className="mb-2 mt-6 font-semibold">{tr("المعلمون والاشتراكات")}</h3>
          {!data.teachers.length ? (
            <p className="text-sm text-muted-foreground">{tr("لا يوجد معلمون بعد.")}</p>
          ) : (
            <ul className="space-y-2">
              {data.teachers.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setSelected(t.id)} className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border p-3 text-start text-sm hover:border-primary">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold">{t.name || tr("معلم")}</p>
                    <p dir="ltr" className="break-all text-start text-xs text-muted-foreground">{t.email}</p>
                  </div>
                  <span>{tr("المقررات")}: <b>{t.courses}</b></span>
                  <span>{tr("الطلاب")}: <b>{t.students}</b></span>
                  <span className={"rounded-full px-3 py-0.5 text-xs font-bold " + statusClass[t.status]}>{statusLabel[t.status]}</span>
                  {t.status !== "owner" && <span className="text-muted-foreground">{tr(t.status === "upcoming" ? "يبدأ" : "ينتهي")}: {date(t.endsAt)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
