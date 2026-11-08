import { z } from "zod";

export const assessmentOptions = z.object({
  language: z.enum(["ar", "en", "both"]).default("ar"),
  count: z.number().int().min(1).max(15),
  topic: z.string().trim().max(300).default(""),
  age: z.number().int().min(4).max(22).default(12),
  grade: z.string().trim().max(80).default(""),
});
export type AssessmentOptions = z.infer<typeof assessmentOptions>;

export function canDeleteQuestion(status: string) { return status === "rejected"; }

export function normalizeQuestion(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().replace(/\s+/g, " ");
}

export function isRepeatedQuestion(stem: string, existing: string[]) {
  const normalized = normalizeQuestion(stem);
  const words = new Set(normalized.split(" "));
  return existing.some(previous => {
    const other = normalizeQuestion(previous);
    if (normalized === other) return true;
    const tokens = new Set(other.split(" "));
    const common = [...words].filter(word => tokens.has(word)).length;
    const union = new Set([...words, ...tokens]).size;
    return words.size >= 5 && tokens.size >= 5 && common / union >= 0.82;
  });
}

export function assessmentSection(activity: { status: string; published_at?: string | null }) {
  return activity.status === "published" || activity.published_at ? "history" : "review";
}

export function batchReadyForPublication<Q extends { status: string }>(questions: Q[], hasIssues: (q: Q) => boolean) {
  const included = questions.filter(q => q.status !== "rejected");
  return included.length > 0 && included.every(q => ["approved", "published"].includes(q.status) && !hasIssues(q));
}

export function distributeQuestionCount(count: number, lessonIds: string[]) {
  if (!lessonIds.length) return [];
  return lessonIds.slice(0, count).map((lessonId, index, selected) => ({
    lessonId,
    count: Math.floor(count / selected.length) + (index < count % selected.length ? 1 : 0),
  }));
}