import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { decideDeletionRequest, listDeletionRequests, runPendingDeletionJobs } from "@/lib/account.functions";
import { useI18n } from "@/lib/i18n";

const ERR_AR: Record<string, string> = { admin_needs_owner: "حذف حساب أدمن يحتاج موافقة المالك نفسه", owns_files: "الحساب يملك ملفات مرفوعة", storage_count_failed: "تعذر فحص الملفات المرفوعة", login_unknown: "تعذر التأكد من حالة الحساب، استخدم إعادة المحاولة", delete_failed_will_retry: "فشل الحذف، استخدم إعادة المحاولة", delete_unknown_will_retry: "تعذر التأكد من نتيجة الحذف، استخدم إعادة المحاولة", has_courses: "الحساب يملك مواد", has_classes: "الحساب يملك فصولًا", owner: "حساب مالك المنصة", has_audit_links: "الحساب مسجل في سجل اشتراكات", login_missing: "لم يعد للحساب دخول" };
const ERR_EN: Record<string, string> = { admin_needs_owner: "deleting an administrator needs the platform owner's own approval", owns_files: "the account owns uploaded files", storage_count_failed: "could not check uploaded files", login_unknown: "could not confirm the account state, use retry", delete_failed_will_retry: "deletion failed, use retry", delete_unknown_will_retry: "could not confirm the deletion result, use retry", has_courses: "the account owns courses", has_classes: "the account owns classes", owner: "the platform owner account", has_audit_links: "the account is named in subscription records", login_missing: "the account no longer has a login" };
const PHASE_AR: Record<string, string> = {
  approved: "تمت الموافقة، لم يبدأ التنفيذ",
  needs_storage_review: "تحتاج مراجعة. لم يتم تغيير شيء",
  blocked: "الحساب مغلق وجارٍ التنفيذ",
  delete_requested: "جارٍ الحذف (مقفل). أعد المحاولة إن تعثر",
  deleted_confirmed: "تم حذف الدخول، يُستكمل التنظيف",
};
const PHASE_EN: Record<string, string> = {
  approved: "Approved, not started",
  needs_storage_review: "Needs review. Nothing was changed",
  blocked: "Account locked, executing",
  delete_requested: "Deleting (locked). Retry if it stalls",
  deleted_confirmed: "Login deleted, finishing cleanup",
};

/** Owner and general admins. Pending deletion requests, approve/reject, and unresolved jobs. Hidden for everyone else. */
export function PendingCleanupButton() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const qc = useQueryClient();
  const list = useServerFn(listDeletionRequests);
  const decide = useServerFn(decideDeletionRequest);
  const retry = useServerFn(runPendingDeletionJobs);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["deletion-requests"], queryFn: () => list(), retry: false, refetchInterval: 60_000 });
  // Opening the panel resumes jobs that were ALREADY approved (the server only runs approved jobs, never a pending request). There is no background scheduler.
  const resumed = useRef(false);
  const hasJobs = !!q.data?.some((r) => r.job_phase);
  useEffect(() => {
    if (!hasJobs || resumed.current) return;
    resumed.current = true;
    retry().then(() => qc.invalidateQueries({ queryKey: ["deletion-requests"] })).catch(() => undefined);
  }, [hasJobs, retry, qc]);
  if (q.isError || !q.data || q.data.length === 0) return null;
  const stuck = q.data.filter((r) => r.job_phase === "delete_requested" || r.job_phase === "deleted_confirmed").length;

  async function act(id: string, version: number, approve: boolean) {
    setBusy(true);
    try {
      const r = await decide({ data: { id, version, approve } });
      if (r.ok && !approve) toast.success(ar ? "تم الرفض" : "Rejected");
      else if (r.ok && r.phase === "cleaned") toast.success(ar ? "تمت الموافقة وتم الحذف" : "Approved and the account was deleted");
      else if (r.ok && r.phase === "deleted_confirmed") toast.message(ar ? "تمت الموافقة. الحساب حُذف والتنظيف لم يكتمل بعد" : "Approved. The account is deleted; cleanup is not finished yet");
      else if (r.ok && (r.phase === "needs_storage_review" || r.phase === "aborted")) {
        const why = r.note ? (ar ? ERR_AR : ERR_EN)[r.note] : undefined;
        toast.message((ar ? "تمت الموافقة لكن لم يُحذف شيء" : "Approved, but nothing was deleted") + (why ? (ar ? `: ${why}` : `: ${why}`) : ""));
      }
      else if (r.ok) toast.message(ar ? "تمت الموافقة. لم يكتمل التنفيذ بعد. استخدم «إعادة محاولة المهام المعلقة»" : "Approved. Execution has not finished. Use \"Retry unfinished jobs\"");
      else if (r.reason === "already_decided") toast.error(ar ? "تم البت في هذا الطلب بالفعل" : "This request was already decided");
      else if (r.reason === "admin_needs_owner") toast.error(ar ? "حذف حساب أدمن يحتاج موافقة المالك نفسه" : "Deleting an administrator needs the platform owner's own approval");
      else if (r.reason === "has_audit_links") toast.error(ar ? "الحساب مسجل في سجل اشتراكات. عالجه أولًا" : "The account is named in subscription records. Resolve that first");
      else if (r.reason === "has_classes") toast.error(ar ? "صاحب الحساب لديه فصول. عالجها أولًا" : "The account owns classes. Resolve them first");
      else if (r.reason === "has_courses") toast.error(ar ? "صاحب الحساب لديه مواد. عالجها أولًا" : "The account owns courses. Resolve them first");
      else toast.error(ar ? "تعذر تنفيذ العملية" : "Could not complete the action");
    } catch {
      toast.error(ar ? "تعذر تنفيذ العملية" : "Could not complete the action");
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ["deletion-requests"] });
    }
  }
  async function again() {
    setBusy(true);
    try { await retry(); } catch { toast.error(ar ? "تعذرت إعادة المحاولة" : "Retry failed"); } finally { setBusy(false); await qc.invalidateQueries({ queryKey: ["deletion-requests"] }); }
  }

  return (
    <section className="surface mb-6 space-y-3 p-4" aria-label={ar ? "طلبات حذف الحسابات" : "Account deletion requests"}>
      <h2 className="font-bold">{ar ? "طلبات حذف الحسابات" : "Account deletion requests"}</h2>
      <ul className="space-y-3">
        {q.data.map((r) => (
          <li key={r.id} className="rounded-lg border p-3 text-sm">
            <p className="font-semibold">{r.full_name || r.email || "?"} <span dir="ltr" className="text-muted-foreground">{r.email}</span></p>
            {r.status === "pending" && !r.can_approve ? (
              <>
                <p className="mt-1 text-muted-foreground">{ar ? "هذا حساب أدمن. الموافقة على حذفه من المالك نفسه فقط، ويمكنك رفضه." : "This is an administrator account. Only the platform owner can approve its deletion. You can still reject it."}</p>
                <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => act(r.id, r.version, false)}>{ar ? "رفض" : "Reject"}</Button></div>
              </>
            ) : r.status === "pending" ? (
              <>
                <p className="mt-1 text-muted-foreground">
                  {ar ? "الموافقة تبدأ الحذف النهائي فورًا ولا يمكن التراجع عنها. موافقة واحدة تكفي." : "Approving starts permanent deletion immediately and cannot be undone. One approval is enough."}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => act(r.id, r.version, true)}>{ar ? "موافقة وحذف" : "Approve and delete"}</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r.id, r.version, false)}>{ar ? "رفض" : "Reject"}</Button>
                </div>
              </>
            ) : (
              <p className="mt-1">{(ar ? PHASE_AR : PHASE_EN)[r.job_phase ?? ""] ?? r.job_phase}{r.job_error && (ar ? ERR_AR : ERR_EN)[r.job_error] ? ` (${(ar ? ERR_AR : ERR_EN)[r.job_error]})` : ""}</p>
            )}
          </li>
        ))}
      </ul>
      {hasJobs && (
        <p className="text-xs text-muted-foreground">
          {stuck > 0 ? (ar ? `${stuck} مهمة تجاوزت نقطة اللاعودة ولم تكتمل. ` : `${stuck} job(s) are past the point of no return and not finished. `) : ""}
          {ar ? "لا يوجد تشغيل تلقائي في الخلفية: تُستكمل المهام المعتمدة عند فتح هذه الصفحة أو الضغط على إعادة المحاولة." : "There is no automatic background run: approved jobs continue when this page is opened or retry is pressed."}
        </p>
      )}
      {hasJobs && <Button size="sm" variant="outline" disabled={busy} onClick={again}>{ar ? "إعادة محاولة المهام المعلقة" : "Retry unfinished jobs"}</Button>}
    </section>
  );
}
