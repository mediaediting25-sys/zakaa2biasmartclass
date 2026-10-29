import { z } from "zod";
import { extractText, getDocumentProxy } from "unpdf";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { embed, getProvider } from "./gateway.server";
import { chunkPages, locateQuote } from "./grounding.server";

type Admin = SupabaseClient<Database>;

const GROUNDING_RULES = `
STRICT GROUNDING RULES (non-negotiable):
- Use ONLY the SOURCE text provided. Never add facts, definitions, dates, numbers or examples that are not in the source.
- Every item MUST include "source_page" (the [p.N] marker it came from) and "source_quote": a SHORT verbatim excerpt (5-25 words) copied character-for-character from that page that supports the item.
- If the source is unclear, incomplete, or you are unsure, lower "confidence" (0..1) and add a note to "warnings". Never guess.
- Keep the language of the source (Arabic stays Arabic, English stays English).
- Output must match the JSON schema exactly.`;

/* ---------- Text extraction ---------- */
export async function extractPdfPages(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((t, i) => ({ page: i + 1, text: t ?? "" }));
  const textChars = pages.reduce((n, p) => n + p.text.replace(/\s/g, "").length, 0);
  return { pages, scanned: textChars < 40 * Math.max(1, pages.length * 0.2) };
}

export async function indexDocument(admin: Admin, doc: { id: string; course_id: string; storage_path: string }) {
  const { data: file, error } = await admin.storage.from("course-documents").download(doc.storage_path);
  if (error || !file) throw new Error("تعذّر تحميل الملف — file download failed");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { pages } = await extractPdfPages(bytes.slice());
  const { ocrScannedPages } = await import("./ocr.server");
  await ocrScannedPages(bytes, pages);
  const readable = pages.reduce((n, p) => n + p.text.replace(/\s/g, "").length, 0);
  if (readable < 40)
    throw new Error("تعذّر استخراج نص من الملف حتى بعد قراءة الصور — No readable text found, even after OCR.");

  await admin.from("source_pages").delete().eq("document_id", doc.id);
  await admin.from("source_chunks").delete().eq("document_id", doc.id);
  await admin.from("source_pages").insert(
    pages.map((p) => ({
      document_id: doc.id,
      page_number: p.page,
      text_content: p.text,
      needs_ocr: p.text.trim().length < 20,
    })),
  );
  const chunks = chunkPages(pages);
  const vectors = await embed(chunks.map((c) => c.content));
  for (let s = 0; s < chunks.length; s += 100) {
    const rows = chunks.slice(s, s + 100).map((c, i) => ({
      document_id: doc.id,
      course_id: doc.course_id,
      page_number: c.page,
      chunk_index: c.index,
      content: c.content,
      embedding: JSON.stringify(vectors[s + i]),
    }));
    const { error: insErr } = await admin.from("source_chunks").insert(rows as never);
    if (insErr) throw insErr;
  }
  await admin.from("documents").update({ page_count: pages.length }).eq("id", doc.id);
  return pages;
}

/* ---------- Curriculum extraction ---------- */
const nullableInt = { type: ["integer", "null"] };
const curriculumSchema = {
  type: "object",
  additionalProperties: false,
  required: ["units", "warnings"],
  properties: {
    warnings: { type: "array", items: { type: "string" } },
    units: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "source_page", "confidence", "lessons"],
        properties: {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          source_page: nullableInt,
          confidence: { type: "number" },
          lessons: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "summary", "source_page", "source_quote", "confidence", "objectives"],
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                source_page: nullableInt,
                source_quote: { type: "string" },
                confidence: { type: "number" },
                objectives: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["description", "skill", "source_page", "source_quote"],
                    properties: {
                      description: { type: "string" },
                      skill: { type: "string" },
                      source_page: nullableInt,
                      source_quote: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const CurriculumZ = z.object({
  warnings: z.array(z.string()),
  units: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().nullable(),
      source_page: z.number().int().nullable(),
      confidence: z.number().min(0).max(1),
      lessons: z.array(
        z.object({
          title: z.string().min(1),
          summary: z.string(),
          source_page: z.number().int().nullable(),
          source_quote: z.string(),
          confidence: z.number().min(0).max(1),
          objectives: z.array(
            z.object({
              description: z.string().min(1),
              skill: z.string(),
              source_page: z.number().int().nullable(),
              source_quote: z.string(),
            }),
          ),
        }),
      ),
    }),
  ),
});

export async function extractCurriculum(
  admin: Admin,
  doc: { id: string; course_id: string },
  pages: { page: number; text: string }[],
) {
  const pageMap = new Map(pages.map((p) => [p.page, p.text]));
  let source = pages.map((p) => `[p.${p.page}]\n${p.text.replace(/\s+/g, " ").trim()}`).join("\n\n");
  const warnings: string[] = [];
  if (source.length > 180_000) {
    source = source.slice(0, 180_000);
    warnings.push("الملف طويل جدًا؛ تم تحليل الجزء الأول فقط — Document truncated for analysis.");
  }
  const raw = await getProvider().generateJson<unknown>({
    schemaName: "curriculum",
    schema: curriculumSchema as unknown as Record<string, unknown>,
    effort: "medium",
    system: `You are a meticulous curriculum analyst for K-12 teachers in MENA. Extract the faithful structure of the textbook: units -> lessons -> learning objectives (with a short skill tag). Follow the book's own headings and order.${GROUNDING_RULES}`,
    user: `SOURCE:\n${source}`,
  });
  const parsed = CurriculumZ.parse(raw);
  warnings.push(...parsed.warnings);

  let uPos = 0;
  let lPos = 0;
  let dropped = 0;
  for (const u of parsed.units) {
    const { data: unit, error } = await admin
      .from("units")
      .insert({
        course_id: doc.course_id,
        title: u.title,
        description: u.description,
        position: uPos++,
        confidence: u.confidence,
        source_document_id: doc.id,
        source_page: u.source_page,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    for (const l of u.lessons) {
      const loc = locateQuote(l.source_quote, pageMap, l.source_page);
      const conf = Math.min(l.confidence, loc.score >= 0.85 ? 1 : loc.score * 0.6);
      if (loc.score < 0.5) warnings.push(`درس «${l.title}»: لم يُعثر على الاقتباس في الكتاب — يحتاج مراجعة.`);
      const { data: lesson, error: le } = await admin
        .from("lessons")
        .insert({
          course_id: doc.course_id,
          unit_id: unit.id,
          title: l.title,
          summary: l.summary,
          position: lPos++,
          confidence: Number(conf.toFixed(2)),
          source_document_id: doc.id,
          source_page: loc.page || l.source_page,
          source_quote: l.source_quote,
          status: "draft",
        })
        .select("id")
        .single();
      if (le) throw le;
      const objs = l.objectives
        .map((o) => ({ o, loc: locateQuote(o.source_quote, pageMap, o.source_page) }))
        .filter(({ loc: x }) => {
          if (x.score < 0.4) dropped++;
          return x.score >= 0.4;
        });
      if (objs.length) {
        await admin.from("objectives").insert(
          objs.map(({ o, loc: x }) => ({
            course_id: doc.course_id,
            lesson_id: lesson.id,
            description: o.description,
            skill: o.skill,
            source_document_id: doc.id,
            source_page: x.page || o.source_page,
            source_quote: o.source_quote,
            confidence: Number(x.score.toFixed(2)),
            status: "draft" as const,
          })),
        );
      }
    }
  }
  if (dropped) warnings.push(`تم استبعاد ${dropped} هدف/أهداف لعدم وجود دليل نصي في الكتاب.`);
  return { units: parsed.units.length, lessons: lPos, warnings };
}

/* ---------- Grounded question generation + verifier ---------- */
const questionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions", "warnings"],
  properties: {
    warnings: { type: "array", items: { type: "string" } },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind", "stem", "options", "correct_answer", "accepted_answers",
          "explanation", "difficulty", "skill", "source_page", "source_quote", "confidence",
        ],
        properties: {
          kind: { type: "string", enum: ["multiple_choice", "true_false", "fill_blank", "short_answer"] },
          stem: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_answer: { type: "string" },
          accepted_answers: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "challenge"] },
          skill: { type: "string" },
          source_page: nullableInt,
          source_quote: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
  },
} as const;

const QuestionZ = z.object({
  kind: z.enum(["multiple_choice", "true_false", "fill_blank", "short_answer"]),
  stem: z.string().min(3),
  options: z.array(z.string()),
  correct_answer: z.string().min(1),
  accepted_answers: z.array(z.string()),
  explanation: z.string(),
  difficulty: z.enum(["easy", "medium", "challenge"]),
  skill: z.string(),
  source_page: z.number().int().nullable(),
  source_quote: z.string(),
  confidence: z.number().min(0).max(1),
});
type GenQ = z.infer<typeof QuestionZ>;

const verifySchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "supported", "answer_correct", "distractors_wrong", "single_best_answer", "issues"],
        properties: {
          index: { type: "integer" },
          supported: { type: "boolean" },
          answer_correct: { type: "boolean" },
          distractors_wrong: { type: "boolean" },
          single_best_answer: { type: "boolean" },
          issues: { type: "string" },
        },
      },
    },
  },
} as const;
const VerifyZ = z.object({
  verdicts: z.array(
    z.object({
      index: z.number().int(),
      supported: z.boolean(),
      answer_correct: z.boolean(),
      distractors_wrong: z.boolean(),
      single_best_answer: z.boolean(),
      issues: z.string(),
    }),
  ),
});

function structurallyValid(q: GenQ) {
  if (q.kind === "multiple_choice")
    return q.options.length >= 3 && q.options.filter((o) => o === q.correct_answer).length === 1;
  if (q.kind === "true_false")
    return q.options.length === 2 && q.options.includes(q.correct_answer);
  return true;
}

export async function generateLessonQuestions(
  admin: Admin,
  lessonId: string,
  opts: { count: number; examPatterns?: string | null },
) {
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, title, summary, course_id, courses(content_language, subject, grade_level)")
    .eq("id", lessonId)
    .single();
  if (!lesson) throw new Error("Lesson not found");
  const { data: objectives } = await admin
    .from("objectives")
    .select("id, description, skill")
    .eq("lesson_id", lessonId)
    .neq("status", "rejected");

  // Retrieve evidence (RAG)
  const [qv] = await embed([`${lesson.title}\n${lesson.summary ?? ""}\n${(objectives ?? []).map((o) => o.description).join("\n")}`]);
  const { data: hits, error: mErr } = await admin.rpc("match_source_chunks", {
    _course_id: lesson.course_id,
    _query: JSON.stringify(qv),
    _count: 10,
  } as never);
  if (mErr) throw mErr;
  const chunks = (hits ?? []) as { page_number: number; content: string; document_id: string; similarity: number }[];
  if (!chunks.length) throw new Error("لا توجد نصوص مفهرسة لهذا المقرر — analyze a document first.");

  const pageIds = [...new Set(chunks.map((c) => c.document_id))];
  const { data: pageRows } = await admin
    .from("source_pages")
    .select("document_id, page_number, text_content")
    .in("document_id", pageIds)
    .in("page_number", [...new Set(chunks.map((c) => c.page_number))]);
  const pageMap = new Map((pageRows ?? []).map((p) => [p.page_number, p.text_content ?? ""]));
  const source = chunks.map((c) => `[p.${c.page_number}] ${c.content}`).join("\n\n");

  // Few-shot from teacher-approved questions (continuous improvement without training)
  const { data: examples } = await admin
    .from("questions")
    .select("stem, kind, options, correct_answer, explanation")
    .eq("course_id", lesson.course_id)
    .in("status", ["approved", "published"])
    .order("updated_at", { ascending: false })
    .limit(3);
  const { data: rejected } = await admin
    .from("ai_feedback")
    .select("reason")
    .eq("course_id", lesson.course_id)
    .eq("decision", "rejected")
    .not("reason", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const course = lesson.courses as { content_language: string; subject: string | null; grade_level: string | null } | null;
  const provider = getProvider();
  const raw = await provider.generateJson<unknown>({
    schemaName: "questions",
    schema: questionSchema as unknown as Record<string, unknown>,
    effort: "medium",
    system: `You are an expert assessment designer writing exam-quality questions for ${course?.subject ?? "a school subject"} (${course?.grade_level ?? "K-12"}). Write in language: ${course?.content_language ?? "ar"}.
Quality rules:
- Each question tests ONE objective; tag "skill" with the matching objective skill.
- multiple_choice: exactly 4 options, one unambiguous correct answer copied exactly into correct_answer, plausible distractors that are clearly wrong per the source.
- true_false: options must be the two words for true/false in the content language.
- fill_blank: use "____" in the stem; accepted_answers lists all acceptable spellings.
- Mix difficulty (about 40% easy, 40% medium, 20% challenge). No trick questions, no "all of the above".
- Explanation cites why, using only the source.${GROUNDING_RULES}`,
    user: `LESSON: ${lesson.title}\nSUMMARY: ${lesson.summary ?? ""}\nOBJECTIVES:\n${(objectives ?? []).map((o) => `- [${o.skill}] ${o.description}`).join("\n")}
${opts.examPatterns ? `\nEXAM PATTERNS (style guidance only, do not copy text):\n${opts.examPatterns}\n` : ""}
${examples?.length ? `\nTEACHER-APPROVED EXAMPLES (match this quality/style):\n${JSON.stringify(examples)}\n` : ""}
${rejected?.length ? `\nAVOID these problems the teacher rejected before:\n${rejected.map((r) => `- ${r.reason}`).join("\n")}\n` : ""}
Generate ${opts.count} questions.\n\nSOURCE:\n${source}`,
  });
  const gen = z.object({ questions: z.array(z.unknown()), warnings: z.array(z.string()) }).parse(raw);
  const warnings = [...gen.warnings];
  const candidates: (GenQ & { support: number; page: number })[] = [];
  for (const item of gen.questions) {
    const r = QuestionZ.safeParse(item);
    if (!r.success || !structurallyValid(r.data)) {
      warnings.push("تم استبعاد سؤال بصيغة غير صالحة.");
      continue;
    }
    const loc = locateQuote(r.data.source_quote, pageMap, r.data.source_page);
    if (loc.score < 0.5) {
      warnings.push(`تم استبعاد سؤال بلا دليل في الكتاب: «${r.data.stem.slice(0, 60)}…»`);
      continue;
    }
    candidates.push({ ...r.data, support: loc.score, page: loc.page });
  }
  if (!candidates.length) return { created: 0, warnings };

  // Independent verifier pass
  const ver = VerifyZ.parse(
    await provider.generateJson<unknown>({
      schemaName: "verification",
      schema: verifySchema as unknown as Record<string, unknown>,
      effort: "high",
      system: `You are a strict independent exam reviewer. For each question, judge ONLY against the SOURCE:
supported = the question and answer are fully supported by the source; answer_correct = the marked answer is correct; distractors_wrong = every other option is wrong per the source (true for non-MCQ); single_best_answer = exactly one defensible answer. Put concrete problems in "issues" (empty string if none). Be skeptical.`,
      user: `SOURCE:\n${source}\n\nQUESTIONS:\n${JSON.stringify(candidates.map((q, index) => ({ index, kind: q.kind, stem: q.stem, options: q.options, correct_answer: q.correct_answer })))}`,
    }),
  );
  const byIdx = new Map(ver.verdicts.map((v) => [v.index, v]));

  let { data: activity } = await admin
    .from("activities")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("kind", "practice")
    .limit(1)
    .maybeSingle();
  if (!activity) {
    const ins = await admin
      .from("activities")
      .insert({ course_id: lesson.course_id, lesson_id: lessonId, title: `تدريب: ${lesson.title}`, kind: "practice", status: "draft" })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    activity = ins.data;
  }
  const { count: existing } = await admin.from("questions").select("id", { count: "exact", head: true }).eq("activity_id", activity.id);
  const skillToObj = new Map((objectives ?? []).map((o) => [(o.skill ?? "").trim(), o.id]));

  let created = 0;
  const rows = candidates.flatMap((q, i) => {
    const v = byIdx.get(i);
    const passed = !!v && v.supported && v.answer_correct && v.distractors_wrong && v.single_best_answer;
    if (v && (!v.supported || !v.answer_correct)) {
      warnings.push(`استبعد المدقق سؤالًا: ${v.issues || q.stem.slice(0, 60)}`);
      return [];
    }
    const confidence = Number((Math.min(q.confidence, q.support) * (passed ? 1 : 0.6)).toFixed(2));
    created++;
    return [{
      course_id: lesson.course_id,
      activity_id: activity!.id,
      objective_id: skillToObj.get(q.skill.trim()) ?? objectives?.[0]?.id ?? null,
      kind: q.kind,
      stem: q.stem,
      options: q.options,
      correct_answer: { value: q.correct_answer, accepted: q.accepted_answers },
      explanation: q.explanation,
      difficulty: q.difficulty,
      confidence,
      source_page: q.page,
      source_quote: q.source_quote,
      verification: { quote_support: q.support, ...(v ?? {}), model: provider.model },
      position: (existing ?? 0) + i,
      status: "draft" as const,
    }];
  });
  if (rows.length) {
    const { error } = await admin.from("questions").insert(rows);
    if (error) throw error;
  }
  return { created, warnings };
}
