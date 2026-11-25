import { describe, expect, it } from "vitest";
import { ACCOUNT_CHECK_UNAVAILABLE, assertAccountLive, assertLoginExists, loginState, readiness, runDeletionJob, runPendingJobs, type DbLike } from "./account-deletion.server";
import { hiddenTeacherIds } from "./directory.server";
import { buildStudentRows } from "@/lib/teacher-dashboard";

type Row = Record<string, unknown>;
const U = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const ENV = { ACCOUNT_DELETION_ENABLED: "true" };

class Fake {
  tables: Record<string, Row[]> = {};
  files: string[] = [];
  users = new Map<string, string>();
  log: string[] = [];
  failTable = new Set<string>(); // "delete:notifications", "select:departed_accounts", "upsert:blocked_accounts" ...
  failStorage: "list" | "remove" | null = null;
  deleteUserMode: "ok" | "fail" | "fail_lookup_down" | "fail_but_gone" | "needs_avatars_removed" = "ok";
  onAfter: Record<string, () => void> = {};
  now = 1_800_000_000_000; // fake server clock (ms)
  ownedObjects: number | null = 0; // null = the count fails
  blockerAnswer: string | null = null;
  blockerAfterBlock: string | null = null;
  blockerCalls = 0;
  nextEpoch = 0;
  rpcFail = new Set<string>();
  lookupError = false;
  sweepArgs: Record<string, unknown> = {};

  constructor() {
    this.users.set(U, "sara@example.com");
    this.tables = { user_roles: [{ user_id: U, role: "student" }], platform_owners: [], courses: [], profiles: [{ id: U, full_name: "Sara", email: "sara@example.com" }], notifications: [{ user_id: U }], student_link_codes: [], parent_links: [], role_choices: [{ user_id: U }], teacher_listings: [], join_requests: [{ student_id: U, teacher_id: "t" }], blocked_accounts: [], departed_accounts: [], enrollments: [{ course_id: "c", student_id: U }], attempts: [{ student_id: U, score: 8 }], answers: [{ student_id: U }] };
  }
  from = (table: string) => {
    const self = this;
    let op = "select"; let payload: Row | null = null; const filters: [string, unknown][] = []; let head = false; let count = false; let single = false; let notDone = false;
    const b: any = {
      select(_c?: string, o?: { count?: string; head?: boolean }) { if (op === "select") op = "select"; head = !!o?.head; count = !!o?.count; return b; },
      delete() { op = "delete"; return b; }, update(p: Row) { op = "update"; payload = p; return b; }, upsert(p: Row) { op = "upsert"; payload = p; return b; },
      eq(c: string, v: unknown) { filters.push([c, v]); return b; }, not() { notDone = true; return b; }, limit() { return b; }, maybeSingle() { single = true; return b; },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        const key = `${op}:${table}`; self.log.push(key);
        if (self.failTable.has(key)) return Promise.resolve({ data: null, error: new Error(key) }).then(res, rej);
        const rows = (self.tables[table] ??= []);
        const match = (r: Row) => filters.every(([c, v]) => r[c] === v) && (!notDone || (r["phase"] !== "cleaned" && r["phase"] !== "aborted"));
        let out: Row;
        if (op === "delete") { self.tables[table] = rows.filter((r) => !match(r)); out = { data: null, error: null }; }
        else if (op === "update") { self.tables[table] = rows.map((r) => (match(r) ? { ...r, ...payload! } : r)); out = { data: null, error: null }; }
        else if (op === "upsert") { const k = table === "blocked_accounts" || table === "departed_accounts" ? "user_id" : "id"; self.tables[table] = [...rows.filter((r) => r[k] !== payload![k]), payload!]; out = { data: null, error: null }; }
        else { const m = rows.filter(match); out = { data: head ? null : single ? (m[0] ?? null) : m, error: null, count: count ? m.length : null }; }
        const after = self.onAfter[key]; if (after) after();
        return Promise.resolve(out).then(res, rej);
      },
    };
    return b;
  };
  storage = { from: (_b: string) => ({
    list: async () => (this.failStorage === "list" ? { data: null, error: new Error("list") } : { data: this.files.map((f) => ({ name: f })), error: null }),
    remove: async (names: string[]) => { this.log.push("storage.remove"); if (this.failStorage === "remove") return { data: null, error: new Error("remove") }; this.files = this.files.filter((f) => !names.includes(`${U}/${f}`)); return { data: null, error: null }; },
  }) };
  auth = { admin: {
    getUserById: async (id: string) => { if (this.lookupError) return { data: { user: null }, error: Object.assign(new Error("upstream"), { status: 503 }) }; const e = this.users.get(id); return e ? { data: { user: { email: e } }, error: null } : { data: { user: null }, error: Object.assign(new Error("not found"), { status: 404, code: "user_not_found" }) }; },
    deleteUser: async (id: string) => { this.log.push("deleteUser"); if (this.deleteUserMode === "fail_lookup_down") { this.lookupError = true; return { error: new Error("x") }; } if (this.deleteUserMode === "fail") return { error: new Error("x") }; if (this.deleteUserMode === "needs_avatars_removed" && this.files.length) return { error: new Error("owns storage objects") }; this.users.delete(id); this.tables["user_roles"] = (this.tables["user_roles"] ?? []).filter((r) => r["user_id"] !== id); this.tables["profiles"] = (this.tables["profiles"] ?? []).filter((r) => r["id"] !== id); return { error: this.deleteUserMode === "fail_but_gone" ? new Error("late") : null }; },
  } };
  // Same rules as the job functions in migration 0021 (the real SQL is tested separately in PGlite).
  rpc = async (fn: string, a: Record<string, unknown>) => {
    this.log.push(`rpc:${fn}`);
    if (this.rpcFail.has(fn)) return { data: null, error: new Error(fn) };
    const jobs = (this.tables["account_deletion_jobs"] ??= []);
    const job = jobs.find((j) => j["id"] === a["_job"]);
    const epochOk = () => !!job && job["lease_epoch"] === a["_epoch"];
    if (fn === "deletion_runnable_jobs") { const ids = jobs.filter((j) => !["cleaned", "aborted"].includes(j["phase"] as string) && !j["leased"]).map((j) => j["id"]); this.sweepArgs = a; return { data: ids.slice(0, a["_limit"] as number), error: null }; }
    if (fn === "deletion_blocker") { this.blockerCalls++; return { data: this.blockerAfterBlock && this.blockerCalls > 1 ? this.blockerAfterBlock : this.blockerAnswer, error: null }; }
    if (fn === "count_owned_storage_objects") return this.ownedObjects === null ? { data: null, error: new Error("count") } : { data: this.ownedObjects, error: null };
    if (fn === "deletion_job_claim") {
      if (!job || job["leased"]) return { data: null, error: null };
      job["leased"] = true; job["lease_epoch"] = (job["lease_epoch"] as number) + 1; return { data: job["lease_epoch"], error: null };
    }
    if (!epochOk()) return { data: fn === "deletion_job_acquire_block" ? null : false, error: fn === "deletion_job_acquire_block" ? new Error("lease_lost") : null };
    if (fn === "deletion_job_holds_lease") return { data: !!job && job["lease_epoch"] === a["_epoch"] && job["phase"] === a["_phase"], error: null };
    if (fn === "deletion_job_save_departed") {
      if (!epochOk() || job!["phase"] !== "blocked") return { data: false, error: null };
      this.log.push("upsert:departed_accounts");
      if (this.failTable.has("upsert:departed_accounts")) return { data: false, error: null };
      const p = this.tables["profiles"]!.find((r) => r["id"] === job!["user_id"]); if (!p) return { data: false, error: null };
      this.tables["departed_accounts"] = [{ user_id: U, committed: false, full_name: p["full_name"], email: p["email"], cleanup_done: false }]; return { data: true, error: null };
    }
    if (fn === "deletion_job_cleanup_rows") {
      if (!epochOk() || job!["phase"] !== "deleted_confirmed") return { data: false, error: null };
      this.log.push("delete:teacher_listings"); if (this.failTable.has("delete:teacher_listings")) return { data: null, error: new Error("x") };
      this.tables["departed_accounts"] = (this.tables["departed_accounts"] ?? []).map((r) => ({ ...r, committed: true }));
      for (const t of ["notifications", "join_requests", "role_choices", "admin_permissions"]) this.tables[t] = [];
      return { data: true, error: null };
    }
    const order = ["approved", "needs_storage_review", "blocked", "delete_requested", "deleted_confirmed", "cleaned"];
    if (fn === "deletion_job_set_phase") {
      const from = job!["phase"] as string; const to = a["_phase"] as string;
      const pre = ["approved", "needs_storage_review", "blocked"];
      const ok = pre.includes(from) ? ["approved", "needs_storage_review", "blocked", "aborted"].includes(to) || (from === "blocked" && to === "delete_requested") : order.indexOf(to) >= order.indexOf(from) && order.indexOf(to) <= order.indexOf(from) + 1 && to !== "aborted";
      if (!ok) return { data: false, error: null };
      if (to === "delete_requested" && (this.blockerAfterBlock ?? this.blockerAnswer)) return { data: false, error: null };
      job!["phase"] = to; job!["last_error"] = a["_error"];
      if (to === "cleaned") this.tables["departed_accounts"] = (this.tables["departed_accounts"] ?? []).map((r) => ({ ...r, cleanup_done: true }));
      return { data: true, error: null };
    }
    if (fn === "deletion_job_acquire_block") {
      const have = (this.tables["blocked_accounts"] ??= []).find((r) => r["user_id"] === job!["user_id"]);
      if (have) { job!["block_acquired"] = false; job!["phase"] = "blocked"; return { data: false, error: null }; }
      this.tables["blocked_accounts"]!.push({ user_id: job!["user_id"], block_token: "tok-" + job!["id"] });
      job!["block_token"] = "tok-" + job!["id"]; job!["block_acquired"] = true; job!["phase"] = "blocked"; return { data: true, error: null };
    }
    if (fn === "deletion_job_reconcile_gone") {
      if (!["approved", "needs_storage_review", "blocked"].includes(job!["phase"] as string) || this.blockerAnswer) return { data: false, error: null };
      if (this.tables["profiles"]!.some((r) => r["id"] === job!["user_id"])) return { data: false, error: null };
      const bl = (this.tables["blocked_accounts"] ??= []);
      if (!bl.find((r) => r["user_id"] === job!["user_id"])) { bl.push({ user_id: job!["user_id"], block_token: "tok-" + job!["id"] }); job!["block_acquired"] = true; }
      const p = this.tables["profiles"]!.find((r) => r["id"] === job!["user_id"]);
      this.tables["departed_accounts"] = [{ user_id: U, committed: false, full_name: p ? p["full_name"] : "Saved Request Name", cleanup_done: false }];
      job!["phase"] = "deleted_confirmed"; return { data: true, error: null };
    }
    if (fn === "deletion_job_abort") {
      if (!["approved", "needs_storage_review", "blocked"].includes(job!["phase"] as string)) return { data: false, error: null };
      if (job!["block_acquired"]) this.tables["blocked_accounts"] = this.tables["blocked_accounts"]!.filter((r) => !(r["user_id"] === job!["user_id"] && r["block_token"] === job!["block_token"]));
      job!["phase"] = "aborted"; job!["last_error"] = a["_error"]; return { data: true, error: null };
    }
    return { data: null, error: new Error("unknown " + fn) };
  };
  addJob(phase = "approved") { const j: Row = { id: "job1", user_id: U, phase, block_acquired: false, lease_epoch: 0, leased: false }; (this.tables["account_deletion_jobs"] ??= []).push(j); return j; }
  db() { return this as unknown as DbLike; }
}

const job = (f: Fake) => (f.tables["account_deletion_jobs"] as Row[])[0]!;
const mutations = (f: Fake) => f.log.filter((l) => /^(delete|upsert):|deleteUser|storage\.remove/.test(l));
const retained = (f: Fake) => ({ enr: f.tables["enrollments"]!.length, att: f.tables["attempts"]!.length, ans: f.tables["answers"]!.length });
const unlease = (f: Fake) => { job(f)["leased"] = false; };

describe("runDeletionJob (fake clients; the SQL itself is tested in PGlite)", () => {
  it("does nothing while the feature flag is off", async () => {
    const f = new Fake(); f.addJob();
    expect(await runDeletionJob(f.db(), "job1", {})).toMatchObject({ phase: "unknown" });
    expect(mutations(f)).toEqual([]);
  });
  it("happy path: block, saved name, delete_requested BEFORE deleteUser, then cleanup and cleaned; education records kept", async () => {
    const f = new Fake(); f.addJob(); f.files = [];
    const before = retained(f);
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
    expect(f.users.has(U)).toBe(false);
    expect(retained(f)).toEqual(before);
    expect(f.tables["blocked_accounts"]).toMatchObject([{ user_id: U }]); // stays so old tokens stay out
    expect(f.tables["departed_accounts"]).toMatchObject([{ user_id: U, committed: true, cleanup_done: true, full_name: "Sara" }]);
    const log = f.log;
    expect(log.indexOf("rpc:deletion_job_acquire_block")).toBeLessThan(log.indexOf("upsert:departed_accounts"));
    expect(log.indexOf("upsert:departed_accounts")).toBeLessThan(log.indexOf("deleteUser"));
    expect(log.indexOf("rpc:deletion_job_set_phase")).toBeLessThan(log.indexOf("deleteUser"));
    expect(job(f)["phase"]).toBe("cleaned");
  });
  it("owner or owned courses found at execution time: aborts before any change", async () => {
    const f = new Fake(); f.addJob(); f.blockerAnswer = "has_courses";
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "aborted" });
    expect(mutations(f)).toEqual([]); expect(f.users.has(U)).toBe(true); expect(f.tables["blocked_accounts"]).toEqual([]);
  });
  it("an administrator target that is no longer owner-approved (promoted after approval): aborts before any change", async () => {
    const f = new Fake(); f.addJob(); f.blockerAnswer = "admin_needs_owner";
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "aborted", note: "admin_needs_owner" });
    expect(mutations(f)).toEqual([]); expect(f.users.has(U)).toBe(true); expect(f.tables["blocked_accounts"]).toEqual([]);
  });
  it("unknown login state (lookup outage) changes nothing and is never treated as gone", async () => {
    const f = new Fake(); f.addJob(); f.lookupError = true;
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "approved", note: "login_unknown" });
    expect(mutations(f)).toEqual([]); expect(f.tables["blocked_accounts"]).toEqual([]);
  });
  it("login already gone (explicit not-found) on an approved job: block row kept, name saved, cleanup finishes, deleteUser never called", async () => {
    for (const phase of ["approved", "needs_storage_review"]) {
      const f = new Fake(); f.addJob(phase); f.users.delete(U); f.tables["profiles"] = []; f.files = [];
      expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
      expect(f.log).not.toContain("deleteUser");
      expect(f.tables["blocked_accounts"]).toMatchObject([{ user_id: U }]);
      expect(f.tables["departed_accounts"]).toMatchObject([{ user_id: U, committed: true, cleanup_done: true }]);
    }
  });
  it("login already gone but the account still has courses: stays parked as approved/login_missing, nothing deleted", async () => {
    const f = new Fake(); f.addJob(); f.users.delete(U); f.blockerAnswer = "has_courses";
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "approved", note: "login_gone_needs_review" });
    expect(job(f)["last_error"]).toBe("login_missing"); expect(f.tables["blocked_accounts"]).toEqual([]);
  });
  it("not-found but the profile row still exists (inconsistent): refused, nothing deleted, parked for review", async () => {
    const f = new Fake(); f.addJob(); f.users.delete(U); // profile row left in place
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "approved", note: "login_gone_needs_review" });
    expect(f.tables["blocked_accounts"]).toEqual([]); expect(f.tables["notifications"]).toHaveLength(1); expect(job(f)["phase"]).toBe("approved");
  });
  it("a lookup outage is never read as gone: no reconcile call", async () => {
    const f = new Fake(); f.addJob(); f.lookupError = true;
    await runDeletionJob(f.db(), "job1", ENV);
    expect(f.log).not.toContain("rpc:deletion_job_reconcile_gone");
  });
  it("storage fails closed: owned files or a failed count -> needs_storage_review, no block, no storage or delete call", async () => {
    for (const owned of [2, null]) {
      const f = new Fake(); f.addJob(); f.ownedObjects = owned; f.files = ["a.png"];
      expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "needs_storage_review" });
      expect(mutations(f)).toEqual([]); expect(f.tables["blocked_accounts"]).toEqual([]); expect(f.files).toEqual(["a.png"]); expect(f.users.has(U)).toBe(true);
      expect(job(f)["phase"]).toBe("needs_storage_review");
    }
  });
  it("storage review is not a final limitation: once the count is zero the job proceeds on retry", async () => {
    const f = new Fake(); f.addJob(); f.ownedObjects = 1;
    await runDeletionJob(f.db(), "job1", ENV); unlease(f); f.ownedObjects = 0;
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
  });
  it("a block that already existed (administrative) is not ours: it is never removed", async () => {
    const f = new Fake(); f.addJob(); f.tables["blocked_accounts"] = [{ user_id: U, block_token: "admin" }]; f.tables["departed_accounts"] = []; f.failTable.add("upsert:departed_accounts");
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "aborted" });
    expect(f.tables["blocked_accounts"]).toMatchObject([{ block_token: "admin" }]);
  });
  it("abort before the delete call removes only our own block", async () => {
    const f = new Fake(); f.addJob(); f.failTable.add("upsert:departed_accounts");
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "aborted" });
    expect(f.tables["blocked_accounts"]).toEqual([]); expect(f.users.has(U)).toBe(true); expect(f.log).not.toContain("deleteUser");
  });
  it("delete error with login still present: stays delete_requested (locked), never aborted, block kept; retry by user id finishes", async () => {
    const f = new Fake(); f.addJob(); f.deleteUserMode = "fail";
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "delete_requested" });
    expect(job(f)["phase"]).toBe("delete_requested");
    expect(f.tables["blocked_accounts"]).toMatchObject([{ user_id: U }]);
    f.deleteUserMode = "ok"; unlease(f); f.log.length = 0;
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
    expect(f.log.filter((l) => l === "deleteUser")).toHaveLength(1);
    expect(f.log.some((l) => l === "rpc:deletion_job_acquire_block")).toBe(false); // no second block, no email lookup of any kind
  });
  it("delete error and lookup down: unknown, stays delete_requested, nothing cleaned", async () => {
    const f = new Fake(); f.addJob(); f.deleteUserMode = "fail_lookup_down";
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "delete_requested", note: "unknown" });
    expect(f.tables["notifications"]).toHaveLength(1); expect(job(f)["phase"]).toBe("delete_requested");
  });
  it("delete error but login already gone counts as deleted", async () => {
    const f = new Fake(); f.addJob(); f.deleteUserMode = "fail_but_gone";
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
  });
  it("cleanup failure after the login is gone keeps deleted_confirmed and a retry finishes it", async () => {
    const f = new Fake(); f.addJob(); f.failTable.add("delete:teacher_listings");
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "deleted_confirmed", note: "cleanup_pending" });
    f.failTable.clear(); unlease(f);
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
    expect(f.log.filter((l) => l === "deleteUser")).toHaveLength(1);
  });
  it("cleanup also removes the person's admin permission rows", async () => {
    const f = new Fake(); f.addJob(); f.tables["admin_permissions"] = [{ user_id: U, permission: "general_admin" }];
    await runDeletionJob(f.db(), "job1", ENV);
    expect(f.tables["admin_permissions"]).toEqual([]);
  });
  it("a course created after the block is acquired is caught by the recheck: abort, own block removed, nothing deleted", async () => {
    const f = new Fake(); f.addJob(); f.blockerAfterBlock = "has_courses";
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "aborted" });
    expect(f.tables["blocked_accounts"]).toEqual([]); expect(f.log).not.toContain("deleteUser"); expect(f.users.has(U)).toBe(true);
  });
  it("target allowlist is enforced by the executor, not only the button", async () => {
    const f = new Fake(); f.addJob();
    expect(await runDeletionJob(f.db(), "job1", { ...ENV, ACCOUNT_DELETION_TEST_USER_IDS: OTHER })).toMatchObject({ phase: "unknown", note: "disabled_for_target" });
    expect(mutations(f)).toEqual([]); expect(f.log.filter((l) => l.startsWith("rpc:deletion_job_claim"))).toEqual([]);
  });
  it("a stale worker (lease taken over) cannot write the tombstone or cleanup", async () => {
    const f = new Fake(); f.addJob(); const j = job(f); j["leased"] = true; j["lease_epoch"] = 5; j["phase"] = "blocked";
    expect(await f.rpc("deletion_job_save_departed", { _job: "job1", _epoch: 4 })).toMatchObject({ data: false });
    j["phase"] = "deleted_confirmed";
    expect(await f.rpc("deletion_job_cleanup_rows", { _job: "job1", _epoch: 4 })).toMatchObject({ data: false });
    expect(f.tables["notifications"]).toHaveLength(1);
  });
  it("allowlist fails closed when empty or malformed (never open to everyone)", async () => {
    const f = new Fake(); f.addJob();
    for (const bad of ["", "  ", "not-a-uuid", `${U},oops`]) {
      expect(await runDeletionJob(f.db(), "job1", { ...ENV, ACCOUNT_DELETION_TEST_USER_IDS: bad })).toMatchObject({ phase: "unknown" });
    }
    expect(mutations(f)).toEqual([]); expect(f.users.has(U)).toBe(true);
  });
  it("abort that the database does not confirm is reported as unresolved, not aborted", async () => {
    const f = new Fake(); f.addJob(); f.blockerAnswer = "has_courses";
    const real = f.rpc; f.rpc = async (fn: string, a: Record<string, unknown>) => (fn === "deletion_job_abort" ? { data: false, error: null } : real(fn, a));
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "unknown" });
  });
  it("a resumed blocked job that now sees owned files hands back its own block (aborted) instead of claiming nothing changed", async () => {
    const f = new Fake(); f.addJob("blocked"); f.ownedObjects = 1;
    job(f)["block_acquired"] = true; job(f)["block_token"] = "tok-job1"; f.tables["blocked_accounts"] = [{ user_id: U, block_token: "tok-job1" }];
    expect(await runDeletionJob(f.db(), "job1", ENV)).toMatchObject({ phase: "aborted", note: "owns_files" });
    expect(f.tables["blocked_accounts"]).toEqual([]); expect(f.log).not.toContain("deleteUser");
  });
  it("cleaned is only reported when the database accepted the final phase", async () => {
    const f = new Fake(); f.addJob();
    const real = f.rpc; f.rpc = async (fn: string, a: Record<string, unknown>) => (fn === "deletion_job_set_phase" && a["_phase"] === "cleaned" ? { data: false, error: null } : real(fn, a));
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "deleted_confirmed", note: "phase_write_failed" });
  });
  it("photo cleanup pages past 1000 files", async () => {
    const f = new Fake(); f.addJob(); const names = Array.from({ length: 1500 }, (_, i) => `p${i}.png`); f.files = names;
    f.storage = { from: () => ({
      list: async (_p: string, o: { offset: number }) => ({ data: f.files.slice(0, 1000).map((n) => ({ name: n })), error: null, _o: o }),
      remove: async (ns: string[]) => { f.files = f.files.filter((n) => !ns.includes(`${U}/${n}`)); return { data: null, error: null }; },
    }) } as never;
    f.ownedObjects = 0;
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
    expect(f.files).toEqual([]);
  });
  it("a second worker cannot run while the first holds the lease", async () => {
    const f = new Fake(); f.addJob(); job(f)["leased"] = true;
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "busy" });
    expect(mutations(f)).toEqual([]);
  });
  it("runPendingJobs runs unresolved jobs only and reports whether more remain", async () => {
    const f = new Fake(); f.addJob();
    expect(await runPendingJobs(f.db(), ENV)).toEqual({ outcomes: [{ phase: "cleaned" }], more: false });
    expect(await runPendingJobs(f.db(), ENV)).toEqual({ outcomes: [], more: false });
    expect(await runPendingJobs(f.db(), {})).toEqual({ outcomes: [], more: false });
  });
  it("sweep asks the database for runnable jobs with the env allowlist BEFORE any limit, and says when more remain", async () => {
    const f = new Fake();
    for (let i = 0; i < 25; i++) (f.tables["account_deletion_jobs"] ??= []).push({ id: "x" + i, user_id: U, phase: "approved", lease_epoch: 0, leased: false });
    const r = await runPendingJobs(f.db(), { ...ENV });
    expect(f.sweepArgs["_limit"]).toBe(21); expect(r.more).toBe(true); expect(r.outcomes).toHaveLength(20);
  });
  it("photo cleanup drains 2,000 flat files with an offset-aware store and traverses folders", async () => {
    const f = new Fake(); f.addJob(); let files = Array.from({ length: 2000 }, (_, i) => `${U}/p${i}.png`); files.push(`${U}/sub/deep.png`);
    f.storage = { from: () => ({
      list: async (prefix: string, o: { limit: number; offset: number }) => {
        const under = files.filter((n) => n.startsWith(prefix + "/")).map((n) => n.slice(prefix.length + 1));
        const names = [...new Set(under.map((n) => n.split("/")[0]!))];
        return { data: names.slice(o.offset, o.offset + o.limit).map((n) => ({ name: n, id: under.includes(n) ? "id" : null })), error: null };
      },
      remove: async (ns: string[]) => { files = files.filter((n) => !ns.includes(n)); return { data: null, error: null }; },
    }) } as never;
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
    expect(files).toEqual([]);
  });
  it("photo cleanup that cannot remove anything is NOT reported cleaned", async () => {
    const f = new Fake(); f.addJob(); f.files = ["a.png"];
    f.storage = { from: () => ({ list: async () => ({ data: [{ name: "a.png", id: "i" }], error: null }), remove: async () => ({ data: null, error: null }) }) } as never;
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "deleted_confirmed", note: "cleanup_pending" });
  });
});

describe("cleanup, guards and directory", () => {
  it("directory hides only committed departures, not an uncommitted row", async () => {
    const f = new Fake(); f.tables["departed_accounts"] = [{ user_id: U, committed: false }, { user_id: OTHER, committed: true }];
    const sel = { from: (t: string) => ({ select: () => ({ eq: async (_c: string, v: boolean) => ({ data: (f.tables[t] ?? []).filter((r) => r["committed"] === v), error: null }), then: (res: (x: unknown) => unknown) => Promise.resolve({ data: f.tables[t] ?? [], error: null }).then(res) }) }) };
    expect([...(await hiddenTeacherIds(sel as never))]).toEqual([OTHER]);
  });
});

describe("guards and readiness", () => {
  it("test allowlist: with a list set, only listed accounts can see, request or delete; others are refused with nothing changed", async () => {
    const env = { ...ENV, ACCOUNT_DELETION_TEST_USER_IDS: ` ${OTHER} , ${U.toUpperCase()} ` };
    const f = new Fake();
    expect(await readiness(f.db(), U, env)).toEqual({ ready: true });
    expect(await readiness(f.db(), "33333333-3333-3333-3333-333333333333", env)).toEqual({ ready: false });
    const g = new Fake();
    expect(await readiness(g.db(), U, { ...ENV, ACCOUNT_DELETION_TEST_USER_IDS: OTHER })).toEqual({ ready: false });
    expect(mutations(g)).toEqual([]);
    expect(await readiness(g.db(), U, { ACCOUNT_DELETION_TEST_USER_IDS: U })).toEqual({ ready: false }); // flag still required
  });
  it("assertAccountLive: Unauthorized only for gone or blocked accounts; an unanswerable check is a retryable error, never Unauthorized", async () => {
    const f = new Fake();
    await expect(assertAccountLive(f.db(), U, 0)).resolves.toBeUndefined();
    f.tables["blocked_accounts"] = [{ user_id: U }];
    await expect(assertAccountLive(f.db(), U, 0)).rejects.toThrow("Unauthorized"); // blocked (also what a deleted account keeps)
    f.tables["blocked_accounts"] = []; f.failTable.add("select:blocked_accounts");
    await expect(assertAccountLive(f.db(), U, 0)).rejects.toThrow(ACCOUNT_CHECK_UNAVAILABLE); // block list unanswerable: fails closed, not "Unauthorized"
    f.failTable.clear(); f.lookupError = true;
    await expect(assertAccountLive(f.db(), U, 0)).rejects.toThrow(ACCOUNT_CHECK_UNAVAILABLE); // provider 503: fails closed, not "Unauthorized"
    f.lookupError = false; f.users.delete(U);
    await expect(assertAccountLive(f.db(), U, 0)).rejects.toThrow("Unauthorized"); // login gone (explicit 404)
  });
  it("assertAccountLive retries once on a transient provider error and does not cache", async () => {
    const f = new Fake();
    const db = f.db() as unknown as { auth: { admin: { getUserById: (id: string) => Promise<unknown> } } };
    const orig = db.auth.admin.getUserById; let calls = 0;
    db.auth.admin.getUserById = async (id: string) => (calls++ === 0 ? { data: { user: null }, error: Object.assign(new Error("x"), { status: 503 }) } : orig(id));
    await expect(assertAccountLive(db as never, U, 0)).resolves.toBeUndefined();
    expect(calls).toBe(2);
    f.tables["blocked_accounts"] = [{ user_id: U }]; // revoked right after: the very next call refuses
    await expect(assertAccountLive(db as never, U, 0)).rejects.toThrow("Unauthorized");
    expect(calls).toBe(3);
  });
  it("assertAccountLive does not retry an explicit not-found", async () => {
    const f = new Fake(); f.users.delete(U);
    const db = f.db() as unknown as { auth: { admin: { getUserById: (id: string) => Promise<unknown> } } };
    const orig = db.auth.admin.getUserById; let calls = 0;
    db.auth.admin.getUserById = async (id: string) => { calls++; return orig(id); };
    await expect(assertAccountLive(db as never, U, 0)).rejects.toThrow("Unauthorized");
    expect(calls).toBe(1);
  });
  it("a deleted account's old token is refused afterwards (login gone and block row kept)", async () => {
    const f = new Fake(); f.addJob();
    expect(await runDeletionJob(f.db(), "job1", ENV)).toEqual({ phase: "cleaned" });
    await expect(assertAccountLive(f.db(), U)).rejects.toThrow("Unauthorized");
  });
  it("assertLoginExists rejects once the login is gone (old token no longer enough)", async () => {
    const f = new Fake();
    await expect(assertLoginExists(f.db(), U)).resolves.toBeUndefined();
    f.users.delete(U);
    await expect(assertLoginExists(f.db(), U)).rejects.toThrow();
  });
  it("readiness needs the flag and both tables", async () => {
    const f = new Fake();
    expect(await readiness(f.db(), U, {})).toEqual({ ready: false });
    f.failTable.add("select:account_deletion_jobs");
    expect(await readiness(f.db(), U, ENV)).toEqual({ ready: false });
    f.failTable.clear();
    expect(await readiness(f.db(), U, ENV)).toEqual({ ready: true });
  });
  it("teacher dashboard rows show the saved name with the left-course label", () => {
    const rows = buildStudentRows([{ course_id: "c", student_id: U, created_at: "2026-01-01" }], [], [], [], [{ id: U, full_name: "Sara", email: null }]);
    expect(rows[0]?.name).toBe("Sara (الطالب خرج من المادة)");
    expect(rows[0]?.left).toBe(true);
  });
});
