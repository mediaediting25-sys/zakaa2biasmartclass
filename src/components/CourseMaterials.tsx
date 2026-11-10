import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ExternalLink, FileQuestion, Presentation, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { MAX_UPLOAD_BYTES } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const BUCKET = "course-materials";
type Kind = "lesson" | "presentation" | "questions";
type Material = { id: string; kind: string; title: string; description: string | null; storage_path: string | null; file_name: string | null; link_url: string | null; status: string; created_at: string };

const KIND_LABEL: Record<Kind, string> = { lesson: "درس", presentation: "عرض تقديمي", questions: "أسئلة" };
const KIND_ICON = { lesson: BookOpen, presentation: Presentation, questions: FileQuestion };

function useMaterials(courseId: string) {
  return useQuery({
    queryKey: ["materials", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_materials").select("id, kind, title, description, storage_path, file_name, link_url, status, created_at").eq("course_id", courseId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });
}

async function openMaterial(m: Material) {
  if (m.link_url) { window.open(m.link_url, "_blank", "noopener"); return; }
  if (!m.storage_path) return;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.storage_path, 60 * 30);
  if (error) { toast.error(error.message); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

function MaterialRow({ m, children }: { m: Material; children?: React.ReactNode }) {
  const { tr } = useI18n();
  const Icon = KIND_ICON[m.kind as Kind] ?? BookOpen;
  return (
    <li className="material-row flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
      <Icon className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{m.title}</p>
        {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
      </div>
      <Badge variant="outline">{tr(KIND_LABEL[m.kind as Kind] ?? "درس")}</Badge>
      <Button size="sm" variant="outline" onClick={() => openMaterial(m)}><ExternalLink className="size-4" />{tr("فتح")}</Button>
      {children}
    </li>
  );
}

export function TeacherMaterialsPanel({ courseId }: { courseId: string }) {
  const { tr, message } = useI18n();
  const qc = useQueryClient();
  const list = useMaterials(courseId);
  const [kind, setKind] = useState<Kind>("lesson");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["materials", courseId] });

  const add = useMutation({
    mutationFn: async () => {
      if (!file && !link.trim()) throw new Error(tr("ارفع ملفًا أو أضف رابطًا"));
      if (link.trim() && !/^https:\/\//i.test(link.trim())) throw new Error(tr("الرابط يجب أن يبدأ بـ https://"));
      if (file && file.size > MAX_UPLOAD_BYTES) throw new Error(tr("الملف أكبر من 500 ميجابايت"));
      const id = crypto.randomUUID();
      let storage_path: string | null = null;
      if (file) {
        storage_path = `${courseId}/${id}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const up = await supabase.storage.from(BUCKET).upload(storage_path, file, { contentType: file.type || "application/octet-stream" });
        if (up.error) throw up.error;
      }
      const { error } = await supabase.from("course_materials").insert({ id, course_id: courseId, kind, title: title.trim(), description: description.trim() || null, storage_path, file_name: file?.name ?? null, mime_type: file?.type ?? null, size_bytes: file?.size ?? null, link_url: link.trim() || null });
      if (error) { if (storage_path) await supabase.storage.from(BUCKET).remove([storage_path]); throw error; }
    },
    onSuccess: () => { toast.success(tr("تمت الإضافة — انشرها ليراها الطلاب")); setTitle(""); setDescription(""); setLink(""); setFile(null); refresh(); },
    onError: (e: Error) => toast.error(message(e.message)),
  });
  const toggle = useMutation({
    mutationFn: async (m: Material) => {
      const { error } = await supabase.from("course_materials").update({ status: m.status === "published" ? "draft" : "published" }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: (e: Error) => toast.error(message(e.message)),
  });
  const remove = useMutation({
    mutationFn: async (m: Material) => {
      if (m.storage_path) await supabase.storage.from(BUCKET).remove([m.storage_path]);
      const { error } = await supabase.from("course_materials").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: (e: Error) => toast.error(message(e.message)),
  });

  return (
    <section className="materials-panel surface mb-8 rounded-2xl p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold"><Upload className="size-5 text-primary" />{tr("مواد خارجية للطلاب")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{tr("ارفع دروسًا أو عروضًا تقديمية أو أسئلة من عندك، ثم انشرها لتظهر لطلاب المقرر.")}</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <label className="text-sm">{tr("النوع")}
          <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="lesson">{tr("درس")}</option><option value="presentation">{tr("عرض تقديمي")}</option><option value="questions">{tr("أسئلة")}</option>
          </select>
        </label>
        <label className="text-sm">{tr("العنوان")}<Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></label>
        <label className="text-sm sm:col-span-2">{tr("وصف (اختياري)")}<Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></label>
        <label className="text-sm">{tr("الملف (PDF، PowerPoint، Word، صور، فيديو)")}<Input type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,image/*,video/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="text-sm">{tr("أو رابط (يوتيوب، Google Slides…)")}<Input type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} /></label>
        <div className="sm:col-span-2"><Button type="submit" disabled={add.isPending}>{add.isPending ? tr("جارٍ الرفع…") : tr("إضافة")}</Button></div>
      </form>
      <ul className="mt-4 space-y-2">
        {(list.data ?? []).map((m) => (
          <MaterialRow key={m.id} m={m}>
            <Badge variant={m.status === "published" ? "default" : "secondary"}>{m.status === "published" ? tr("منشور") : tr("مسودة")}</Badge>
            <Button size="sm" onClick={() => toggle.mutate(m)}>{m.status === "published" ? tr("إلغاء النشر") : tr("نشر للطلاب")}</Button>
            <Button size="icon" variant="ghost" aria-label={tr("حذف")} onClick={() => { if (confirm(tr("حذف هذه المادة؟"))) remove.mutate(m); }}><Trash2 className="size-4" /></Button>
          </MaterialRow>
        ))}
      </ul>
    </section>
  );
}

export function StudentMaterials({ courseId }: { courseId: string }) {
  const { tr } = useI18n();
  const { data = [] } = useMaterials(courseId);
  if (!data.length) return null;
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold">{tr("مواد من المعلم")}</h4>
      <ul className="space-y-2">{data.map((m) => <MaterialRow key={m.id} m={m} />)}</ul>
    </div>
  );
}
