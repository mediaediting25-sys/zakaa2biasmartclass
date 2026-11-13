import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Ban, RotateCcw, ShieldCheck, Users, Search } from "lucide-react";
import { toast } from "sonner";

import { PlatformEditors } from "@/components/PlatformEditors";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { administrativePermissions, canUseAdminSection, canManageBlock, canManageRoles, managedRoles, type AdministrativePermission } from "@/lib/admin";
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
  const sectionLabels: Record<AdministrativePermission, string> = {
    general_admin: tr("الإدارة العامة"), users: tr("إدارة المستخدمين والحظر"), roles: tr("إدارة أدوار المستخدمين"),
    pricing: tr("إدارة الأسعار والباقات"), news: tr("إدارة الأخبار والتحديثات"),
    settings: tr("إدارة النصوص والإعدادات"), subscriptions: tr("إدارة الاشتراكات والمدد المجانية"),
  };
  const access = useQuery({ queryKey: ["admin-access", user?.id], queryFn: async () => {
    const { data, error } = await supabase.rpc("is_platform_owner");
    if (error) throw error;
    return data;
  } });
  const permissions = useQuery({ queryKey: ["admin-permissions", user?.id], enabled: !!user, queryFn: async () => {
    const { data, error } = await supabase.from("admin_permissions").select("user_id, permission");
    if (error) throw error;
    return data ?? [];
  } });
  const mine = (permissions.data ?? []).filter(p => p.user_id === user?.id).map(p => p.permission);
  const visibleSections = administrativePermissions.filter(p => canUseAdminSection(access.data === true, mine, p));
  const manageUsers = !permissions.isError && canUseAdminSection(access.data === true, mine, "users");
  const manageRoles = !permissions.isError && canUseAdminSection(access.data === true, mine, "roles");
  const users = useQuery({ queryKey: ["admin-users", user?.id], enabled: manageUsers || manageRoles, retry: false, queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_list_accounts");
    if (error) throw error;
    return data;
  } });
  const sections = useMutation({ mutationFn: async (value: { id: string; permission: AdministrativePermission; grant: boolean }) => {
    const { error } = await supabase.rpc("set_admin_permission", { _user_id: value.id, _permission: value.permission, _grant: value.grant });
    if (error) throw error;
  }, onSuccess: async () => {
    await qc.invalidateQueries({ queryKey: ["admin-permissions"] });
    toast.success(tr("تم حفظ الصلاحيات"));
  }, onError: () => toast.error(tr("تعذر حفظ الأقسام الإدارية")) });
  const change = useMutation({ mutationFn: async (value: { id: string; role: typeof managedRoles[number]; grant: boolean }) => {
    const { error } = await supabase.rpc("admin_set_role", { _user_id: value.id, _role: value.role, _grant: value.grant });
    if (error) throw error;
  }, onSuccess: async () => {
    await qc.invalidateQueries({ queryKey: ["admin-users"] });
    await qc.invalidateQueries({ queryKey: ["my-role"] });
    await qc.invalidateQueries({ queryKey: ["admin-permissions"] });
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
    {access.isError || permissions.isError ? <p role="alert" className="text-destructive">{tr("تعذر تحميل الصلاحيات")}</p> : access.isPending || permissions.isPending ? <p role="status">{tr("جارٍ التحميل…")}</p> : !(manageUsers || manageRoles) ? <>
      <p>{tr("لم يُمنح حسابك صلاحية إدارة المستخدمين أو الأدوار")}</p>
      <ul className="mt-4 space-y-2">{visibleSections.map(p => <li key={p}>{sectionLabels[p]}</li>)}</ul>
      
    </> : users.isPending ? <p role="status">{tr("جارٍ التحميل…")}</p> : users.isError ? <p role="alert" className="text-destructive">{tr("هذه الصفحة متاحة لمديري المنصة فقط")}</p> : <>
      <div className="admin-stats surface mb-6 flex flex-wrap gap-6 p-5">
        <div className="flex items-center gap-3"><Users className="text-primary" /><span>{tr("المستخدمون")}: <b>{users.data.length}</b></span></div>
        <div className="flex items-center gap-3"><ShieldCheck className="text-success" /><span>{tr("مديرو المنصة")}: <b>{users.data.filter(u => u.roles.includes("admin")).length}</b></span></div>
        {access.data && <span className="font-bold text-primary">{tr("مالك المنصة")}</span>}
      </div>
      <div className="admin-toolbar surface mb-6 flex flex-wrap gap-3 p-3">
        <label className="relative min-w-0 flex-1"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" /><Input className="ps-10" aria-label={tr("البحث بالاسم أو البريد")} placeholder={tr("البحث بالاسم أو البريد")} value={search} onChange={e => setSearch(e.target.value)} /></label>
        <select aria-label={tr("الصلاحية")} className="rounded-md border border-input px-3" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{tr("الكل")}</option>{managedRoles.map(r => <option key={r} value={r}>{labels[r]}</option>)}</select>
      </div>
      <div className="space-y-3">{rows.map(u => <article key={u.user_id} className="admin-user-row surface flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <h2 className="font-semibold">{u.full_name || tr("مستخدم")}{u.is_owner && <span className="ms-3 text-sm text-primary">{tr("مالك المنصة")}</span>}{u.is_blocked && <span className="ms-3 text-sm text-destructive">{tr("محظور")}</span>}</h2>
          <p dir="ltr" className="break-all text-sm text-muted-foreground">{u.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {managedRoles.map(role => {
            const granted = u.roles.includes(role);
            return <Button key={role} size="sm" variant={granted ? "default" : "outline"} aria-pressed={granted} disabled={!manageRoles || change.isPending || blocking.isPending || sections.isPending || !canManageRoles(access.data === true, u, role) || (granted && u.roles.length === 1)} onClick={() => {
              if (window.confirm(tr("تأكيد تغيير صلاحيات هذا المستخدم؟"))) change.mutate({ id: u.user_id, role, grant: !granted });
            }}>{labels[role]}</Button>;
          })}
          {manageUsers && user && canManageBlock(access.data === true, user.id, u) && <Button
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
        {access.data && u.roles.includes("admin") && !u.is_owner && <fieldset className="w-full border-t border-border pt-4">
          <legend className="px-2 text-sm font-semibold">{tr("الأقسام الإدارية")}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{administrativePermissions.map(permission => {
            const granted = permissions.data?.some(p => p.user_id === u.user_id && p.permission === permission) === true;
            return <label key={permission} className="flex min-w-0 items-start gap-2 text-sm">
              <Checkbox checked={granted} disabled={sections.isPending || change.isPending} onCheckedChange={checked => {
                if (window.confirm(tr("تأكيد تغيير القسم الإداري لهذا المدير؟"))) sections.mutate({ id: u.user_id, permission, grant: checked === true });
              }} /><span>{sectionLabels[permission]}</span>
            </label>;
          })}</div>
        </fieldset>}
      </article>)}</div>
      {!rows.length && <p className="py-8 text-muted-foreground">{tr("لا توجد نتائج")}</p>}
    </>}
    {!access.isPending && !access.isError && !permissions.isPending && !permissions.isError && user && visibleSections.some(p => ["pricing", "news", "settings"].includes(p)) && <div className="mt-10 border-t border-border pt-8"><PlatformEditors sections={visibleSections} userId={user.id} /></div>}
  </AppShell>;
}
