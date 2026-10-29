import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Activity readable by the caller under RLS (published + enrolled), else throws. */
async function assertActivity(supabase: any, activityId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("id, course_id, title, instructions")
    .eq("id", activityId)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) throw new Error("النشاط غير متاح — activity not available");
  return data as { id: string; course_id: string; title: string; instructions: string | null };
}

/** Questions without answers: correct answers stay on the server. */
export const getStudentActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ activityId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const activity = await assertActivity(context.supabase, data.activityId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: qs, error } = await supabaseAdmin
      .from("questions")
      .select("id, stem, kind, options, points, position")
      .eq("activity_id", activity.id)
      .eq("status", "published")
      .order("position");
    if (error) throw new Error(error.message);

    // Retake lock: a submitted attempt blocks replay unless the teacher granted a retake.
    const { data: prior } = await supabaseAdmin
      .from("attempts")
      .select("id")
      .eq("activity_id", activity.id)
      .eq("student_id", context.userId)
      .not("submitted_at", "is", null)
      .limit(1);
    let locked = false;
    if (prior?.length) {
      const { data: grant } = await supabaseAdmin
        .from("retake_grants")
        .select("id")
        .eq("activity_id", activity.id)
        .eq("student_id", context.userId)
        .is("consumed_at", null)
        .maybeSingle();
      locked = !grant;
    }

    return {
      activity,
      locked,
      questions: (qs ?? []).map((q) => ({ ...q, options: (q.options as string[] | null) ?? [] })),
    };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        activityId: z.string().uuid(),
        startedAt: z.string(),
        answers: z.array(z.object({ questionId: z.string().uuid(), choice: z.string().nullable() })),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const activity = await assertActivity(context.supabase, data.activityId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Retake lock: one submitted attempt per activity unless the teacher granted a retake.
    const { data: prior } = await supabaseAdmin
      .from("attempts")
      .select("id")
      .eq("activity_id", activity.id)
      .eq("student_id", context.userId)
      .not("submitted_at", "is", null)
      .limit(1);
    let grantId: string | null = null;
    if (prior?.length) {
      const { data: grant } = await supabaseAdmin
        .from("retake_grants")
        .select("id")
        .eq("activity_id", activity.id)
        .eq("student_id", context.userId)
        .is("consumed_at", null)
        .maybeSingle();
      if (!grant) throw new Error("لا يمكنك إعادة حل هذا النشاط إلا بإذن المعلم");
      grantId = grant.id;
    }

    const { data: qs, error } = await supabaseAdmin
      .from("questions")
      .select("id, correct_answer, points, objective_id, explanation")
      .eq("activity_id", activity.id)
      .eq("status", "published");
    if (error) throw new Error(error.message);
    const chosen = new Map(data.answers.map((a) => [a.questionId, a.choice]));

    let score = 0;
    let max = 0;
    const graded = (qs ?? []).map((q) => {
      const pts = Number(q.points ?? 1);
      max += pts;
      const choice = chosen.get(q.id) ?? null;
      const ca = q.correct_answer as any;
      const correct = ca != null && typeof ca === "object" && "value" in ca ? String(ca.value) : ca == null ? null : String(ca);
      const ok = choice != null && correct === choice;
      if (ok) score += pts;
      return { q, choice, ok, pts };
    });

    const { data: attempt, error: aErr } = await supabaseAdmin
      .from("attempts")
      .insert({
        activity_id: activity.id,
        course_id: activity.course_id,
        student_id: context.userId,
        started_at: data.startedAt,
        submitted_at: new Date().toISOString(),
        score,
        max_score: max,
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);

    if (graded.length) {
      await supabaseAdmin.from("answers").insert(
        graded.map((g) => ({
          attempt_id: attempt.id,
          question_id: g.q.id,
          student_id: context.userId,
          response: { choice: g.choice },
          is_correct: g.ok,
          score: g.ok ? g.pts : 0,
        })),
      );
    }

    // Consume the retake grant so it can't be reused.
    if (grantId) {
      await supabaseAdmin.from("retake_grants").update({ consumed_at: new Date().toISOString() }).eq("id", grantId);
    }

    // Notify the teacher about the new submission (full report is on the course page).
    try {
      const { data: course } = await supabaseAdmin.from("courses").select("teacher_id, title").eq("id", activity.course_id).maybeSingle();
      const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
      if (course?.teacher_id) {
        await supabaseAdmin.from("notifications").insert({
          user_id: course.teacher_id,
          title: `تسليم جديد: ${prof?.full_name ?? "طالب"}`,
          body: `${activity.title} — الدرجة ${score}/${max} في ${course.title}`,
          kind: "attempt_submitted",
          link: `/course/${activity.course_id}`,
        });
      }
    } catch (e) {
      console.error("submission notify failed", e);
    }

    // Mastery per objective = cumulative correct / evidence.
    const byObj = new Map<string, { n: number; c: number }>();
    for (const g of graded) {
      if (!g.q.objective_id) continue;
      const cur = byObj.get(g.q.objective_id) ?? { n: 0, c: 0 };
      cur.n += 1;
      if (g.ok) cur.c += 1;
      byObj.set(g.q.objective_id, cur);
    }
    const lowSkills: string[] = [];
    for (const [objectiveId, v] of byObj) {
      const { data: existing } = await supabaseAdmin
        .from("mastery_records")
        .select("id, evidence_count, correct_count")
        .eq("student_id", context.userId)
        .eq("objective_id", objectiveId)
        .maybeSingle();
      const n = (existing?.evidence_count ?? 0) + v.n;
      const c = (existing?.correct_count ?? 0) + v.c;
      const row = { evidence_count: n, correct_count: c, mastery: n ? c / n : 0, updated_at: new Date().toISOString() };
      const prev = existing && existing.evidence_count ? existing.correct_count / existing.evidence_count : null;
      if (row.mastery < 0.5 && (prev === null || prev >= 0.5)) lowSkills.push(objectiveId);
      if (existing) await supabaseAdmin.from("mastery_records").update(row).eq("id", existing.id);
      else
        await supabaseAdmin.from("mastery_records").insert({
          ...row,
          student_id: context.userId,
          course_id: activity.course_id,
          objective_id: objectiveId,
        });
    }

    if (lowSkills.length) {
      try {
        const { data: objs } = await supabaseAdmin.from("objectives").select("description").in("id", lowSkills);
        const { data: course } = await supabaseAdmin.from("courses").select("teacher_id, title").eq("id", activity.course_id).maybeSingle();
        const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
        const { data: links } = await supabaseAdmin.from("parent_links").select("parent_id").eq("student_id", context.userId).eq("status", "approved");
        const name = prof?.full_name ?? "الطالب";
        const skills = (objs ?? []).map((o) => o.description).join("، ");
        const rows: any[] = [
          { user_id: context.userId, title: "تنبيه: مهارة تحتاج مراجعة", body: `مستوى إتقانك أقل من 50% في: ${skills}`, kind: "low_mastery", link: "/student" },
          ...(links ?? []).map((l) => ({ user_id: l.parent_id, title: `تراجع مستوى ${name}`, body: `إتقان أقل من 50% في: ${skills}`, kind: "low_mastery", link: "/parent" })),
        ];
        if (course?.teacher_id) rows.push({ user_id: course.teacher_id, title: `تراجع مستوى ${name}`, body: `${course.title}: إتقان أقل من 50% في ${skills}`, kind: "low_mastery", link: `/course/${activity.course_id}` });
        await supabaseAdmin.from("notifications").insert(rows);
      } catch (e) {
        console.error("notify failed", e);
      }
    }

    return {
      score,
      max,
      results: graded.map((g) => ({ questionId: g.q.id, correct: g.ok, explanation: g.q.explanation })),
    };
  });
