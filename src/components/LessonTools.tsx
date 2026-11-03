import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronLeft, ChevronRight, Presentation, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { readSlides, type LessonSlide } from "@/lib/lesson-tools";
import { generatePresentation, saveCoursePlan } from "@/lib/lesson-tools.functions";
import type { PlanSession } from "@/lib/pacing";

export function PacingPanel({ courseId }: { courseId: string }) {
  const { tr, locale, message } = useI18n();
  const qc = useQueryClient();
  const save = useServerFn(saveCoursePlan);
  const plan = useQuery({
    queryKey: ["course-plan", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_plans").select("*").eq("course_id", courseId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<{ start: string; end: string; perPeriod: number; period: "week" | "month"; reviewPerUnit: boolean } | null>(null);
  const f = form ?? {
    start: plan.data?.start_date ?? today,
    end: plan.data?.end_date ?? today,
    perPeriod: plan.data?.sessions_per_period ?? 2,
    period: (plan.data?.period as "week" | "month") ?? "week",
    reviewPerUnit: plan.data?.review_per_unit ?? true,
  };
  const set = (p: Partial<typeof f>) => setForm({ ...f, ...p });
  const m = useMutation({
    mutationFn: () => save({ data: { courseId, ...f } }),
    onSuccess: () => { toast.success(tr("تم حفظ خطة التوزيع")); qc.invalidateQueries({ queryKey: ["course-plan", courseId] }); },
    onError: (e: Error) => toast.error(message(e.message)),
  });
  const schedule = (plan.data?.schedule ?? []) as PlanSession[];

  return (
    <section className="surface mb-8 rounded-2xl p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><CalendarDays className="size-5 text-primary" />{tr("خطة توزيع المنهج")}</h2>
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <label className="text-sm">{tr("تاريخ البداية")}<Input type="date" value={f.start} onChange={(e) => set({ start: e.target.value })} required /></label>
        <label className="text-sm">{tr("تاريخ النهاية")}<Input type="date" value={f.end} min={f.start} onChange={(e) => set({ end: e.target.value })} required /></label>
        <label className="text-sm">{tr("عدد الحصص")}<Input type="number" min={1} max={f.period === "week" ? 7 : 30} value={f.perPeriod} onChange={(e) => set({ perPeriod: Number(e.target.value) })} required /></label>
        <label className="text-sm">{tr("كل")}
          <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={f.period} onChange={(e) => set({ period: e.target.value as "week" | "month" })}>
            <option value="week">{tr("أسبوع")}</option><option value="month">{tr("شهر")}</option>
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.reviewPerUnit} onChange={(e) => set({ reviewPerUnit: e.target.checked })} />{tr("حصة مراجعة بعد كل وحدة")}</label>
          <Button type="submit" disabled={m.isPending}>{m.isPending ? tr("جارٍ الحساب…") : tr("احسب واحفظ الخطة")}</Button>
        </div>
      </form>
      {schedule.length > 0 && (
        <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground"><th className="p-2 text-start">#</th><th className="p-2 text-start">{tr("التاريخ")}</th><th className="p-2 text-start">{tr("الأسبوع")}</th><th className="p-2 text-start">{tr("المحتوى")}</th></tr></thead>
            <tbody>
              {schedule.map((s) => (
                <tr key={s.index} className="border-b border-border/50 last:border-0">
                  <td className="p-2">{s.index + 1}</td>
                  <td className="p-2 whitespace-nowrap">{new Date(s.date + "T00:00:00Z").toLocaleDateString(locale, { timeZone: "UTC" })}</td>
                  <td className="p-2">{s.week}</td>
                  <td className="p-2">{s.items.map((it, i) => <span key={i} className="me-2 inline-flex items-center gap-1">{it.type === "review" && <Badge variant="secondary">{tr("مراجعة")}</Badge>}{it.title}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type Pres = { id: string; lesson_id: string; language: string; title: string; slides: unknown; status: string };

export function usePresentations(courseId: string) {
  return useQuery({
    queryKey: ["presentations", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_presentations").select("id, lesson_id, language, title, slides, status").eq("course_id", courseId);
      if (error) throw error;
      return (data ?? []) as Pres[];
    },
  });
}

export function LessonPresentationTools({ courseId, lessonId, presentations }: { courseId: string; lessonId: string; presentations: Pres[] }) {
  const { tr, message } = useI18n();
  const qc = useQueryClient();
  const gen = useServerFn(generatePresentation);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [age, setAge] = useState(12);
  const [show, setShow] = useState<Pres | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["presentations", courseId] });
  const m = useMutation({
    mutationFn: () => gen({ data: { lessonId, language, age } }),
    onSuccess: () => { toast.success(tr("تم توليد العرض — راجعه ثم انشره")); refresh(); },
    onError: (e: Error) => toast.error(message(e.message)),
  });
  const setStatus = useMutation({
    mutationFn: async (a: { id: string; status: "published" | "draft" }) => {
      const { error } = await supabase.from("lesson_presentations").update({ status: a.status }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(message(e.message)),
  });
  const mine = presentations.filter((p) => p.lesson_id === lessonId);

  return (
    <div className="mt-3 rounded-xl border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Presentation className="size-4 text-primary" />
        <span className="font-medium">{tr("عرض رحلة تفاعلية")}</span>
        <select className="h-9 rounded-md border border-input bg-background px-2" value={language} onChange={(e) => setLanguage(e.target.value as "ar" | "en")}>
          <option value="ar">العربية</option><option value="en">English</option>
        </select>
        <label className="flex items-center gap-1">{tr("سن الطالب")}<Input className="h-9 w-16" type="number" min={4} max={22} value={age} onChange={(e) => setAge(Number(e.target.value))} /></label>
        <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? tr("جارٍ التوليد…") : tr("توليد العرض")}</Button>
      </div>
      {mine.map((p) => (
        <div key={p.id} className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{p.language === "ar" ? "AR" : "EN"}</Badge>
          <span className="min-w-0 flex-1 truncate">{p.title}</span>
          <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status === "published" ? tr("منشور") : tr("يحتاج مراجعة")}</Badge>
          <Button size="sm" variant="outline" onClick={() => setShow(p)}>{tr("عرض")}</Button>
          <Button size="sm" onClick={() => setStatus.mutate({ id: p.id, status: p.status === "published" ? "draft" : "published" })}>
            {p.status === "published" ? tr("إلغاء النشر") : tr("نشر للطلاب")}
          </Button>
        </div>
      ))}
      {show && <SlideViewer title={show.title} slides={readSlides(show.slides)} dir={show.language === "ar" ? "rtl" : "ltr"} onClose={() => setShow(null)} />}
    </div>
  );
}

export function SlideViewer({ title, slides, dir, onClose }: { title: string; slides: LessonSlide[]; dir: "rtl" | "ltr"; onClose: () => void }) {
  const { tr } = useI18n();
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const s = slides[i];
  const go = (n: number) => { setI(Math.min(slides.length - 1, Math.max(0, n))); setPick(null); };
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-4 backdrop-blur" dir={dir} role="dialog" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate font-display text-lg font-bold">{title}</h2>
        <span className="text-sm text-muted-foreground">{i + 1} / {slides.length}</span>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label={tr("إغلاق")}><X className="size-5" /></Button>
      </div>
      {s ? (
        <div className="surface mx-auto w-full max-w-3xl flex-1 overflow-y-auto rounded-2xl p-6">
          <h3 className="mb-3 font-display text-2xl font-bold text-primary">{s.title}</h3>
          <p className="mb-4 leading-relaxed">{s.narrative}</p>
          <ul className="mb-4 list-inside list-disc space-y-1">{s.points.map((p, k) => <li key={k}>{p}</li>)}</ul>
          {s.challenge && (
            <div className="rounded-xl border border-primary/40 p-4">
              <p className="mb-2 font-semibold">{s.challenge}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {s.options.map((o) => (
                  <Button key={o} variant={pick === o ? (o === s.correctAnswer ? "default" : "destructive") : "outline"} onClick={() => setPick(o)}>{o}</Button>
                ))}
              </div>
              {pick && <p className="mt-2 text-sm">{pick === s.correctAnswer ? "✓ " : "✗ "}{s.explanation}</p>}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">{tr("المصدر ص")} {s.sourcePage}: «{s.sourceQuote}»</p>
        </div>
      ) : <p className="text-center text-muted-foreground">{tr("لا توجد شرائح")}</p>}
      <div className="mt-3 flex justify-center gap-3">
        <Button variant="outline" onClick={() => go(i - 1)} disabled={i === 0}><ChevronRight className="size-4 ltr:rotate-180" />{tr("السابق")}</Button>
        <Button onClick={() => go(i + 1)} disabled={i >= slides.length - 1}>{tr("التالي")}<ChevronLeft className="size-4 ltr:rotate-180" /></Button>
      </div>
    </div>
  );
}
