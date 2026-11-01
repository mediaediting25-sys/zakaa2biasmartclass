// Pure pacing planner: spreads lessons (+ optional unit reviews) across class sessions.
export type PlanItem = { type: "lesson" | "review"; lessonId?: string; unitId: string; title: string };
export type PlanSession = { index: number; date: string; week: number; items: PlanItem[] };

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Session dates between start and end (inclusive), `perPeriod` sessions per week (7d) or month (30d). */
export function sessionDates(start: string, end: string, perPeriod: number, period: "week" | "month") {
  const s = Date.parse(start + "T00:00:00Z");
  const e = Date.parse(end + "T00:00:00Z");
  if (!(e >= s) || perPeriod < 1) return [];
  const len = period === "week" ? 7 : 30;
  const out: string[] = [];
  for (let block = s; block <= e; block += len * DAY) {
    for (let i = 0; i < perPeriod; i++) {
      const t = block + Math.floor((i * len) / perPeriod) * DAY;
      if (t <= e) out.push(iso(t));
    }
  }
  return out;
}

export function buildPlan(input: {
  start: string;
  end: string;
  perPeriod: number;
  period: "week" | "month";
  reviewPerUnit: boolean;
  units: { id: string; title: string }[];
  lessons: { id: string; unit_id: string; title: string }[];
}): PlanSession[] {
  const items: PlanItem[] = [];
  for (const u of input.units) {
    const ls = input.lessons.filter((l) => l.unit_id === u.id);
    if (!ls.length) continue;
    ls.forEach((l) => items.push({ type: "lesson", lessonId: l.id, unitId: u.id, title: l.title }));
    if (input.reviewPerUnit) items.push({ type: "review", unitId: u.id, title: u.title });
  }
  const dates = sessionDates(input.start, input.end, input.perPeriod, input.period);
  const S = dates.length;
  const N = items.length;
  if (!S || !N) return [];
  const s0 = Date.parse(input.start + "T00:00:00Z");
  const sessions: PlanSession[] = dates.map((date, index) => ({
    index,
    date,
    week: Math.floor((Date.parse(date + "T00:00:00Z") - s0) / (7 * DAY)) + 1,
    items: [],
  }));
  items.forEach((it, k) => {
    // Each item owns sessions [floor(k*S/N), floor((k+1)*S/N)); when S<N several share one.
    const from = Math.floor((k * S) / N);
    const to = Math.max(from + 1, Math.floor(((k + 1) * S) / N));
    for (let i = from; i < to; i++) sessions[i]!.items.push(it);
  });
  return sessions;
}
