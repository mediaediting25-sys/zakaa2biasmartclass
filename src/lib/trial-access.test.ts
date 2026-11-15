import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("drizzle/migrations/0015_enforce_teacher_trial_access.sql", "utf8");
describe("teacher trial access", () => {
  it("trial lasts 30 days", () => expect(sql).toContain("interval '30 days'"));
  it("expired teachers keep reads: only insert/update are restricted", () => {
    expect(sql).toContain("FOR INSERT");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).not.toMatch(/FOR SELECT/);
  });
});
