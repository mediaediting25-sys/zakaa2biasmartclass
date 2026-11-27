import { teacherAccessStatus } from "./subscriptions";

export const ENDING_SOON_DAYS = 14;

export type OverviewInput = {
  roles: { user_id: string; role: string }[];
  profiles: { id: string; full_name: string | null; email: string | null; created_at?: string | null }[];
  owners?: string[];
  courses: { id: string; teacher_id: string; status: string }[];
  enrollments: { course_id: string; student_id: string }[];
  periods: { teacher_id: string; starts_at: string; ends_at: string; plan_id?: string }[];
};

export type TeacherStatus = "active" | "trial" | "soon" | "upcoming" | "expired" | "none" | "owner";
export type TeacherRow = {
  id: string;
  name: string;
  email: string;
  courses: number;
  students: number;
  status: TeacherStatus;
  endsAt: string | null;
};
export type Overview = {
  totals: {
    teachers: number;
    students: number;
    parents: number;
    admins: number;
    courses: number;
    publishedCourses: number;
    draftCourses: number;
    archivedCourses: number;
    enrolledStudents: number;
    activeSubscriptions: number;
    endingSoon: number;
  };
  teachers: TeacherRow[];
};

/** Pure aggregation: counts and teacher name/email only. No student names, answers or scores. */
export function buildOverview(input: OverviewInput, now: number = Date.now()): Overview {
  const roleCount = (role: string) => new Set(input.roles.filter((r) => r.role === role).map((r) => r.user_id)).size;
  const teacherIds = [...new Set(input.roles.filter((r) => r.role === "teacher").map((r) => r.user_id))];
  const owners = new Set(input.owners ?? []);
  const soonLimit = now + ENDING_SOON_DAYS * 86_400_000;

  const courseOwner = new Map(input.courses.map((c) => [c.id, c.teacher_id]));
  const studentsByTeacher = new Map<string, Set<string>>();
  const allEnrolled = new Set<string>();
  for (const e of input.enrollments) {
    allEnrolled.add(e.student_id);
    const owner = courseOwner.get(e.course_id);
    if (!owner) continue;
    if (!studentsByTeacher.has(owner)) studentsByTeacher.set(owner, new Set());
    studentsByTeacher.get(owner)!.add(e.student_id);
  }

  let activeSubscriptions = 0;
  let endingSoon = 0;
  const teachers: TeacherRow[] = teacherIds.map((id) => {
    const profile = input.profiles.find((p) => p.id === id);
    const periods = input.periods.filter((p) => p.teacher_id === id).map((p) => ({ starts_at: p.starts_at, ends_at: p.ends_at, plan_id: p.plan_id ?? "" }));
    // Same rule as the teacher's own subscription card: saved periods plus the 30-day trial from sign-up.
    const access = teacherAccessStatus(periods, profile?.created_at ?? null, now);
    let status: TeacherStatus = "none";
    let endsAt: string | null = access.period?.ends_at ?? null;
    if (owners.has(id)) {
      status = "owner";
      endsAt = null;
    } else if (access.status === "active") {
      const trial = access.period?.isTrial === true;
      status = Date.parse(access.period?.ends_at ?? "") <= soonLimit ? "soon" : trial ? "trial" : "active";
      activeSubscriptions += 1;
      if (status === "soon") endingSoon += 1;
    } else if (access.status === "upcoming") {
      status = "upcoming";
      endsAt = access.period?.starts_at ?? null;
    } else if (access.status === "expired") {
      status = "expired";
    }
    return {
      id,
      name: profile?.full_name ?? "",
      email: profile?.email ?? "",
      courses: input.courses.filter((c) => c.teacher_id === id).length,
      students: studentsByTeacher.get(id)?.size ?? 0,
      status,
      endsAt,
    };
  });
  teachers.sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return {
    totals: {
      teachers: teacherIds.length,
      students: roleCount("student"),
      parents: roleCount("parent"),
      admins: roleCount("admin"),
      courses: input.courses.length,
      publishedCourses: input.courses.filter((c) => c.status === "published").length,
      draftCourses: input.courses.filter((c) => c.status === "draft").length,
      archivedCourses: input.courses.filter((c) => c.status === "archived").length,
      enrolledStudents: allEnrolled.size,
      activeSubscriptions,
      endingSoon,
    },
    teachers,
  };
}
