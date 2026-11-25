import { studentDisplayName } from "./account-deletion";
export type DashboardEnrollment = { course_id: string; student_id: string; created_at: string };
export type DashboardAttempt = { course_id: string; student_id: string; activity_id: string; score: number | null; max_score: number | null; submitted_at: string | null };

export function buildStudentRows(
  enrollments: DashboardEnrollment[],
  profiles: { id: string; full_name: string | null; email: string | null }[],
  activities: { id: string; course_id: string }[],
  attempts: DashboardAttempt[],
  departed: { id: string; full_name: string | null; email: string | null }[] = [],
) {
  return enrollments.map((enrollment) => {
    const profile = profiles.find((p) => p.id === enrollment.student_id);
    const shown = studentDisplayName(profile, departed.find((d) => d.id === enrollment.student_id));
    const published = new Set(activities.filter((a) => a.course_id === enrollment.course_id).map((a) => a.id));
    const submitted = attempts.filter((a) => a.course_id === enrollment.course_id && a.student_id === enrollment.student_id && a.submitted_at);
    const latest = new Map<string, DashboardAttempt>();
    for (const attempt of submitted) {
      const previous = latest.get(attempt.activity_id);
      if (!previous || String(attempt.submitted_at) > String(previous.submitted_at)) latest.set(attempt.activity_id, attempt);
    }
    const graded = [...latest.values()].filter((a) => a.score !== null && a.max_score !== null && a.max_score > 0);
    const score = graded.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const maxScore = graded.reduce((sum, a) => sum + (a.max_score ?? 0), 0);
    const completed = [...latest.keys()].filter((id) => published.has(id)).length;
    return {
      courseId: enrollment.course_id, studentId: enrollment.student_id,
      name: shown.name, left: shown.left, email: profile?.email ?? null,
      enrolledAt: enrollment.created_at, completed, total: published.size,
      attempts: submitted.length, score, maxScore,
      percentage: maxScore > 0 ? Math.round(score / maxScore * 100) : null,
      lastSubmitted: submitted.map((a) => a.submitted_at).sort().at(-1) ?? null,
      status: submitted.length === 0 ? "not_started" : published.size > 0 && completed === published.size ? "completed" : "in_progress",
    };
  });
}