import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLiveAccount } from "@/lib/live-account-middleware";
import { buildPlan } from "./pacing";
import { requireTeacherAccess } from "./teacher-access";

export const saveCoursePlan = createServerFn({ method: "POST" }).middleware([requireLiveAccount])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid(), start: z.string().date(), end: z.string().date(), perPeriod: z.number().int().min(1).max(30), period: z.enum(["week", "month"]), reviewPerUnit: z.boolean() }).refine(d => d.end >= d.start && d.perPeriod <= (d.period === "week" ? 7 : 30), "Invalid plan dates or frequency").parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_course_teacher", { _course_id: data.courseId });
    if (error || !allowed) throw new Error("غير مصرح");
    await requireTeacherAccess(context.supabase);
    const [units, lessons] = await Promise.all([
      context.supabase.from("units").select("id, title").eq("course_id", data.courseId).neq("status", "rejected").order("position"),
      context.supabase.from("lessons").select("id, unit_id, title").eq("course_id", data.courseId).neq("status", "rejected").order("position"),
    ]);
    if (units.error || lessons.error) throw new Error("تعذر تحميل المنهج");
    const schedule = buildPlan({ ...data, units: units.data ?? [], lessons: lessons.data ?? [] });
    if (!schedule.length) throw new Error("ارفع المنهج وحلّله أولاً");
    const { error: saveError } = await context.supabase.from("course_plans").upsert({ course_id: data.courseId, start_date: data.start, end_date: data.end, sessions_per_period: data.perPeriod, period: data.period, review_per_unit: data.reviewPerUnit, schedule }, { onConflict: "course_id" });
    if (saveError) throw saveError;
    return { schedule };
  });

export const generatePresentation = createServerFn({ method: "POST" }).middleware([requireLiveAccount])
  .inputValidator((d: unknown) => z.object({ lessonId: z.string().uuid(), language: z.enum(["ar", "en", "both"]), age: z.number().int().min(4).max(22), count: z.number().int().min(1).max(10).default(3), topic: z.string().trim().max(300).default(""), grade: z.string().trim().max(80).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lesson } = await context.supabase.from("lessons").select("course_id").eq("id", data.lessonId).maybeSingle();
    if (!lesson) throw new Error("الدرس غير موجود");
    const { data: allowed } = await context.supabase.rpc("is_course_teacher", { _course_id: lesson.course_id });
    if (!allowed) throw new Error("غير مصرح");
    await requireTeacherAccess(context.supabase);
    const { buildPresentation } = await import("@/server/ai/presentations.server");
    const languages: ("ar" | "en")[] = data.language === "both" ? ["ar", "en"] : [data.language];
    const rows = [];
    for (const language of languages) {
      const result = await buildPresentation(context.supabase, data.lessonId, language, data.age, data);
      rows.push({ lesson_id: data.lessonId, course_id: result.courseId, language, title: result.title, slides: result.slides, created_by: context.userId, status: "draft" as const });
    }
    const { data: saved, error } = await context.supabase.from("lesson_presentations").insert(rows).select("id");
    if (error) throw error;
    return saved;
  });
