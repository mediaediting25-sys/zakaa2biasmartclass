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

function stemWords(text: string) {
  return normalizeQuestion(text.replace(/_{2,}/g, " ")).split(" ").filter(Boolean).map(w => w.replace(/^(?:وال|ال|و|ل|ب)(?=.{3,})/u, ""));
}

function stemSimilarity(a: string, b: string) {
  const x = new Set(stemWords(a));
  const y = new Set(stemWords(b));
  if (!x.size || !y.size) return { jaccard: 0, containment: 0, size: 0 };
  const common = [...x].filter(word => y.has(word)).length;
  const union = new Set([...x, ...y]).size;
  return { jaccard: common / union, containment: common / Math.min(x.size, y.size), size: Math.min(x.size, y.size) };
}

export function isRepeatedQuestion(stem: string, existing: string[]) {
  const normalized = normalizeQuestion(stem);
  return existing.some(previous => {
    if (normalized === normalizeQuestion(previous)) return true;
    const s = stemSimilarity(stem, previous);
    // Same wording with small changes, or one question fully contained in another.
    return (s.size >= 4 && s.jaccard >= 0.7) || (s.size >= 5 && s.containment >= 0.85);
  });
}

type QuestionLike = { stem: string; correct_answer?: string | null };

/** Stem is a repeat, or two questions share the same specific answer and a similar stem (same fact asked twice). */
export function isDuplicateQuestion(q: QuestionLike, existing: QuestionLike[]) {
  if (isRepeatedQuestion(q.stem, existing.map(e => e.stem))) return true;
  const answer = normalizeQuestion(q.correct_answer ?? "");
  if (answer.split(" ").filter(Boolean).length < 2) return false;
  return existing.some(e => normalizeQuestion(e.correct_answer ?? "") === answer && stemSimilarity(q.stem, e.stem).jaccard >= 0.3);
}

const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;

function cairoParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Readable title for a new generated activity: type, lesson, language, number and a simple date. */
export function buildActivityTitle(opts: { language: string; homework?: boolean; exam?: boolean; lessonTitle: string; sequence: number; now?: Date }) {
  const en = opts.language === "en";
  const type = en ? (opts.homework ? "Homework" : opts.exam ? "Exam" : "Practice") : (opts.homework ? "واجب" : opts.exam ? "امتحان" : "تدريب");
  const lang = en ? "English" : "عربي";
  return `${type}: ${opts.lessonTitle} · ${lang} · #${opts.sequence} · ${cairoParts(opts.now ?? new Date()).date}`;
}

/** Display-only cleanup of old titles that contain raw ISO timestamps (the stored title is not changed). */
export function displayActivityTitle(title: string) {
  return title
    .replace(ISO_TIMESTAMP, (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const c = cairoParts(d);
      return `${c.date} ${c.time}`;
    })
    .replace(/ · AR · /, " · عربي · ")
    .replace(/ · EN · /, " · English · ");
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
