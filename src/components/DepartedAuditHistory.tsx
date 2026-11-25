import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";

type Row = { user_id: string; departed_name: string | null; departed_email: string | null; left_at: string; relation: "teacher" | "granted_by" | "reviewed_by"; source: "access_period" | "renewal_request"; row_id: string; snapshot: Record<string, unknown>; counterpart_name: string | null };
type RpcClient = { rpc: (fn: string) => Promise<{ data: Row[] | null; error: unknown }> };

/** Read-only: subscription history of people who left the platform, saved with names when they left. Shown only to subscription editors. */
export function DepartedAuditHistory() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const q = useQuery({ queryKey: ["departed-audit-history"], retry: false, queryFn: async () => {
    const r = await (supabase as unknown as RpcClient).rpc("list_departed_audit_history");
    if (r.error) throw r.error;
    return r.data ?? [];
  } });
  if (q.isError || !q.data || q.data.length === 0) return null;
  const day = (v: unknown) => (typeof v === "string" ? new Date(v).toLocaleDateString(ar ? "ar-EG" : "en-GB") : "");
  const plan = (id: unknown) => PLANS.find((p) => p.id === id)?.[ar ? "ar" : "en"].name ?? String(id ?? "");
  const line = (r: Row) => {
    const s = r.snapshot;
    const who = r.departed_name || r.departed_email || "";
    const other = r.counterpart_name || (ar ? "غير معروف" : "unknown");
    if (r.source === "access_period") {
      const span = `${plan(s["plan_id"])} · ${day(s["starts_at"])} → ${day(s["ends_at"])}`;
      return r.relation === "teacher" ? (ar ? `مدة لـ ${who}: ${span}، منحها ${other}` : `Access for ${who}: ${span}, granted by ${other}`)
        : (ar ? `مدة منحها ${who} لـ ${other}: ${span}` : `Access granted by ${who} to ${other}: ${span}`);
    }
    const st = ({ pending: ar ? "قيد المراجعة (لن يُنفذ)" : "was pending (will not be processed)", approved: ar ? "مقبول" : "approved", rejected: ar ? "مرفوض" : "rejected" } as Record<string, string>)[String(s["status"])] ?? String(s["status"]);
    return r.relation === "teacher" ? (ar ? `طلب تجديد من ${who}: ${plan(s["plan_id"])}، ${st}${r.counterpart_name ? `، راجعه ${other}` : ""}` : `Renewal request from ${who}: ${plan(s["plan_id"])}, ${st}${r.counterpart_name ? `, reviewed by ${other}` : ""}`)
      : (ar ? `طلب تجديد من ${other} راجعه ${who}: ${st}` : `Renewal request from ${other} reviewed by ${who}: ${st}`);
  };
  return (
    <section aria-label={ar ? "سجل الحسابات المغادرة" : "Departed accounts history"} className="mt-8 border-t border-border pt-4">
      <h3 className="text-lg font-semibold">{ar ? "سجل اشتراكات الحسابات التي غادرت" : "Subscription history of departed accounts"}</h3>
      <p className="mb-2 text-sm text-muted-foreground">{ar ? "للقراءة فقط. محفوظ بالأسماء وقت المغادرة." : "Read only. Saved with names at the time they left."}</p>
      <ul className="space-y-2">
        {q.data.map((r) => (
          <li key={`${r.relation}-${r.source}-${r.row_id}`} className="surface p-3 text-sm">{line(r)}<span className="block text-xs text-muted-foreground">{ar ? "غادر في " : "Left on "}{day(r.left_at)}</span></li>
        ))}
      </ul>
    </section>
  );
}
