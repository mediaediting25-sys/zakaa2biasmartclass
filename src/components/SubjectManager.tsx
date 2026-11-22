import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Pencil, Eye, EyeOff, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

type Subject = Database["public"]["Tables"]["platform_subjects"]["Row"];
export function SubjectManager({ userId }: { userId: string }) {
  const { tr, locale } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const catalog = useQuery({ queryKey: ["admin-subjects", userId], queryFn: async () => {
    const { data, error } = await supabase.from("platform_subjects").select("*").order("position").order("name_ar");
    if (error) throw error;
    return data;
  } });
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["admin-subjects"] }), qc.invalidateQueries({ queryKey: ["public-subjects"] })]); };
  const save = useMutation({ mutationFn: async (form: HTMLFormElement) => {
    const values = new FormData(form);
    const name_ar = String(values.get("ar") ?? "").trim();
    const name_en = String(values.get("en") ?? "").trim();
    const position = Number(values.get("position"));
    if (!name_ar || !name_en || !Number.isInteger(position) || position < 0 || position > 10000) throw new Error("Invalid subject");
    const result = editing === "new"
      ? await supabase.from("platform_subjects").insert({ subject_key: crypto.randomUUID(), name_ar, name_en, position })
      : editing ? await supabase.from("platform_subjects").update({ name_ar, name_en, position }).eq("id", editing.id).select("id").single() : null;
    if (!result || result.error) throw result?.error ?? new Error("No subject selected");
  }, onSuccess: async () => { setEditing(null); await refresh(); toast.success(tr("تم حفظ المادة")); }, onError: () => toast.error(tr("تعذر حفظ المادة؛ تحقق من الصلاحية وعدم تكرار الاسم")) });
  const visibility = useMutation({ mutationFn: async (subject: Subject) => {
    const { error } = await supabase.from("platform_subjects").update({ active: !subject.active }).eq("id", subject.id).select("id").single();
    if (error) throw error;
  }, onSuccess: async () => { await refresh(); toast.success(tr("تم حفظ المادة")); }, onError: () => toast.error(tr("تعذر حفظ المادة؛ تحقق من الصلاحية وعدم تكرار الاسم")) });
  return <section aria-label={tr("إدارة المواد الدراسية")} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-bold"><BookOpen className="size-5 text-primary" />{tr("إدارة المواد الدراسية")}</h2><Button onClick={() => setEditing("new")}><Plus className="size-4" />{tr("إضافة مادة")}</Button></div>
    <p className="text-sm text-muted-foreground">{tr("إخفاء المادة يزيلها من القائمة العامة دون حذف مقررات المعلمين أو بيانات الطلاب.")}</p>
    {catalog.isPending ? <p role="status">{tr("جارٍ التحميل…")}</p> : catalog.isError ? <p role="alert" className="text-destructive">{tr("تعذر تحميل المواد")}</p> : <div className="divide-y divide-border">{catalog.data.map(subject => <article key={subject.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0"><h3 className="break-words font-semibold">{locale === "ar" ? subject.name_ar : subject.name_en}</h3><p className="break-words text-sm text-muted-foreground">{locale === "ar" ? subject.name_en : subject.name_ar} · {tr(subject.active ? "ظاهرة" : "مخفية")}</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" disabled={visibility.isPending} onClick={() => setEditing(subject)}><Pencil className="size-4" />{tr("تعديل")}</Button><Button variant="outline" size="sm" disabled={visibility.isPending} onClick={() => { if (subject.active && !window.confirm(tr("إخفاء هذه المادة من القائمة العامة؟"))) return; visibility.mutate(subject); }}>{subject.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{tr(subject.active ? "إخفاء" : "إظهار")}</Button></div>
    </article>)}</div>}
    <Dialog open={editing !== null} onOpenChange={open => { if (!open && !save.isPending) setEditing(null); }}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>{tr(editing === "new" ? "إضافة مادة" : "تعديل المادة")}</DialogTitle><DialogDescription>{tr("أسماء المواد بالعربية والإنجليزية")}</DialogDescription></DialogHeader>{editing && <form key={editing === "new" ? "new" : editing.id} className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(e.currentTarget); }}>
      <label className="block text-sm">{tr("الاسم بالعربية")}<Input name="ar" required maxLength={100} defaultValue={editing === "new" ? "" : editing.name_ar} /></label>
      <label className="block text-sm">{tr("الاسم بالإنجليزية")}<Input name="en" dir="ltr" required maxLength={100} defaultValue={editing === "new" ? "" : editing.name_en} /></label>
      <label className="block text-sm">{tr("ترتيب العرض")}<Input name="position" type="number" required min={0} max={10000} step={1} defaultValue={editing === "new" ? (catalog.data?.length ?? 0) : editing.position} /></label>
      <Button type="submit" disabled={save.isPending}><Save className="size-4" />{tr("حفظ المادة")}</Button>
    </form>}</DialogContent></Dialog>
  </section>;
}