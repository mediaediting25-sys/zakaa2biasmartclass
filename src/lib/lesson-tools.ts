import { z } from "zod";
import { livingBookSchema } from "./living-book";

export const slideSchema = z.object({
  title: z.string().min(1),
  narrative: z.string().min(1),
  points: z.array(z.string()).min(1),
  challenge: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  explanation: z.string(),
  sourcePage: z.number().int().positive(),
  sourceQuote: z.string().min(1),
  livingBook: livingBookSchema.optional(),
});
export const presentationSchema = z.object({ title: z.string().min(1), slides: z.array(slideSchema).min(3).max(16) });
export type LessonSlide = z.infer<typeof slideSchema>;

export function readSlides(value: unknown): LessonSlide[] {
  const parsed = z.array(slideSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function answerMatches(kind: string, answer: unknown, choice: string | null) {
  if (choice == null) return false;
  const stored = answer && typeof answer === "object" ? answer as { value?: unknown; accepted?: unknown } : { value: answer };
  if (stored.value == null) return false;
  if (kind === "multiple_choice" || kind === "true_false") return String(stored.value) === choice;
  const normalize = (s: string) => s.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  const accepted = Array.isArray(stored.accepted) ? stored.accepted.filter((v): v is string => typeof v === "string") : [];
  return [String(stored.value), ...accepted].some((v) => normalize(v) === normalize(choice));
}

export function questionIssues(q: { kind?: string; options: unknown; correct_answer: unknown; source_page: number | null; source_quote: string | null }) {
  const issues: string[] = [];
  const opts = Array.isArray(q.options) ? q.options : [];
  const ans = q.correct_answer && typeof q.correct_answer === "object" && "value" in q.correct_answer ? String(q.correct_answer.value ?? "") : String(q.correct_answer ?? "");
  if (q.kind === "fill_blank" || q.kind === "short_answer") {
    if (!ans.trim()) issues.push("الإجابة الصحيحة ناقصة");
  } else {
    if (opts.length < 2) issues.push("خيارات ناقصة");
    if (!ans || !opts.includes(ans)) issues.push("الإجابة الصحيحة غير موجودة ضمن الخيارات");
  }
  if (!q.source_page || !q.source_quote?.trim()) issues.push("بلا صفحة أو اقتباس من الكتاب");
  return issues;
}