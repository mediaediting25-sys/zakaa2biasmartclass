import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { accessStatus } from "./subscriptions";

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