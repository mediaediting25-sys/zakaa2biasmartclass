import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireLiveAccount } from "@/lib/live-account-middleware";
import { studentDisplayName } from "./account-deletion";

async function assertCourseTeacher(supabase: any, courseId: string) {
  const { data, error } = await supabase.rpc("is_course_teacher", { _course_id: courseId });
  if (error || !data) throw new Error("هذه الصفحة متاحة لمعلم المقرر فقط");
}

/** Full per-attempt report for the course teacher: student, answers, score, comment, retake state. */
export const listCourseReports = createServerFn({ method: "POST" })
  .middleware([requireLiveAccount])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCourseTeacher(context.supabase, data.courseId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: attempts, error } = await supabaseAdmin
      .from("attempts")
      .select("id, activity_id, student_id, score, max_score, submitted_at, teacher_comment, commented_at")
      .eq("course_id", data.courseId)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!attempts?.length) return { reports: [] };

    const activityIds = [...new Set(attempts.map((a) => a.activity_id))];
    const studentIds = [...new Set(attempts.map((a) => a.student_id))];
    const attemptIds = attempts.map((a) => a.id);

    const [acts, profs, grants, answers] = await Promise.all([
      supabaseAdmin.from("activities").select("id, title").in("id", activityIds),
      supabaseAdmin.from("profiles").select("id, full_name, email").in("id", studentIds),
      supabaseAdmin.from("retake_grants").select("activity_id, student_id").in("activity_id", activityIds).is("consumed_at", null),
      supabaseAdmin.from("answers").select("attempt_id, question_id, response, is_correct, score").in("attempt_id", attemptIds),
    ]);

    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, activity_id, stem, options, correct_answer, points")
      .in("activity_id", activityIds)
      .eq("status", "published")
      .order("position");

    const actTitle = new Map((acts.data ?? []).map((a) => [a.id, a.title]));
    const profById = new Map((profs.data ?? []).map((p) => [p.id, p]));
    const missingIds = studentIds.filter((id) => !profById.has(id));
    const departedById = new Map<string, { full_name: string | null; email: string | null }>();
    if (missingIds.length) {
      const saved = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("departed_accounts").select("user_id, full_name, email").in("user_id", missingIds);
      for (const d of (saved.data ?? []) as { user_id: string; full_name: string | null; email: string | null }[]) departedById.set(d.user_id, d);
    }
    const studentName = new Map(studentIds.map((id) => [id, studentDisplayName(profById.get(id), departedById.get(id)).name]));
    const openGrants = new Set((grants.data ?? []).map((g) => `${g.activity_id}:${g.student_id}`));
    const qById = new Map((questions ?? []).map((q) => [q.id, q]));
    const ansByAttempt = new Map<string, any[]>();
    for (const an of answers.data ?? []) {
      const list = ansByAttempt.get(an.attempt_id) ?? [];
      list.push(an);
      ansByAttempt.set(an.attempt_id, list);
    }

    return {
      reports: attempts.map((a) => ({
        id: a.id,
        studentName: studentName.get(a.student_id) ?? "طالب",
        activityTitle: actTitle.get(a.activity_id) ?? "نشاط",
        score: a.score,
        maxScore: a.max_score,
        submittedAt: a.submitted_at,
        teacherComment: a.teacher_comment,
        retakeGranted: openGrants.has(`${a.activity_id}:${a.student_id}`),
        answers: (ansByAttempt.get(a.id) ?? []).map((an) => {
          const q = qById.get(an.question_id);
          const ca = q?.correct_answer as any;
          const correct =
            ca != null && typeof ca === "object" && "value" in ca ? String(ca.value) : ca == null ? null : String(ca);
          return {
            stem: q?.stem ?? "سؤال",
            choice: (an.response as any)?.choice ?? null,
            correctAnswer: correct,
            isCorrect: an.is_correct,
            score: an.score,
            points: q?.points ?? 1,
          };
        }),
      })),
    };
  });

/** Allow a student to retake an activity (one extra attempt). */
export const grantRetake = createServerFn({ method: "POST" })
  .middleware([requireLiveAccount])
  .inputValidator((d: unknown) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attempt, error } = await supabaseAdmin
      .from("attempts")
      .select("id, activity_id, student_id, course_id")
      .eq("id", data.attemptId)
      .single();
    if (error || !attempt) throw new Error("المحاولة غير موجودة");
    await assertCourseTeacher(context.supabase, attempt.course_id);

    const { error: upErr } = await supabaseAdmin.from("retake_grants").upsert(
      {
        activity_id: attempt.activity_id,
        student_id: attempt.student_id,
        granted_by: context.userId,
        consumed_at: null,
      },
      { onConflict: "activity_id,student_id" },
    );
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: attempt.student_id,
      title: "سماح بإعادة الحل",
      body: "أذن لك معلمك بإعادة حل أحد الأنشطة.",
      kind: "retake_granted",
      link: "/student",
    });
    return { ok: true };
  });

/** Teacher comment on an attempt — visible to the student and the linked parent. */
export const setTeacherComment = createServerFn({ method: "POST" })
  .middleware([requireLiveAccount])
  .inputValidator((d: unknown) =>
    z.object({ attemptId: z.string().uuid(), comment: z.string().max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attempt, error } = await supabaseAdmin
      .from("attempts")
      .select("id, student_id, course_id")
      .eq("id", data.attemptId)
      .single();
    if (error || !attempt) throw new Error("المحاولة غير موجودة");
    await assertCourseTeacher(context.supabase, attempt.course_id);

    const comment = data.comment.trim() || null;
    const { error: upErr } = await supabaseAdmin
      .from("attempts")
      .update({ teacher_comment: comment, commented_at: comment ? new Date().toISOString() : null })
      .eq("id", data.attemptId);
    if (upErr) throw new Error(upErr.message);

    if (comment) {
      const { data: links } = await supabaseAdmin
        .from("parent_links")
        .select("parent_id")
        .eq("student_id", attempt.student_id)
        .eq("status", "approved");
      const rows = [
        { user_id: attempt.student_id, title: "تعليق جديد من معلمك", body: comment.slice(0, 200), kind: "teacher_comment", link: "/student" },
        ...(links ?? []).map((l) => ({ user_id: l.parent_id, title: "تعليق المعلم على نتيجة ابنك", body: comment.slice(0, 200), kind: "teacher_comment", link: "/parent" })),
      ];
      await supabaseAdmin.from("notifications").insert(rows);
    }
    return { ok: true };
  });
