import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import type { AdministrativePermission } from "@/lib/admin";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";

export function PlatformEditors({ sections, userId }: { sections: AdministrativePermission[]; userId: string }) {
  const { tr, locale } = useI18n();
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["public-platform"] }), qc.invalidateQueries({ queryKey: ["platform-editor", userId] })]);
    toast.success(tr("تم الحفظ"));
  };
  const fail = () => toast.error(tr("تعذر الحفظ"));
  const data = useQuery({ queryKey: ["platform-editor", userId, sections.join(",")], queryFn: async () => {
    const [plans, settings, news] = await Promise.all([
      sections.includes("pricing") ? supabase.from("platform_plan_overrides").select("*") : Promise.resolve({ data: [], error: null }),
      sections.includes("settings") ? supabase.from("platform_settings").select("*").eq("id", "public").maybeSingle() : Promise.resolve({ data: null, error: null }),
      sections.includes("news") ? supabase.from("platform_news").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (plans.error || settings.error || news.error) throw new Error("Content unavailable");
    return { plans: plans.data ?? [], settings: settings.data, news: news.data ?? [] };
  } });
  const [editing, setEditing] = useState<string | null>(null);
  const savePlan = useMutation({ mutationFn: async (form: HTMLFormElement) => {
    const f = new FormData(form);
    const { error } = await supabase.from("platform_plan_overrides").upsert({
      id: String(f.get("id")), name_ar: String(f.get("name_ar")), name_en: String(f.get("name_en")),
      price_egp: Number(f.get("egp")), price_sar: Number(f.get("sar")), price_usd: Number(f.get("usd")),
      features_ar: String(f.get("features_ar")).split("\n").filter(Boolean), features_en: String(f.get("features_en")).split("\n").filter(Boolean),
    });
    if (error) throw error;
  }, onSuccess: refresh, onError: fail });
  const saveSettings = useMutation({ mutationFn: async (form: HTMLFormElement) => {
    const f = new FormData(form);
    const { error } = await supabase.from("platform_settings").upsert({ id: "public", announcement_ar: String(f.get("ar")), announcement_en: String(f.get("en")) });
    if (error) throw error;
  }, onSuccess: refresh, onError: fail });
  const saveNews = useMutation({ mutationFn: async (form: HTMLFormElement) => {
    const f = new FormData(form);
    const row = { title_ar: String(f.get("title_ar")), title_en: String(f.get("title_en")), body_ar: String(f.get("body_ar")), body_en: String(f.get("body_en")), category: String(f.get("category")), published: f.get("published") === "on" };
    const result = editing && editing !== "new" ? await supabase.from("platform_news").update(row).eq("id", editing) : await supabase.from("platform_news").insert(row);
    if (result.error) throw result.error;
  }, onSuccess: async () => { setEditing(null); await refresh(); }, onError: fail });
  const remove = useMutation({ mutationFn: async (id: string) => {
    const { error } = await supabase.from("platform_news").delete().eq("id", id); if (error) throw error;
  }, onSuccess: refresh, onError: fail });
  if (data.isPending) return <p role="status">{tr("جارٍ التحميل…")}</p>;
  if (data.isError) return <p role="alert" className="text-destructive">{tr("تعذر تحميل المحتوى")}</p>;
  const current = data.data.news.find(n => n.id === editing);
  return <div className="space-y-10">
    {sections.includes("pricing") && <section aria-label={tr("إدارة الأسعار والباقات")}>
      <h2 className="mb-5 text-xl font-bold">{tr("إدارة الأسعار والباقات")}</h2>
      <div className="grid gap-4 md:grid-cols-2">{PLANS.map(plan => {
        const override = data.data.plans.find(p => p.id === plan.id);
        return <form key={`${plan.id}-${override?.updated_at ?? "initial"}`} className="surface space-y-3 p-5" onSubmit={e => { e.preventDefault(); savePlan.mutate(e.currentTarget); }}>
          <input type="hidden" name="id" value={plan.id} /><h3 className="font-bold">{plan[locale].name}</h3>
          <label className="block">{tr("الاسم بالعربية")}<Input name="name_ar" required maxLength={120} defaultValue={override?.name_ar || plan.ar.name} /></label>
          <label className="block">{tr("الاسم بالإنجليزية")}<Input name="name_en" required maxLength={120} defaultValue={override?.name_en || plan.en.name} /></label>
          <div className="grid grid-cols-3 gap-2">{(["egp", "sar", "usd"] as const).map(c => <label key={c} className="block text-sm">{c.toUpperCase()}<Input name={c} type="number" min={0} step="0.01" required defaultValue={override?.[`price_${c}`] ?? plan.price[c]} /></label>)}</div>
          <label className="block">{tr("مميزات الباقة بالعربية")}<Textarea name="features_ar" defaultValue={override?.features_ar.join("\n") ?? plan.ar.features.join("\n")} /></label>
          <label className="block">{tr("مميزات الباقة بالإنجليزية")}<Textarea name="features_en" defaultValue={override?.features_en.join("\n") ?? plan.en.features.join("\n")} /></label>
          <Button disabled={savePlan.isPending} type="submit"><Save className="size-4" />{tr("حفظ الباقة")}</Button>
        </form>;
      })}</div>
    </section>}
    {sections.includes("settings") && <section aria-label={tr("إدارة النصوص والإعدادات")}>
      <h2 className="mb-5 text-xl font-bold">{tr("إدارة النصوص والإعدادات")}</h2>
      <form key={data.data.settings?.updated_at ?? "settings"} className="max-w-3xl space-y-3" onSubmit={e => { e.preventDefault(); saveSettings.mutate(e.currentTarget); }}>
        <label className="block">{tr("إعلان المنصة بالعربية")}<Textarea name="ar" maxLength={1000} defaultValue={data.data.settings?.announcement_ar} /></label>
        <label className="block">{tr("إعلان المنصة بالإنجليزية")}<Textarea name="en" maxLength={1000} defaultValue={data.data.settings?.announcement_en} /></label>
        <Button disabled={saveSettings.isPending} type="submit"><Save className="size-4" />{tr("حفظ الإعلان")}</Button>
      </form>
    </section>}
    {sections.includes("news") && <section aria-label={tr("إدارة الأخبار والتحديثات")}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{tr("إدارة الأخبار والتحديثات")}</h2><Button onClick={() => setEditing("new")}><Plus className="size-4" />{tr("خبر جديد")}</Button></div>
      {editing && <form key={editing} className="surface mb-5 space-y-3 p-5" onSubmit={e => { e.preventDefault(); saveNews.mutate(e.currentTarget); }}>
        <label className="block">{tr("العنوان بالعربية")}<Input name="title_ar" required maxLength={200} defaultValue={current?.title_ar} /></label>
        <label className="block">{tr("العنوان بالإنجليزية")}<Input name="title_en" maxLength={200} defaultValue={current?.title_en} /></label>
        <label className="block">{tr("النص بالعربية")}<Textarea name="body_ar" required maxLength={20000} defaultValue={current?.body_ar} /></label>
        <label className="block">{tr("النص بالإنجليزية")}<Textarea name="body_en" maxLength={20000} defaultValue={current?.body_en} /></label>
        <label className="block">{tr("التصنيف")}<select name="category" className="ms-3 rounded-md border border-input bg-background p-2" defaultValue={current?.category ?? "education"}><option value="education">{tr("أخبار التعليم")}</option><option value="update">{tr("تحديثات المنصة")}</option></select></label>
        <label className="flex items-center gap-2"><Checkbox name="published" value="on" defaultChecked={current?.published ?? false} />{tr("منشور")}</label>
        <div className="flex gap-2"><Button disabled={saveNews.isPending} type="submit"><Save className="size-4" />{tr("حفظ الخبر")}</Button><Button variant="outline" type="button" onClick={() => setEditing(null)}>{tr("إلغاء")}</Button></div>
      </form>}
      <div className="space-y-3">{data.data.news.map(n => <article key={n.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4"><div><h3 className="break-words font-semibold">{locale === "ar" ? n.title_ar : n.title_en || n.title_ar}</h3><span className="text-sm text-muted-foreground">{tr(n.published ? "منشور" : "مسودة")}</span></div><div className="flex gap-2"><Button variant="outline" size="icon" title={tr("تعديل")} aria-label={tr("تعديل")} onClick={() => setEditing(n.id)}><Pencil className="size-4" /></Button><Button variant="destructive" size="icon" disabled={remove.isPending} title={tr("حذف")} aria-label={tr("حذف")} onClick={() => { if (window.confirm(tr("حذف الخبر نهائيًا؟"))) remove.mutate(n.id); }}><Trash2 className="size-4" /></Button></div></article>)}</div>
      {!data.data.news.length && !editing && <p className="text-muted-foreground">{tr("لا توجد أخبار بعد")}</p>}
    </section>}
  </div>;
}