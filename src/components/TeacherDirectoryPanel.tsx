import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SUBJECTS, subjectLabel } from "@/lib/subjects";

export function TeacherDirectoryPanel({ userId, courses }: { userId: string; courses: { id: string; title: string }[] }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const qc = useQueryClient();

  const listing = useQuery({
    queryKey: ["my-listing", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("teacher_listings").select("*").eq("teacher_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const requests = useQuery({
    queryKey: ["teacher-join-requests", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, student_name, subject, message, status, created_at")
        .eq("teacher_id", userId)
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [grades, setGrades] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [listed, setListed] = useState(true);
  const [pick, setPick] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!listing.data) return;
    setName(listing.data.display_name);
    setBio(listing.data.bio ?? "");
    setGrades(listing.data.grade_levels ?? "");
    setSubjects(listing.data.subjects ?? []);
    setListed(listing.data.is_listed);
  }, [listing.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("teacher_listings").upsert({
        teacher_id: userId, display_name: name.trim(), bio: bio.trim() || null,
        grade_levels: grades.trim() || null, subjects, is_listed: listed,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(ar ? "تم حفظ ملفك في دليل المدرسين" : "Directory profile saved"); qc.invalidateQueries({ queryKey: ["my-listing"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const courseId = pick[id];
      if (approve && !courseId) throw new Error(ar ? "اختر المقرر الذي سيُضاف إليه الطالب" : "Choose a course first");
      const { error } = await supabase.rpc("decide_join_request", { _request_id: id, _approve: approve, _course_id: courseId ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? (ar ? "تمت إضافة الطالب للمقرر" : "Student added to the course") : ar ? "تم رفض الطلب" : "Request declined");
      qc.invalidateQueries({ queryKey: ["teacher-join-requests"] });
      qc.invalidateQueries({ queryKey: ["teacher-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-2">
      <section className="surface rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Inbox className="size-5 text-primary" /> {ar ? "طلبات الانضمام" : "Join requests"}
          {!!requests.data?.length && <Badge>{requests.data.length}</Badge>}
        </h2>
        {!requests.data?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">{ar ? "لا توجد طلبات جديدة." : "No new requests."}</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {requests.data.map((r) => (
              <div key={r.id} className="grid gap-2 py-3 text-sm">
                <div>
                  <b>{r.student_name || (ar ? "طالب" : "Student")}</b>
                  {r.subject && <span className="text-muted-foreground"> · {subjectLabel(r.subject, locale)}</span>}
                </div>
                {r.message && <p className="text-muted-foreground">{r.message}</p>}
                <div className="flex flex-wrap gap-2">
                  <select className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={pick[r.id] ?? ""} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })}>
                    <option value="">{ar ? "أضفه إلى مقرر…" : "Add to course…"}</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>{ar ? "قبول" : "Accept"}</Button>
                  <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: false })}>{ar ? "رفض" : "Decline"}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <form className="surface grid gap-3 rounded-2xl p-5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Megaphone className="size-5 text-primary" /> {ar ? "ملفي في دليل المدرسين" : "My directory profile"}
        </h2>
        <p className="text-xs text-muted-foreground">{ar ? "يظهر للطلاب وأولياء الأمور في صفحة «المدرسون» ليطلبوا الانضمام إليك." : "Shown on the Teachers page so students and parents can request to join."}</p>
        <Input placeholder={ar ? "الاسم الظاهر" : "Display name"} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input placeholder={ar ? "الصفوف (مثال: الصف الأول الثانوي)" : "Grades taught"} value={grades} onChange={(e) => setGrades(e.target.value)} />
        <Textarea rows={2} placeholder={ar ? "نبذة قصيرة عنك" : "Short bio"} value={bio} onChange={(e) => setBio(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {SUBJECTS.map((s) => {
            const on = subjects.includes(s.ar);
            return (
              <Button key={s.ar} type="button" size="sm" variant={on ? "default" : "outline"} onClick={() => setSubjects(on ? subjects.filter((x) => x !== s.ar) : [...subjects, s.ar])}>
                {ar ? s.ar : s.en}
              </Button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} />
          {ar ? "اظهر في دليل المدرسين" : "Show me in the directory"}
        </label>
        <Button type="submit" disabled={save.isPending}>{ar ? "حفظ" : "Save"}</Button>
      </form>
    </div>
  );
}
