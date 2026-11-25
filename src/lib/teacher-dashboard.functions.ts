import { createServerFn } from "@tanstack/react-start";
import { requireLiveAccount } from "@/lib/live-account-middleware";
import { buildStudentRows } from "./teacher-dashboard";

export const getTeacherDashboard = createServerFn({ method: "GET" })
  .middleware([requireLiveAccount])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const role = await db.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["teacher", "admin"]);
    if (role.error || !role.data?.length) throw new Error("هذه اللوحة متاحة للمعلم فقط");
    const courses = await db.from("courses").select("id, title, subject, grade_level, status").eq("teacher_id", context.userId).order("created_at", { ascending: false });
    if (courses.error) throw new Error("تعذر تحميل المواد");
    const ids = (courses.data ?? []).map((c) => c.id);
    if (!ids.length) return { courses: [], students: [] };
    const [enrollments, activities, attempts] = await Promise.all([
      db.from("enrollments").select("course_id, student_id, created_at").in("course_id", ids),
      db.from("activities").select("id, course_id").in("course_id", ids).eq("status", "published"),
      db.from("attempts").select("course_id, student_id, activity_id, score, max_score, submitted_at").in("course_id", ids).not("submitted_at", "is", null),
    ]);
    if (enrollments.error || activities.error || attempts.error) throw new Error("تعذر تحميل بيانات الطلاب");
    const studentIds = [...new Set((enrollments.data ?? []).map((e) => e.student_id))];
    const profiles = studentIds.length ? await db.from("profiles").select("id, full_name, email").in("id", studentIds) : { data: [], error: null };
    if (profiles.error) throw new Error("تعذر تحميل أسماء الطلاب");
    // Students who deleted their account keep their records: read the saved name (only for students of this teacher's courses).
    const known = new Set((profiles.data ?? []).map((p) => p.id));
    const missing = studentIds.filter((id) => !known.has(id));
    let departed: { id: string; full_name: string | null; email: string | null }[] = [];
    if (missing.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const saved = await (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("departed_accounts").select("user_id, full_name, email").in("user_id", missing);
      departed = ((saved.data ?? []) as { user_id: string; full_name: string | null; email: string | null }[]).map((d) => ({ id: d.user_id, full_name: d.full_name, email: d.email }));
    }
    return { courses: courses.data ?? [], students: buildStudentRows(enrollments.data ?? [], profiles.data ?? [], activities.data ?? [], attempts.data ?? [], departed) };
  });