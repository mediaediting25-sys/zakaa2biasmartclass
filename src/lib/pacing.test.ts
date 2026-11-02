import { describe, expect, it } from "vitest";
import { buildPlan, sessionDates } from "./pacing";

const units = [{ id: "u1", title: "U1" }];
const lessons = [1, 2, 3, 4].map((n) => ({ id: `l${n}`, unit_id: "u1", title: `L${n}` }));

describe("pacing", () => {
  it("2 sessions per week over 4 weeks gives 8 sessions", () => {
    expect(sessionDates("2026-01-03", "2026-01-30", 2, "week")).toHaveLength(8);
  });
  it("more sessions than lessons: every session gets content, order kept", () => {
    const p = buildPlan({ start: "2026-01-03", end: "2026-01-30", perPeriod: 2, period: "week", reviewPerUnit: false, units, lessons });
    expect(p.every((s) => s.items.length > 0)).toBe(true);
    expect(p[0]?.items[0]?.lessonId).toBe("l1");
    expect(p.at(-1)?.items[0]?.lessonId).toBe("l4");
  });
  it("fewer sessions than lessons: all lessons still scheduled", () => {
    const p = buildPlan({ start: "2026-01-03", end: "2026-01-09", perPeriod: 2, period: "week", reviewPerUnit: true, units, lessons });
    expect(p).toHaveLength(2);
    expect(p.flatMap((s) => s.items).length).toBe(5);
    expect(p.at(-1)?.items.at(-1)?.type).toBe("review");
  });
  it("monthly frequency schedules 3 sessions in 30 days", () => {
    expect(sessionDates("2026-01-01", "2026-01-30", 3, "month")).toEqual(["2026-01-01", "2026-01-11", "2026-01-21"]);
  });
  it("adds review after each unit's lessons", () => {
    const p = buildPlan({ start: "2026-01-01", end: "2026-01-03", perPeriod: 7, period: "week", reviewPerUnit: true, units, lessons });
    expect(p.flatMap(s => s.items).at(-1)).toEqual({ type: "review", unitId: "u1", title: "U1" });
  });
  it("rejects reversed dates and duplicate-day frequencies", () => {
    expect(sessionDates("2026-02-01", "2026-01-01", 2, "week")).toEqual([]);
    expect(sessionDates("2026-01-01", "2026-02-01", 8, "week")).toEqual([]);
  });
});
