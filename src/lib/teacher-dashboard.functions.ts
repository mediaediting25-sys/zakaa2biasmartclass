import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildStudentRows } from "./teacher-dashboard";

export const getTeacherDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
    return { courses: courses.data ?? [], students: buildStudentRows(enrollments.data ?? [], profiles.data ?? [], activities.data ?? [], attempts.data ?? []) };
  });