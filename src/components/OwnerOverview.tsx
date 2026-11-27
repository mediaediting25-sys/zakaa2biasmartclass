import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/lib/i18n";
import { getOwnerOverview } from "@/lib/owner-overview.functions";
import { ENDING_SOON_DAYS, type TeacherStatus } from "@/lib/owner-overview";

export function OwnerOverview() {
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
        <span className="rounded-full border border-border px-3 py-0.5 text-xs font-bold text-primary">{tr("للمالك فقط")}</span>
      </div>
      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">{tr("جارٍ التحميل…")}</p>
      ) : isError || !data ? (
        <p role="alert" className="text-sm text-destructive">{tr("تعذر تحميل النظرة العامة")}</p>
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
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border p-3 text-sm">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold">{t.name || tr("معلم")}</p>
                    <p dir="ltr" className="break-all text-start text-xs text-muted-foreground">{t.email}</p>
                  </div>
                  <span>{tr("المقررات")}: <b>{t.courses}</b></span>
                  <span>{tr("الطلاب")}: <b>{t.students}</b></span>
                  <span className={"rounded-full px-3 py-0.5 text-xs font-bold " + statusClass[t.status]}>{statusLabel[t.status]}</span>
                  {t.status !== "owner" && <span className="text-muted-foreground">{tr(t.status === "upcoming" ? "يبدأ" : "ينتهي")}: {date(t.endsAt)}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
