import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { presentationSchema } from "@/lib/lesson-tools";
import { getProvider } from "./gateway.server";
import { quoteSupport } from "./grounding.server";

export async function buildPresentation(sb: SupabaseClient<Database>, lessonId: string, language: "ar" | "en", age: number, options: { count: number; topic: string; grade: string }) {
  const { data: lesson, error } = await sb.from("lessons").select("*, courses(grade_level, subject)").eq("id", lessonId).single();
  if (error || !lesson) throw new Error("الدرس غير موجود");
  const { data: objectives } = await sb.from("objectives").select("description").eq("lesson_id", lessonId);
  if (!lesson.source_document_id || !lesson.source_page) throw new Error("لا توجد صفحات مصدر لهذا الدرس");
  const { data: next } = await sb.from("lessons").select("source_page").eq("source_document_id", lesson.source_document_id).gt("source_page", lesson.source_page).order("source_page").limit(1).maybeSingle();
  const { data: pages, error: pageError } = await sb.from("source_pages").select("page_number, text_content").eq("document_id", lesson.source_document_id).gte("page_number", lesson.source_page).lt("page_number", next?.source_page ?? lesson.source_page + 12).order("page_number").limit(12);
  if (pageError) throw pageError;
  if (!pages?.some(p => p.text_content?.trim())) throw new Error("لا توجد نصوص مفهرسة لهذا الدرس");
  const strings = { type: "string" };
  const raw = await getProvider().generateJson<unknown>({
    schemaName: "lesson_adventure",
    schema: { type: "object", additionalProperties: false, required: ["title", "slides"], properties: {
      title: strings, slides: { type: "array", items: { type: "object", additionalProperties: false,
        required: ["title", "narrative", "points", "challenge", "options", "correctAnswer", "explanation", "sourcePage", "sourceQuote"],
        properties: { title: strings, narrative: strings, points: { type: "array", items: strings }, challenge: strings, options: { type: "array", items: strings }, correctAnswer: strings, explanation: strings, sourcePage: { type: "integer" }, sourceQuote: strings } } } } },
    system: `Create a complete interactive lesson adventure in ${language === "ar" ? "Arabic" : "English"} for age ${age}, grade ${lesson.courses?.grade_level ?? "school"}. Use 6-12 stations: opening mission, detailed explanation of EVERY lesson concept, worked source examples, interactive checkpoints and recap. Story framing is fictional but every educational fact must be supported by SOURCE. Never invent curricular facts or omit objectives. Include a short verbatim sourceQuote in its original language and sourcePage for every station. Use clear age-appropriate prose and short points. For checkpoint slides provide 2-4 options with one exact correctAnswer and explanation. For other slides challenge, correctAnswer and explanation are empty strings and options is empty. No HTML or markdown.`,
    user: `LESSON: ${lesson.title}\nTARGET TOPIC: ${options.topic || "entire lesson"}. Limit explanation and questions to this topic; ignore other objectives when a topic is selected.\nTARGET GRADE: ${options.grade || lesson.courses?.grade_level || "school"}\nCreate exactly ${options.count} interactive checkpoint questions; total stations 3-16.\nSUMMARY: ${lesson.summary ?? ""}\nOBJECTIVES: ${(objectives ?? []).map(o => o.description).join("; ")}\nSOURCE:\n${pages.map(p => `[p.${p.page_number}] ${p.text_content}`).join("\n\n")}`,
  });
  const result = presentationSchema.parse(raw);
  if (result.slides.filter(slide => slide.challenge.trim()).length !== options.count) throw new Error("عدد أسئلة العرض لا يطابق العدد المطلوب؛ لم يتم حفظه");
  for (const slide of result.slides) {
    const page = pages.find(p => p.page_number === slide.sourcePage);
    if (quoteSupport(slide.sourceQuote, page?.text_content ?? "") < 0.85) throw new Error("العرض يحتاج مصدرًا موثّقًا؛ لم يتم حفظه");
    if (slide.challenge && (slide.options.length < 2 || !slide.options.includes(slide.correctAnswer))) throw new Error("سؤال العرض غير مكتمل؛ لم يتم حفظه");
  }
  return { ...result, courseId: lesson.course_id };
}
