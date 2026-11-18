import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { accessStatus, teacherAccessStatus, subscriptionEnd } from "./subscriptions";

it("grants one calendar month, clamping the last day of January", () => {
  expect(subscriptionEnd("2026-01-31T10:00:00Z", "monthly")).toBe("2026-02-28T10:00:00.000Z");
});
it("grants one full calendar year, clamping leap day", () => {
  expect(subscriptionEnd("2028-02-29T10:00:00Z", "yearly")).toBe("2029-02-28T10:00:00.000Z");
});

describe("teacher access periods", () => {
  const period = { starts_at: "2026-11-14T00:00:00Z", ends_at: "2026-11-21T00:00:00Z", plan_id: "pro" };
  it("expires exactly at the end of the granted period", () => {
    expect(accessStatus([period], Date.parse(period.ends_at)).status).toBe("expired");
    expect(accessStatus([period], Date.parse(period.ends_at) - 1).status).toBe("active");
  });
  it("does not invent a trial duration for an unconfigured teacher", () => {
    expect(accessStatus([]).status).toBe("unset");
  });
  it("does not activate a future grant early", () => {
    expect(accessStatus([period], Date.parse("2026-11-13T00:00:00Z")).status).toBe("upcoming");
  });
  it("shows the teacher's trial for exactly 30 days from profile creation", () => {
    const created = "2026-11-01T09:30:00Z";
    const end = Date.parse("2026-12-01T09:30:00Z");
    expect(teacherAccessStatus([], created, end - 1).status).toBe("active");
    expect(teacherAccessStatus([], created, end).status).toBe("expired");
    expect(teacherAccessStatus([], created, end).period?.ends_at).toBe("2026-12-01T09:30:00.000Z");
  });
  it("keeps a granted period active after the trial expires", () => {
    expect(teacherAccessStatus([period], "2026-09-01T00:00:00Z", Date.parse("2026-11-15T00:00:00Z")).status).toBe("active");
  });
  it("shows the latest active end when a trial overlaps a grant", () => {
    expect(teacherAccessStatus([period], "2026-11-01T00:00:00Z", Date.parse("2026-11-15T00:00:00Z")).period?.ends_at).toBe("2026-12-01T00:00:00.000Z");
  });
  it("does not label an explicitly granted starter period as the automatic 30-day trial", () => {
    const grant = { starts_at: "2026-11-14T12:06:46Z", ends_at: "2027-11-14T12:06:46Z", plan_id: "starter" };
    const status = teacherAccessStatus([grant], "2026-10-29T14:04:38Z", Date.parse("2026-11-16T00:00:00Z"));
    expect(status.period?.ends_at).toBe("2027-11-14T12:06:46Z");
    expect(status.period?.isTrial).not.toBe(true);
  });
  const sql = readFileSync("drizzle/migrations/0013_teacher_access_periods_and_renewal_requests.sql", "utf8");
  it("requires subscriptions permission to grant access", () => {
    const grant = sql.split("CREATE FUNCTION public.grant_teacher_access")[1]?.split("CREATE FUNCTION public.request_teacher_renewal")[0];
    expect(grant).toContain("IF NOT public.has_admin_permission('subscriptions') THEN RAISE EXCEPTION 'Forbidden'");
  });
  it("adds free days after existing access instead of shortening it", () => {
    expect(sql).toContain("greatest(now(),coalesce(max(ends_at),now()))");
    expect(sql).toContain("start_time+make_interval(days=>_days)");
  });
});