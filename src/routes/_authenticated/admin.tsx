import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Ban, RotateCcw, ShieldCheck, Users, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { canManageBlock, canManageRoles, managedRoles } from "@/lib/admin";
import { setAccountBlocked } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "إدارة المنصة — ذكاؤبيا سمارت كلاس" },
    { name: "description", content: "إدارة مستخدمي ذكاؤبيا سمارت كلاس وصلاحيات مديري المنصة وحظر الحسابات." },
    { property: "og:title", content: "إدارة المنصة — ذكاؤبيا سمارت كلاس" },
    { property: "og:description", content: "إدارة المستخدمين والأدوار وصلاحيات الإدارة وحظر الحسابات." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminPage,
});

function AdminPage() {
  const { tr } = useI18n();
  const { user } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const updateBlock = useServerFn(setAccountBlocked);
  const labels = { admin: tr("مدير"), teacher: tr("معلم"), student: tr("طالب"), parent: tr("ولي أمر") };
  const access = useQuery({ queryKey: ["admin-access"], queryFn: async () => {
    const { data, error } = await supabase.rpc("is_platform_owner");
    if (error) throw error;
    return data;
  } });
  const users = useQuery({ queryKey: ["admin-users"], retry: false, queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_list_accounts");
    if (error) throw error;
    return data;
  } });
  const change = useMutation({ mutationFn: async (value: { id: string; role: typeof managedRoles[number]; grant: boolean }) => {
    const { error } = await supabase.rpc("admin_set_role", { _user_id: value.id, _role: value.role, _grant: value.grant });
    if (error) throw error;
  }, onSuccess: async () => {
    await qc.invalidateQueries({ queryKey: ["admin-users"] });
    await qc.invalidateQueries({ queryKey: ["my-role"] });
    toast.success(tr("تم حفظ الصلاحيات"));
  }, onError: () => toast.error(tr("تعذر تغيير الصلاحية؛ تحقق من صلاحياتك واحتفاظ المستخدم بدور واحد على الأقل")) });
  const blocking = useMutation({
    mutationFn: (value: { id: string; blocked: boolean }) => updateBlock({ data: { userId: value.id, blocked: value.blocked } }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(tr(result.blocked ? "تم حظر المستخدم وإخراجه من المنصة" : "تم إلغاء حظر المستخدم"));
    },
    onError: () => toast.error(tr("تعذر تغيير حالة الحظر")),
  });
  const rows = (users.data ?? []).filter(u => `${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || u.roles.includes(filter)));

  return <AppShell title={tr("إدارة المنصة")} homeTo={access.data ? "/admin" : "/teacher"}>
    {users.isPending ? <p role="status">{tr("جارٍ التحميل…")}</p> : users.isError ? <p role="alert" className="text-destructive">{tr("هذه الصفحة متاحة لمديري المنصة فقط")}</p> : <>
      <div className="admin-stats mb-6 flex flex-wrap gap-6 border-b border-border pb-5">
        <div className="flex items-center gap-3"><Users className="text-primary" /><span>{tr("المستخدمون")}: <b>{users.data.length}</b></span></div>
        <div className="flex items-center gap-3"><ShieldCheck className="text-success" /><span>{tr("مديرو المنصة")}: <b>{users.data.filter(u => u.roles.includes("admin")).length}</b></span></div>
        {access.data && <span className="font-bold text-primary">{tr("مالك المنصة")}</span>}
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <label className="relative min-w-0 flex-1"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" /><Input className="ps-10" aria-label={tr("البحث بالاسم أو البريد")} placeholder={tr("البحث بالاسم أو البريد")} value={search} onChange={e => setSearch(e.target.value)} /></label>
        <select aria-label={tr("الصلاحية")} className="rounded-md border border-input px-3" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{tr("الكل")}</option>{managedRoles.map(r => <option key={r} value={r}>{labels[r]}</option>)}</select>
      </div>
      <div className="divide-y divide-border">{rows.map(u => <article key={u.user_id} className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="min-w-0">
          <h2 className="font-semibold">{u.full_name || tr("مستخدم")}{u.is_owner && <span className="ms-3 text-sm text-primary">{tr("مالك المنصة")}</span>}{u.is_blocked && <span className="ms-3 text-sm text-destructive">{tr("محظور")}</span>}</h2>
          <p dir="ltr" className="break-all text-sm text-muted-foreground">{u.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {managedRoles.map(role => {
            const granted = u.roles.includes(role);
            return <Button key={role} size="sm" variant={granted ? "default" : "outline"} aria-pressed={granted} disabled={change.isPending || blocking.isPending || !canManageRoles(access.data === true, u, role) || (granted && u.roles.length === 1)} onClick={() => {
              if (window.confirm(tr("تأكيد تغيير صلاحيات هذا المستخدم؟"))) change.mutate({ id: u.user_id, role, grant: !granted });
            }}>{labels[role]}</Button>;
          })}
          {user && canManageBlock(access.data === true, user.id, u) && <Button
            size="sm"
            variant={u.is_blocked ? "outline" : "destructive"}
            disabled={blocking.isPending || change.isPending}
            onClick={() => {
              if (window.confirm(tr(u.is_blocked ? "تأكيد إلغاء حظر هذا المستخدم؟" : "تأكيد حظر هذا المستخدم وإخراجه من المنصة؟"))) {
                blocking.mutate({ id: u.user_id, blocked: !u.is_blocked });
              }
            }}
          >
            {u.is_blocked ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
            {tr(u.is_blocked ? "إلغاء الحظر" : "حظر")}
          </Button>}
        </div>
      </article>)}</div>
      {!rows.length && <p className="py-8 text-muted-foreground">{tr("لا توجد نتائج")}</p>}
    </>}
  </AppShell>;
}
