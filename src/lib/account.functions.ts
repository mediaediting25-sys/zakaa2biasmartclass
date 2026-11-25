import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireLiveAccount } from "@/lib/live-account-middleware";
import type { DbLike, JobOutcome } from "@/server/account-deletion.server";

export type { JobOutcome };

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as DbLike;
}

/** The session client, with the new database functions (not yet in the generated types) reachable by name. */
type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
const asRpc = (c: unknown) => c as Rpc;

export type MyRequest = { id: string; status: string; requested_at: string; expires_at: string; job_phase: string | null } | null;
export type RequestRow = {
  id: string; version: number; user_id: string; full_name: string | null; email: string | null; role: string | null; status: string;
  requested_at: string; expires_at: string; job_id: string | null; job_phase: string | null; job_error: string | null; owner_only: boolean; can_approve: boolean;
};

/** Is the feature switched on and is the database ready? The button stays hidden otherwise. */
export const getAccountDeletionReadiness = createServerFn({ method: "GET" })
  .middleware([requireLiveAccount])
  .handler(async ({ context }) => {
    const { readiness } = await import("@/server/account-deletion.server");
    return readiness(await adminDb(), context.userId, process.env);
  });

export const getMyDeletionRequest = createServerFn({ method: "GET" })
  .middleware([requireLiveAccount])
  .handler(async ({ context }): Promise<MyRequest> => {
    const { deletionEnabled } = await import("@/server/account-deletion.server");
    if (!deletionEnabled(process.env, context.userId)) return null;
    const r = await asRpc(context.supabase).rpc("my_account_deletion_request");
    if (r.error) throw new Error("failed");
    return ((r.data as MyRequest[] | null) ?? [])[0] ?? null;
  });

export type RequestResult = { ok: true } | { ok: false; reason: "not_ready" | "owner" | "has_courses" | "has_classes" | "has_audit_links" | "already_pending" | "email_mismatch" | "not_acknowledged" | "warning_outdated" | "failed" };

/** The signed-in person asks for their own account to be deleted. Nothing is deleted here; approvers are notified in the app. */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireLiveAccount])
  .inputValidator((d: unknown) => z.object({ warningVersion: z.number().int().min(1), typedEmail: z.string().max(320), acknowledged: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<RequestResult> => {
    const { deletionEnabled } = await import("@/server/account-deletion.server");
    if (!deletionEnabled(process.env, context.userId)) return { ok: false, reason: "not_ready" };
    const r = await asRpc(context.supabase).rpc("request_account_deletion", { _warning_version: data.warningVersion, _typed_email: data.typedEmail, _acknowledged: data.acknowledged });
    if (!r.error) return { ok: true };
    const m = r.error.message ?? "";
    if (m.includes("disabled")) return { ok: false, reason: "not_ready" };
    for (const k of ["email_mismatch", "not_acknowledged", "warning_outdated"] as const) if (m.includes(k)) return { ok: false, reason: k };
    if (m.includes("owner")) return { ok: false, reason: "owner" };
    if (m.includes("has_courses")) return { ok: false, reason: "has_courses" };
    if (m.includes("has_classes")) return { ok: false, reason: "has_classes" };
    if (m.includes("has_audit_links")) return { ok: false, reason: "has_audit_links" };
    if (m.includes("already_pending")) return { ok: false, reason: "already_pending" };
    return { ok: false, reason: "failed" };
  });

export const cancelMyDeletionRequest = createServerFn({ method: "POST" })
  .middleware([requireLiveAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const r = await asRpc(context.supabase).rpc("cancel_account_deletion_request", { _id: data.id });
    return { ok: !r.error && r.data === true };
  });

/** Approvers only (owner or general admin). The database refuses everyone else. */
export const listDeletionRequests = createServerFn({ method: "GET" })
  .middleware([requireLiveAccount])
  .handler(async ({ context }): Promise<RequestRow[]> => {
    const r = await asRpc(context.supabase).rpc("list_account_deletion_requests");
    if (r.error) throw new Error("Forbidden");
    return (r.data as RequestRow[]) ?? [];
  });

/** Approve or reject. The database decides who may, and only one decision can win. An approval starts the job at once. */
export const decideDeletionRequest = createServerFn({ method: "POST" })
  .middleware([requireLiveAccount])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), version: z.number().int(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: "forbidden" | "already_decided" | "owner" | "has_courses" | "has_classes" | "has_audit_links" | "admin_needs_owner" | "failed"; phase?: string; note?: string }> => {
    const { deletionEnabled, runDeletionJob } = await import("@/server/account-deletion.server");
    if (!deletionEnabled(process.env)) return { ok: false, reason: "failed" };
    const r = await asRpc(context.supabase).rpc("decide_account_deletion_request", { _id: data.id, _version: data.version, _approve: data.approve });
    if (r.error) {
      const m = r.error.message ?? "";
      return { ok: false, reason: m.includes("forbidden") ? "forbidden" : m.includes("already_decided") ? "already_decided" : m.includes("admin_needs_owner") ? "admin_needs_owner" : m.includes("owner") ? "owner" : m.includes("has_courses") ? "has_courses" : m.includes("has_classes") ? "has_classes" : m.includes("has_audit_links") ? "has_audit_links" : "failed" };
    }
    if (data.approve && typeof r.data === "string") {
      const out = await runDeletionJob(await adminDb(), r.data, process.env).catch(() => ({ phase: "unknown" }) as JobOutcome);
      return out.note === undefined ? { ok: true, phase: out.phase } : { ok: true, phase: out.phase, note: out.note };
    }
    return { ok: true };
  });

/** Approvers only: retry any unresolved job whose lease is free (retries the approved user id, never an email lookup). */
export const runPendingDeletionJobs = createServerFn({ method: "POST" })
  .middleware([requireLiveAccount])
  .handler(async ({ context }): Promise<{ ran: number; more: boolean }> => {
    const { deletionEnabled } = await import("@/server/account-deletion.server");
    if (!deletionEnabled(process.env)) throw new Error("Forbidden");
    const ok = await asRpc(context.supabase).rpc("is_deletion_approver");
    if (ok.error || ok.data !== true) throw new Error("Forbidden");
    const { runPendingJobs } = await import("@/server/account-deletion.server");
    const res = await runPendingJobs(await adminDb(), process.env);
    return { ran: res.outcomes.length, more: res.more };
  });
