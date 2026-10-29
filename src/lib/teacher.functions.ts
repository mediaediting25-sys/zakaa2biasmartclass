import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertTeacher(supabase: any, courseId: string) {
  const { data, error } = await supabase.rpc("is_course_teacher", { _course_id: courseId });
  if (error || !data) throw new Error("غير مصرح — not the course teacher");
}

/** Index a PDF and extract a grounded curriculum draft (never auto-published). */
export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("id, course_id, storage_path, category")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error || !doc) throw new Error("المستند غير موجود — document not found");
    await assertTeacher(context.supabase, doc.course_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { indexDocument, extractCurriculum } = await import("@/server/ai/pipelines.server");
    const { data: job } = await supabaseAdmin
      .from("ai_jobs")
      .insert({
        course_id: doc.course_id,
        document_id: doc.id,
        created_by: context.userId,
        job_type: "extract_curriculum",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    await supabaseAdmin.from("documents").update({ processing_status: "processing", processing_error: null }).eq("id", doc.id);
    try {
      const pages = await indexDocument(supabaseAdmin, doc);
      const result =
        doc.category === "curriculum"
          ? await extractCurriculum(supabaseAdmin, doc, pages)
          : { units: 0, lessons: 0, warnings: [] as string[] };
      await supabaseAdmin.from("documents").update({ processing_status: "processed" }).eq("id", doc.id);
      if (job) await supabaseAdmin.from("ai_jobs").update({ status: "succeeded", result, finished_at: new Date().toISOString() }).eq("id", job.id);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("documents").update({ processing_status: "failed", processing_error: msg }).eq("id", doc.id);
      if (job) await supabaseAdmin.from("ai_jobs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", job.id);
      throw new Error(msg);
    }
  });

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lessonId: z.string().uuid(), count: z.number().int().min(1).max(15) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: lesson } = await context.supabase.from("lessons").select("course_id").eq("id", data.lessonId).maybeSingle();
    if (!lesson) throw new Error("الدرس غير موجود");
    await assertTeacher(context.supabase, lesson.course_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateLessonQuestions } = await import("@/server/ai/pipelines.server");
    return generateLessonQuestions(supabaseAdmin, data.lessonId, { count: data.count });
  });

/**
 * Generate questions styled after the course's previous exams:
 * extracts pattern guidance from uploaded exam PDFs, then generates
 * grounded questions (never copying exam text verbatim).
 */
export const generateExamStyleQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lessonId: z.string().uuid(), count: z.number().int().min(1).max(15) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: lesson } = await context.supabase.from("lessons").select("course_id").eq("id", data.lessonId).maybeSingle();
    if (!lesson) throw new Error("الدرس غير موجود");
    await assertTeacher(context.supabase, lesson.course_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: examDocs } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("course_id", lesson.course_id)
      .eq("category", "previous_exams")
      .eq("processing_status", "processed");
    if (!examDocs?.length)
      throw new Error("لا توجد امتحانات سابقة محلّلة — ارفع ملف امتحانات وانتظر تحليله أولًا.");

    const { data: pages } = await supabaseAdmin
      .from("source_pages")
      .select("text_content")
      .in("document_id", examDocs.map((d) => d.id))
      .order("page_number")
      .limit(30);
    const examText = (pages ?? [])
      .map((p) => (p.text_content ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, 60_000);
    if (!examText) throw new Error("ملفات الامتحانات بلا نص قابل للقراءة.");

    const { getProvider } = await import("@/server/ai/gateway.server");
    const patterns = await getProvider().generateJson<{ patterns: string }>({
      schemaName: "exam_patterns",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["patterns"],
        properties: { patterns: { type: "string" } },
      },
      effort: "low",
      system:
        "You analyze past school exams and summarize their STYLE only: question formats used, wording conventions, difficulty distribution, marks weighting, common skill focus. Never quote or copy actual exam questions. Output concise bullet points in the exam's language.",
      user: `PAST EXAMS:\n${examText}`,
    });

    const { generateLessonQuestions } = await import("@/server/ai/pipelines.server");
    return generateLessonQuestions(supabaseAdmin, data.lessonId, {
      count: data.count,
      examPatterns: patterns.patterns,
    });
  });

/** Value of a stored correct answer ({value} object or raw string). */
export function answerValue(a: unknown): string | null {
  if (a == null) return null;
  if (typeof a === "object" && "value" in (a as any)) return String((a as any).value);
  return String(a);
}

/** Why an approved question can't be published (empty list = OK). */
export function questionGateIssues(q: { options: unknown; correct_answer: unknown; source_page: number | null; source_quote: string | null }) {
  const issues: string[] = [];
  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
  const ans = answerValue(q.correct_answer);
  if (opts.length < 2) issues.push("خيارات ناقصة");
  if (!ans || !opts.includes(ans)) issues.push("الإجابة الصحيحة غير موجودة ضمن الخيارات");
  if (!q.source_page || !q.source_quote?.trim()) issues.push("بلا صفحة أو اقتباس من الكتاب");
  return issues;
}

/** Hierarchical publish gate: approved+grounded question → activity → lesson → unit → course. */
export const publishCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertTeacher(sb, data.courseId);
    const [qs, acts, lessons] = await Promise.all([
      sb.from("questions").select("id, stem, activity_id, options, correct_answer, source_page, source_quote, status").eq("course_id", data.courseId).in("status", ["approved", "published"]),
      sb.from("activities").select("id, lesson_id").eq("course_id", data.courseId),
      sb.from("lessons").select("id, unit_id").eq("course_id", data.courseId),
    ]);
    const rejected: { stem: string; reasons: string[] }[] = [];
    const good = (qs.data ?? []).filter((q: any) => {
      const r = questionGateIssues(q);
      if (r.length) rejected.push({ stem: q.stem.slice(0, 60), reasons: r });
      return !r.length;
    });
    if (!good.length) {
      throw new Error("لا يمكن النشر: لا يوجد سؤال معتمد مكتمل وموثّق بالمصدر" + (rejected[0] ? ` (${rejected[0].reasons.join("، ")})` : ""));
    }
    const actIds = new Set(good.map((q: any) => q.activity_id));
    const lessonIds = new Set((acts.data ?? []).filter((a: any) => actIds.has(a.id)).map((a: any) => a.lesson_id).filter(Boolean));
    const unitIds = new Set((lessons.data ?? []).filter((l: any) => lessonIds.has(l.id)).map((l: any) => l.unit_id));
    const upd = async (table: string, ids: string[]) => {
      if (!ids.length) return;
      const { error } = await sb.from(table as any).update({ status: "published" }).in("id", ids);
      if (error) throw new Error(error.message);
    };
    await upd("questions", good.map((q: any) => q.id));
    await upd("activities", [...actIds] as string[]);
    await upd("lessons", [...lessonIds] as string[]);
    await upd("units", [...unitIds] as string[]);
    const { error } = await sb.from("courses").update({ status: "published" }).eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { published: good.length, rejected };
  });
