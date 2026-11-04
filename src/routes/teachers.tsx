import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useRole, useSession } from "@/hooks/useSession";
import { useI18n } from "@/lib/i18n";
import { SUBJECTS, subjectLabel } from "@/lib/subjects";

type Search = { subject?: string | undefined };

export const Route = createFileRoute("/teachers")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    subject: typeof s["subject"] === "string" && s["subject"] ? s["subject"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "المدرسون المتاحون — سمارت كلاس" },
      { name: "description", content: "تصفح المدرسين المتاحين على سمارت كلاس حسب المادة وقدّم طلب انضمام يصل للمدرس مباشرة." },
      { property: "og:title", content: "المدرسون المتاحون — سمارت كلاس" },
      { property: "og:description", content: "اختر مادتك واطلب الانضمام لمجموعة المدرس المناسب." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zakaa2biasmartclass.lovable.app/teachers" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://zakaa2biasmartclass.lovable.app/teachers" }],
  }),
  component: TeachersPage,
});

type Listing = { teacher_id: string; display_name: string; bio: string | null; subjects: string[]; grade_levels: string | null };

function TeachersPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { subject } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useSession();
  const { data: role } = useRole(user);
  const [openFor, setOpenFor] = useState<string | null>(null);

  const listings = useQuery({
    queryKey: ["teacher-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_listings")
        .select("teacher_id, display_name, bio, subjects, grade_levels")
        .eq("is_listed", true)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const myRequests = useQuery({
    queryKey: ["my-join-requests", user?.id],
    enabled: !!user && role !== "teacher",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, teacher_id, student_name, subject, status, created_at")
        .neq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const shown = (listings.data ?? []).filter((l) => !subject || l.subjects.includes(subject));
  const nameOf = (id: string) => listings.data?.find((l) => l.teacher_id === id)?.display_name ?? "—";
  const statusLabel = (s: string) =>
    s === "approved" ? (ar ? "مقبول" : "Approved") : s === "rejected" ? (ar ? "مرفوض" : "Rejected") : ar ? "قيد المراجعة" : "Pending";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold">{ar ? "المدرسون المتاحون على المنصة" : "Teachers on the platform"}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {ar
            ? "اختر المادة، ثم المدرس المناسب، واضغط «اطلب الانضمام». يصل طلبك للمدرس، وعند قبوله يضيفك لمجموعته وتظهر لك مادته فقط."
            : "Pick a subject, then a teacher, and tap “Request to join”. The teacher receives it, and once approved adds you to their group."}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" variant={!subject ? "default" : "outline"} onClick={() => navigate({ search: {} })}>
            {ar ? "كل المواد" : "All subjects"}
          </Button>
          {SUBJECTS.map((s) => (
            <Button key={s.ar} size="sm" variant={subject === s.ar ? "default" : "outline"} onClick={() => navigate({ search: { subject: s.ar } })}>
              {ar ? s.ar : s.en}
            </Button>
          ))}
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.isLoading ? (
            <p className="text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground">
              {ar ? "لا يوجد مدرسون متاحون لهذه المادة حاليًا." : "No teachers available for this subject yet."}
            </p>
          ) : (
            shown.map((l) => (
              <article key={l.teacher_id} className="surface flex flex-col rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground">
                    <UserRound className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold">{l.display_name}</h2>
                    {l.grade_levels && <p className="text-xs text-muted-foreground">{l.grade_levels}</p>}
                  </div>
                </div>
                {l.bio && <p className="mt-3 text-sm text-muted-foreground">{l.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {l.subjects.map((s) => (
                    <Badge key={s} variant="secondary">{subjectLabel(s, locale)}</Badge>
                  ))}
                </div>
                <div className="mt-auto pt-4">
                  {!user ? (
                    <Button asChild className="w-full"><Link to="/auth">{ar ? "سجّل الدخول لتقديم طلب" : "Sign in to request"}</Link></Button>
                  ) : role === "teacher" || role === "admin" ? null : openFor === l.teacher_id ? (
                    <RequestForm listing={l} role={role} defaultSubject={subject} onDone={() => setOpenFor(null)} />
                  ) : (
                    <Button className="w-full" onClick={() => setOpenFor(l.teacher_id)}>
                      <Send className="size-4" /> {ar ? "اطلب الانضمام" : "Request to join"}
                    </Button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        {!!myRequests.data?.length && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold">{ar ? "طلباتي" : "My requests"}</h2>
            <div className="surface mt-3 divide-y divide-border rounded-2xl">
              {myRequests.data.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <span>
                    <b>{nameOf(r.teacher_id)}</b>
                    {r.subject && ` · ${subjectLabel(r.subject, locale)}`}
                    {r.student_name && ` · ${r.student_name}`}
                  </span>
                  <Badge variant={r.status === "approved" ? "default" : "outline"}>{statusLabel(r.status)}</Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function RequestForm({ listing, role, defaultSubject, onDone }: { listing: Listing; role?: string | undefined; defaultSubject?: string | undefined; onDone: () => void }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { user } = useSession();
  const qc = useQueryClient();
  const [subject, setSubject] = useState(defaultSubject && listing.subjects.includes(defaultSubject) ? defaultSubject : listing.subjects[0] ?? "");
  const [message, setMessage] = useState("");
  const [childId, setChildId] = useState("");
  const isParent = role === "parent";

  const children = useQuery({
    queryKey: ["my-children-list"],
    enabled: isParent,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_my_children");
      if (error) throw error;
      return data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const studentId = isParent ? childId : user!.id;
      if (!studentId) throw new Error(ar ? "اختر الابن أولًا" : "Choose a child first");
      const { error } = await supabase.from("join_requests").insert({
        teacher_id: listing.teacher_id,
        student_id: studentId,
        requested_by: user!.id,
        subject: subject || null,
        message: message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ar ? "تم إرسال الطلب للمدرس" : "Request sent to the teacher");
      qc.invalidateQueries({ queryKey: ["my-join-requests"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
      {isParent && (
        children.data?.length ? (
          <select className={selectCls} value={childId} onChange={(e) => setChildId(e.target.value)} required>
            <option value="">{ar ? "اختر الابن" : "Choose child"}</option>
            {children.data.map((c) => <option key={c.student_id} value={c.student_id}>{c.full_name || c.email}</option>)}
          </select>
        ) : (
          <p className="text-xs text-muted-foreground">{ar ? "اربط حساب ابنك أولًا من لوحة ولي الأمر." : "Link your child first from the parent dashboard."}</p>
        )
      )}
      {listing.subjects.length > 0 && (
        <select className={selectCls} value={subject} onChange={(e) => setSubject(e.target.value)}>
          {listing.subjects.map((s) => <option key={s} value={s}>{subjectLabel(s, locale)}</option>)}
        </select>
      )}
      <Textarea rows={2} placeholder={ar ? "رسالة للمدرس (اختياري): الصف، المدرسة…" : "Message (optional): grade, school…"} value={message} onChange={(e) => setMessage(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={send.isPending}>{ar ? "إرسال الطلب" : "Send request"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>{ar ? "إلغاء" : "Cancel"}</Button>
      </div>
    </form>
  );
}
