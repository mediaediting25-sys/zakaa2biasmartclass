import { useState } from "react";
import { MessageCircle, ArrowRightLeft, Smartphone, Copy, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { manualPaymentMethods, manualPaymentDetails, whatsappSubscriptionUrl, type ManualPaymentMethod } from "@/lib/manual-payments";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

const labels = { whatsapp: "التواصل عبر واتساب", instapay: "الدفع عبر إنستاباي", vodafone_cash: "الدفع عبر فودافون كاش" };
const icons = { whatsapp: MessageCircle, instapay: ArrowRightLeft, vodafone_cash: Smartphone };

export function SubscriptionPaymentDialog({ open, onOpenChange, planName, cycle, amount, onRequest, requestPending = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  cycle: string;
  amount?: string;
  onRequest?: () => void;
  requestPending?: boolean;
}) {
  const { tr } = useI18n();
  const [method, setMethod] = useState<ManualPaymentMethod>("whatsapp");
  const detail = manualPaymentDetails[method];
  const message = `${tr("أرغب في الاشتراك في باقة")}: ${planName} — ${tr(cycle === "yearly" ? "سنة كاملة — بسعر عشرة أشهر" : "شهر كامل")}${amount ? ` — ${amount}` : ""}`;
  const whatsappUrl = whatsappSubscriptionUrl(manualPaymentDetails.whatsapp, message);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{tr("طرق الاشتراك")}</DialogTitle>
        <DialogDescription>{planName} · {tr(cycle === "yearly" ? "سنة كاملة — بسعر عشرة أشهر" : "شهر كامل")}{amount && ` · ${amount}`}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2" role="group" aria-label={tr("طرق الاشتراك")}>
        {manualPaymentMethods.map(id => { const Icon = icons[id]; return <Button key={id} variant={method === id ? "default" : "outline"} aria-pressed={method === id} onClick={() => setMethod(id)} className="w-full justify-start whitespace-normal"><Icon className="size-4 shrink-0" />{tr(labels[id])}</Button>; })}
      </div>
      <div className="space-y-3 border-t border-border pt-4" aria-live="polite">
        {!detail ? <p className="text-sm text-muted-foreground">{tr("بيانات هذه الوسيلة غير متاحة حاليًا؛ لا تُرسل أي تحويل قبل تأكيد بيانات الاستلام.")}</p> : method === "whatsapp" && whatsappUrl ? <Button asChild className="w-full"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />{tr("فتح واتساب")}</a></Button> : <><p dir="ltr" className="break-all text-center font-medium">{detail}</p><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(detail); toast.success(tr("تم النسخ")); } catch { toast.error(tr("تعذر النسخ")); } }}><Copy className="size-4" />{tr("نسخ بيانات التحويل")}</Button></>}
        <p className="text-sm text-muted-foreground">{tr("تفعيل الاشتراك بعد مراجعة التحويل من الإدارة. أرسل إثبات التحويل وبيانات حسابك عبر واتساب.")}</p>
        {method !== "whatsapp" && whatsappUrl && <Button asChild variant="outline"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />{tr("إرسال إثبات التحويل عبر واتساب")}</a></Button>}
      </div>
      {onRequest && <Button onClick={onRequest} disabled={requestPending}><CalendarClock className="size-4" />{tr("طلب تجديد الاشتراك")}</Button>}
    </DialogContent>
  </Dialog>;
}