import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DELETION_WARNING_VERSION, emailConfirmed } from "@/lib/account-deletion";
import { useI18n } from "@/lib/i18n";
import { cancelMyDeletionRequest, getAccountDeletionReadiness, getMyDeletionRequest, requestAccountDeletion } from "@/lib/account.functions";

const PHASE_AR: Record<string, string> = {
  needs_storage_review: "حسابك يحتوي على ملفات مرفوعة، وتنتظر مراجعة الإدارة قبل المتابعة.",
  delete_requested: "بدأ تنفيذ الحذف. الحساب مغلق ولا يمكن إلغاء الطلب.",
  blocked: "بدأ تنفيذ الحذف. الحساب مغلق ولا يمكن إلغاء الطلب.",
  approved: "تمت الموافقة، والتنفيذ قيد الإعداد.",
};
const PHASE_EN: Record<string, string> = {
  needs_storage_review: "Your account has uploaded files and is waiting for an admin review before it can continue.",
  delete_requested: "Deletion has started. The account is locked and the request cannot be cancelled.",
  blocked: "Deletion has started. The account is locked and the request cannot be cancelled.",
  approved: "Approved. Deletion is being prepared.",
};

export function DeleteAccountDialog({ role, email }: { role: string | null | undefined; email: string | null | undefined }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const qc = useQueryClient();
  const request = useServerFn(requestAccountDeletion);
  const cancel = useServerFn(cancelMyDeletionRequest);
  const readiness = useServerFn(getAccountDeletionReadiness);
  const mine = useServerFn(getMyDeletionRequest);
  const ready = useQuery({ queryKey: ["account-deletion-ready"], queryFn: () => readiness(), staleTime: 5 * 60 * 1000, retry: false });
  const current = useQuery({ queryKey: ["my-deletion-request"], queryFn: () => mine(), enabled: !!ready.data?.ready, retry: false });
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const isAdmin = role === "admin";
  if (!ready.data?.ready) return null;
  const req = current.data;
  const pending = req?.status === "pending";
  const canSubmit = understood && !!email && emailConfirmed(email, typed) && !busy;

  async function submit() {
    setBusy(true);
    setProblem(null);
    try {
      const r = await request({ data: { warningVersion: DELETION_WARNING_VERSION, typedEmail: typed, acknowledged: understood } });
      if (r.ok) await qc.invalidateQueries({ queryKey: ["my-deletion-request"] });
      else if (r.reason === "owner") setProblem(ar ? "حساب مالك المنصة لا يُحذف." : "The platform owner account cannot be deleted.");
      else if (r.reason === "has_courses") setProblem(ar ? "لديك مواد على المنصة. تواصل مع إدارة المنصة لنقلها أو حذفها أولًا، ثم أعد المحاولة." : "You still have courses. Ask the platform admin to transfer or remove them first, then try again.");
      else if (r.reason === "has_classes") setProblem(ar ? "لديك فصول على المنصة. تواصل مع إدارة المنصة لنقلها أو معالجتها أولًا، ثم أعد المحاولة." : "You still have classes. Ask the platform administration to move or resolve them first, then try again.");
      else if (r.reason === "has_audit_links") setProblem(ar ? "حسابك مسجل في سجل الاشتراكات. تواصل مع إدارة المنصة أولًا، ثم أعد المحاولة." : "Your account is named in subscription records. Ask the platform administration first, then try again.");
      else if (r.reason === "email_mismatch") setProblem(ar ? "البريد المكتوب لا يطابق بريد حسابك." : "The email you typed does not match your account email.")
      else if (r.reason === "not_acknowledged" || r.reason === "warning_outdated") setProblem(ar ? "أعد فتح النافذة وأكد من جديد." : "Reopen this window and confirm again.")
      else if (r.reason === "already_pending") await qc.invalidateQueries({ queryKey: ["my-deletion-request"] });
      else setProblem(ar ? "تعذر إرسال الطلب. لم يتم حذف شيء. حاول بعد قليل." : "Could not send the request. Nothing was deleted. Try again shortly.");
    } catch {
      setProblem(ar ? "تعذر إرسال الطلب. لم يتم حذف شيء. حاول بعد قليل." : "Could not send the request. Nothing was deleted. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!req) return;
    setBusy(true);
    try {
      const r = await cancel({ data: { id: req.id } });
      if (!r.ok) setProblem(ar ? "تعذر إلغاء الطلب، ربما تم البت فيه." : "Could not cancel; it may already be decided.");
      await qc.invalidateQueries({ queryKey: ["my-deletion-request"] });
    } finally {
      setBusy(false);
    }
  }

  const phaseText = req?.job_phase ? (ar ? PHASE_AR : PHASE_EN)[req.job_phase] : undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setProblem(null); setTyped(""); setUnderstood(false); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={ar ? "حذف حسابي" : "Delete my account"} title={ar ? "حذف حسابي" : "Delete my account"} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="text-start sm:text-start pr-10">
          <DialogTitle>{ar ? "طلب حذف حسابي نهائيًا" : "Request permanent deletion of my account"}</DialogTitle>
          <DialogDescription>
            {isAdmin ? (ar ? "لا يُحذف الحساب بمجرد طلبك. يصل الطلب إلى مالك المنصة والإدارة العامة داخل المنصة، لكن الموافقة على حذف حساب أدمن من المالك نفسه فقط." : "Your account is not deleted by asking. The request goes to the platform owner and the general admins inside the app, but only the platform owner can approve deleting an administrator account.") : (ar ? "لا يُحذف الحساب بمجرد طلبك. يصل الطلب إلى مالك المنصة والإدارة العامة داخل المنصة، وتكفي موافقة واحد منهم." : "Your account is not deleted by asking. The request goes to the platform owner and the general admins inside the app, and one approval is enough.")}
          </DialogDescription>
        </DialogHeader>

        {req && (pending || req.status === "approved") ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-lg bg-secondary p-3">
              {pending
                ? (isAdmin ? (ar ? "طلبك بانتظار موافقة مالك المنصة نفسه. يمكنك إلغاؤه قبل الموافقة." : "Your request is waiting for the platform owner's own approval. You can cancel it before it is approved.") : (ar ? "طلبك بانتظار موافقة المالك أو الإدارة العامة. يمكنك إلغاؤه قبل الموافقة." : "Your request is waiting for the owner or a general admin. You can cancel it before it is approved."))
                : (phaseText ?? (ar ? "تمت الموافقة على طلبك." : "Your request was approved."))}
            </p>
            {pending && <Button variant="outline" disabled={busy} onClick={withdraw}>{ar ? "إلغاء الطلب" : "Cancel the request"}</Button>}
          </div>
        ) : (
          <>
            {req?.status === "aborted" && <p className="rounded-lg bg-secondary p-3 text-sm">{ar ? "تعذر تنفيذ طلبك السابق ولم يتغير شيء في حسابك. يمكنك إرسال طلب جديد." : "Your previous request could not be carried out and nothing changed on your account. You can send a new request."}</p>}
            {req?.status === "rejected" && <p className="rounded-lg bg-secondary p-3 text-sm">{ar ? "تم رفض طلبك السابق. حسابك كما هو." : "Your previous request was rejected. Your account is unchanged."}</p>}
            <div className="space-y-2 text-sm">
              <p className="rounded-lg bg-destructive/10 p-3 text-destructive">
                <b>{ar ? "تحذير، لا يمكن التراجع بعد التنفيذ: " : "Warning, this cannot be undone once carried out: "}</b>
                {ar ? "سيُحذف تسجيل دخولك وملفك الشخصي وإشعاراتك وروابط ولي الأمر وطلبات الانضمام. لن تستطيع الدخول بهذا البريد، ولن يمكن التسجيل به مرة أخرى كحساب جديد إلا بعد الحذف النهائي. عند بدء التنفيذ يُغلق حسابك فورًا." : "Your login, profile, notifications, parent links and join requests will be deleted. You will not be able to sign in with this email, and it can only register again as a brand new account after the deletion completes. Once carried out, your account is locked immediately."}
              </p>
              {isStudent && (
                <p className="rounded-lg bg-secondary p-3">
                  <b>{ar ? "يبقى عند معلميك: " : "Kept for your teachers: "}</b>
                  {ar ? "سجلك التعليمي (الدرجات والمحاولات والتقدم) مع اسمك وبريدك المحفوظين لدى المنصة، ويظهر اسمك مع عبارة «الطالب خرج من المادة»." : "your learning record (grades, attempts, progress) together with your name and email saved by the platform, shown with the note “the student left the course”."}
                </p>
              )}
              {isTeacher && (
                <p className="rounded-lg bg-secondary p-3">
                  <b>{ar ? "ملاحظات: " : "Notes: "}</b>
                  {ar ? "إذا كانت لديك مواد أو فصول فلن يُقبل الطلب قبل أن تعالجها إدارة المنصة، وحذف المادة يمحو درجات طلابها نهائيًا. ويبقى سجل اشتراكك لدى إدارة المنصة باسمك. وإذا كانت لديك ملفات مرفوعة قد ينتظر الحذف مراجعة الإدارة." : "If you have courses or classes the request is refused until the platform admin resolves them; removing a course permanently erases its students' grades. Your subscription history stays with the platform administration under your name. If you uploaded files, deletion may wait for an admin review."}
                </p>
              )}
              {!isStudent && !isTeacher && (
                <p className="rounded-lg bg-secondary p-3">{ar ? "لا يتأثر السجل التعليمي لأي طالب بحذف حسابك." : "Deleting your account does not change any student's learning record."}</p>
              )}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block">{ar ? "اكتب بريدك الإلكتروني للتأكيد" : "Type your email to confirm"}</span>
              <Input dir="ltr" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email ?? ""} autoComplete="off" />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              <span>{ar ? "فهمت المخاطر وأن الحذف نهائي لا رجعة فيه." : "I understand the risks and that deletion is permanent."}</span>
            </label>
            <Button variant="destructive" disabled={!canSubmit} onClick={submit}>{ar ? "إرسال طلب الحذف" : "Send deletion request"}</Button>
          </>
        )}
        {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      </DialogContent>
    </Dialog>
  );
}
