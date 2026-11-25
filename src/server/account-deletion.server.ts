type Row = Record<string, unknown>;
type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
/** Minimal shape of the Supabase client used here (so tests can supply a fake). */
export type DbLike = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  storage: { from: (bucket: string) => any };
  auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string | null } | null }; error: unknown }>; deleteUser: (id: string, soft?: boolean) => Promise<{ error: unknown }> } };
};
const failed = (r: QueryResult) => !!r.error;

/**
 * The feature flag must be "true". While ACCOUNT_DELETION_TEST_USER_IDS holds a comma-separated list of user ids, ONLY those
 * accounts can see or use the feature (test phase); remove that variable to open it to everyone. A caller without a user id
 * (the cleanup sweep) is only asked about the flag.
 */
export function deletionEnabled(env: Record<string, string | undefined>, userId?: string) {
  if (env["ACCOUNT_DELETION_ENABLED"] !== "true") return false;
  const list = env["ACCOUNT_DELETION_TEST_USER_IDS"];
  if (list === undefined) return true;
  // Variable present = test phase. Empty or malformed entries fail closed (nobody), never open to everyone.
  const ids = list.split(",").map((x) => x.trim().toLowerCase());
  if (ids.length === 0 || ids.some((x) => !UUID.test(x))) return false;
  if (!userId) return true;
  return ids.includes(userId.toLowerCase());
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type LoginState = "exists" | "gone" | "unknown";

/**
 * Asks the auth system about a login. "gone" ONLY for an explicit not-found answer (HTTP 404 or code user_not_found).
 * Any other error (network, 5xx, rate limit, bad key) is "unknown", never treated as proof the login is gone.
 */
export async function loginState(db: DbLike, userId: string): Promise<LoginState> {
  try {
    const r = await db.auth.admin.getUserById(userId);
    if (!r.error) return r.data?.user ? "exists" : "unknown";
    const e = r.error as { status?: unknown; code?: unknown };
    return e?.status === 404 || e?.code === "user_not_found" ? "gone" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Throws unless the login still exists. Old tokens of deleted accounts stay cryptographically valid, so writes must ask. */
export async function assertLoginExists(db: DbLike, userId: string) {
  if ((await loginState(db, userId)) !== "exists") throw new Error("هذا الحساب لم يعد موجودًا");
}

/** Shown when the account check itself could not be answered (provider or database hiccup). Not a statement about the account. */
export const ACCOUNT_CHECK_UNAVAILABLE = "تعذر التحقق من الحساب مؤقتًا. لم يتغير شيء، أعد المحاولة بعد لحظات — Temporary account check problem. Nothing was changed, try again in a moment";

type LiveState = "live" | "gone" | "blocked" | "unknown";

async function liveState(db: DbLike, userId: string): Promise<LiveState> {
  const login = await loginState(db, userId);
  if (login !== "exists") return login === "gone" ? "gone" : "unknown";
  try {
    const b: QueryResult = await db.from("blocked_accounts").select("user_id").eq("user_id", userId).maybeSingle();
    if (failed(b)) return "unknown";
    return b.data ? "blocked" : "live";
  } catch {
    return "unknown";
  }
}

/**
 * Throws unless this account may use server functions that run with the service role: the login must still exist
 * and the account must not be blocked. Always fails closed, but the two failures differ: "Unauthorized" ONLY when the
 * provider says the login is gone (explicit not-found) or the account is blocked; a check that cannot be answered
 * (network, 5xx, rate limit, database error) throws ACCOUNT_CHECK_UNAVAILABLE after one short retry, so a hiccup is never
 * shown as an invalid account. No caching: every call asks again, so a revoke takes effect on the next call.
 */
export async function assertAccountLive(db: DbLike, userId: string, retryDelayMs = 250) {
  let s = await liveState(db, userId);
  if (s === "unknown") {
    await new Promise((r) => setTimeout(r, retryDelayMs));
    s = await liveState(db, userId);
  }
  if (s === "live") return;
  throw new Error(s === "unknown" ? ACCOUNT_CHECK_UNAVAILABLE : "Unauthorized");
}

export async function readiness(db: DbLike, userId: string, env: Record<string, string | undefined>) {
  if (!deletionEnabled(env, userId)) return { ready: false };
  const probe: QueryResult = await db.from("account_deletion_jobs").select("id").limit(1);
  const probe2: QueryResult = await db.from("departed_accounts").select("user_id").limit(1);
  return { ready: !probe.error && !probe2.error };
}

export type JobPhase = "approved" | "needs_storage_review" | "blocked" | "delete_requested" | "deleted_confirmed" | "cleaned" | "aborted";
export type JobOutcome = { phase: JobPhase | "busy" | "unknown"; note?: string };

const LEASE_SECONDS = 120;

/** True when the SQL function answered with exactly `true`. */
const yes = (r: { data: unknown; error: unknown }) => !r.error && r.data === true;

/**
 * Runs one approved deletion job. Safe to call again and again: a lease with a counter lets only one worker act, and a stale worker
 * is refused by the database. Before the delete call everything can be undone (only OUR block is removed, by its token). Once
 * "delete_requested" is written the job only goes forward: it is retried by the approved user id and never rolled back.
 */
export async function runDeletionJob(db: DbLike, jobId: string, env: Record<string, string | undefined>): Promise<JobOutcome> {
  if (!deletionEnabled(env)) return { phase: "unknown", note: "disabled" };
  const pre: QueryResult = await db.from("account_deletion_jobs").select("user_id").eq("id", jobId).maybeSingle();
  const target = (pre.data as { user_id?: string } | null)?.user_id;
  if (failed(pre) || !target || !deletionEnabled(env, target)) return { phase: "unknown", note: "disabled_for_target" };
  const claim = await db.rpc("deletion_job_claim", { _job: jobId, _lease_seconds: LEASE_SECONDS });
  if (claim.error) return { phase: "unknown", note: "claim_failed" };
  if (typeof claim.data !== "number") return { phase: "busy" };
  const epoch = claim.data;

  const jr: QueryResult = await db.from("account_deletion_jobs").select("user_id, phase, block_acquired").eq("id", jobId).maybeSingle();
  const job = jr.data as { user_id: string; phase: JobPhase; block_acquired: boolean } | null;
  if (failed(jr) || !job) return { phase: "unknown", note: "job_unreadable" };
  const userId = job.user_id;
  const setPhase = async (phase: JobPhase, error?: string) => yes(await db.rpc("deletion_job_set_phase", { _job: jobId, _epoch: epoch, _phase: phase, _error: error ?? null }));
  const abort = async (why: string): Promise<JobOutcome> => (yes(await db.rpc("deletion_job_abort", { _job: jobId, _epoch: epoch, _error: why })) ? { phase: "aborted", note: why } : { phase: "unknown", note: "abort_not_confirmed:" + why });

  if (job.phase === "approved" || job.phase === "needs_storage_review" || job.phase === "blocked") {
    // 1. The login must be known to exist. Anything else (including "cannot tell") stops with nothing changed.
    const st = await loginState(db, userId);
    if (st === "gone") {
      // The provider said "not found" explicitly (never a lookup error). This approved job names this exact account, so it is finished
      // from the saved request: a block row stays (old tokens refused), the name comes from the profile or the saved request, then the normal cleanup runs.
      if (yes(await db.rpc("deletion_job_reconcile_gone", { _job: jobId, _epoch: epoch }))) job.phase = "deleted_confirmed";
      else return job.phase === "blocked" ? abort("login_missing") : (await setPhase("approved", "login_missing"), { phase: "approved", note: "login_gone_needs_review" });
    } else if (st !== "exists") return job.phase === "blocked" ? abort("login_unknown") : (await setPhase("approved", "login_unknown"), { phase: "approved", note: "login_unknown" });
  }
  if (job.phase === "approved" || job.phase === "needs_storage_review" || job.phase === "blocked") {
    // 2. Owner and owned courses are re-checked.
    const blocker = await db.rpc("deletion_blocker", { _user_id: userId });
    if (blocker.error) return { phase: "unknown", note: "blocker_check_failed" };
    if (blocker.data) return abort(String(blocker.data));
    // 3. Storage is fail-closed: if the account owns any stored file (or we cannot count), nothing is touched and an admin must review.
    const owned = await db.rpc("count_owned_storage_objects", { _user_id: userId });
    if (owned.error || owned.data === null || owned.data === undefined || Number(owned.data) !== 0) {
      const why = owned.error ? "storage_count_failed" : "owns_files";
      // A job that already holds its block hands it back (pre-call, safe); a fresh job just parks with nothing changed.
      if (job.phase === "blocked") return abort(why);
      return (await setPhase("needs_storage_review", why)) ? { phase: "needs_storage_review" } : { phase: "unknown", note: "phase_write_failed" };
    }
    // 4. Block (only if none exists), then save the name, then write the point of no return BEFORE calling delete.
    const got = await db.rpc("deletion_job_acquire_block", { _job: jobId, _epoch: epoch });
    if (got.error) return { phase: "unknown", note: "block_failed" };
    // Block is in place: no new course can appear now. Look again; the database also refuses delete_requested if this changes later.
    const again = await db.rpc("deletion_blocker", { _user_id: userId });
    if (again.error) return abort("blocker_recheck_failed");
    if (again.data) return abort(String(again.data));
    if (!yes(await db.rpc("deletion_job_save_departed", { _job: jobId, _epoch: epoch }))) return abort("departed_save_failed");
    if (!(await setPhase("delete_requested"))) return abort("phase_write_failed");
  }

  if (job.phase !== "deleted_confirmed") {
    // Roll forward only, always by the approved user id.
    const gone = await db.auth.admin.deleteUser(userId, false);
    if (gone.error) {
      const after = await loginState(db, userId);
      if (after !== "gone") {
        await setPhase("delete_requested", after === "exists" ? "delete_failed_will_retry" : "delete_unknown_will_retry");
        return { phase: "delete_requested", note: after };
      }
    }
    if (!(await setPhase("deleted_confirmed"))) return { phase: "delete_requested", note: "phase_write_failed" };
  }

  // Cleanup: fenced SQL for the rows, then the photo files (lease re-checked right before), then the final phase.
  const rows = await db.rpc("deletion_job_cleanup_rows", { _job: jobId, _epoch: epoch });
  if (!yes(rows)) return { phase: "deleted_confirmed", note: "cleanup_pending" };
  if (!yes(await db.rpc("deletion_job_holds_lease", { _job: jobId, _epoch: epoch, _phase: "deleted_confirmed" }))) return { phase: "deleted_confirmed", note: "lease_lost" };
  if (!(await removeAvatars(db, userId).catch(() => false))) return { phase: "deleted_confirmed", note: "cleanup_pending" };
  if (!(await setPhase("cleaned"))) return { phase: "deleted_confirmed", note: "phase_write_failed" };
  return { phase: "cleaned" };
}

/** Runs every unresolved job whose lease is free. Called by approvers/owner (button) and after each approval. */
export async function runPendingJobs(db: DbLike, env: Record<string, string | undefined>): Promise<{ outcomes: JobOutcome[]; more: boolean }> {
  if (!deletionEnabled(env)) return { outcomes: [], more: false };
  const list = env["ACCOUNT_DELETION_TEST_USER_IDS"];
  const only = list === undefined ? null : list.split(",").map((x) => x.trim().toLowerCase());
  // The database picks only jobs that can run now (unfinished, target allowed, lease free), oldest-touched first, parked ones last,
  // so a pile of stuck or out-of-scope jobs cannot crowd out the rest.
  const r = await db.rpc("deletion_runnable_jobs", { _only: only, _limit: SWEEP_LIMIT + 1 });
  if (r.error || !Array.isArray(r.data)) return { outcomes: [], more: false };
  const ids = (r.data as string[]).slice(0, SWEEP_LIMIT);
  const out: JobOutcome[] = [];
  for (const id of ids) out.push(await runDeletionJob(db, id, env));
  return { outcomes: out, more: (r.data as string[]).length > SWEEP_LIMIT };
}
const SWEEP_LIMIT = 20;

/** Deletes everything under the person's folder in the photo bucket, including sub-folders. True only after a fresh listing shows it empty. */
async function removeAvatars(db: DbLike, userId: string): Promise<boolean> {
  const bucket = db.storage.from("teacher-avatars");
  const purge = async (prefix: string, depth: number): Promise<boolean> => {
    if (depth > 5) return false;
    let lastSig = "";
    for (let round = 0; round < 200; round++) {
      const listing: QueryResult = await bucket.list(prefix, { limit: 1000, offset: 0 });
      if (failed(listing)) return false;
      const items = (listing.data ?? []) as { name: string; id?: string | null }[];
      if (!items.length) return true;
      // The same names twice in a row means nothing could be removed: stop and report not done.
      const sig = items.map((i) => i.name).join("\u0000");
      if (sig === lastSig) return false;
      lastSig = sig;
      const files = items.filter((i) => i.id !== null).map((i) => `${prefix}/${i.name}`);
      for (const folder of items.filter((i) => i.id === null)) if (!(await purge(`${prefix}/${folder.name}`, depth + 1))) return false;
      if (files.length && failed((await bucket.remove(files)) as QueryResult)) return false;
    }
    return false;
  };
  return purge(userId, 0);
}

