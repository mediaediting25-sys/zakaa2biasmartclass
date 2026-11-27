import { describe, expect, it } from "vitest";
import { buildOverview } from "./owner-overview";

const now = Date.parse("2026-11-27T12:00:00Z");
const day = 86_400_000;
const iso = (n: number) => new Date(now + n * day).toISOString();

describe("buildOverview", () => {
  const out = buildOverview(
    {
      roles: [
        { user_id: "t1", role: "teacher" }, { user_id: "t2", role: "teacher" }, { user_id: "t3", role: "teacher" }, { user_id: "t4", role: "teacher" },
        { user_id: "s1", role: "student" }, { user_id: "s2", role: "student" }, { user_id: "p1", role: "parent" }, { user_id: "a1", role: "admin" },
      ],
      profiles: [{ id: "t1", full_name: "A", email: "a@x.com" }, { id: "t2", full_name: "B", email: "b@x.com" }, { id: "t3", full_name: "C", email: "c@x.com" }, { id: "t4", full_name: "D", email: "d@x.com" }],
      courses: [{ id: "c1", teacher_id: "t1", status: "published" }, { id: "c2", teacher_id: "t1", status: "draft" }, { id: "c3", teacher_id: "t2", status: "published" }],
      enrollments: [{ course_id: "c1", student_id: "s1" }, { course_id: "c2", student_id: "s1" }, { course_id: "c3", student_id: "s2" }, { course_id: "c1", student_id: "s2" }],
      periods: [
        { teacher_id: "t1", starts_at: iso(-30), ends_at: iso(60) },
        { teacher_id: "t2", starts_at: iso(-30), ends_at: iso(5) },
        { teacher_id: "t3", starts_at: iso(-60), ends_at: iso(-10) },
      ],
    },
    now,
  );
  it("counts roles, courses and distinct enrolled students", () => {
    expect(out.totals).toMatchObject({ teachers: 4, students: 2, parents: 1, admins: 1, courses: 3, publishedCourses: 2, draftCourses: 1, enrolledStudents: 2 });
  });
  it("classifies subscriptions", () => {
    expect(out.totals.activeSubscriptions).toBe(2);
    expect(out.totals.endingSoon).toBe(1);
    const status = (id: string) => out.teachers.find((t) => t.id === id)?.status;
    expect(["t1", "t2", "t3", "t4"].map(status)).toEqual(["active", "soon", "expired", "none"]);
  });
  it("counts each teacher's distinct students and courses", () => {
    const t1 = out.teachers.find((t) => t.id === "t1")!;
    expect([t1.courses, t1.students]).toEqual([2, 2]);
  });
  it("returns only teacher name and email, no student data", () => {
    expect(Object.keys(out.teachers[0] ?? {}).sort()).toEqual(["courses", "email", "endsAt", "id", "name", "status", "students"]);
  });

  describe("trial, upcoming, owner", () => {
    const base = { roles: [{ user_id: "t", role: "teacher" }], courses: [], enrollments: [] };
    const run = (created: string, periods: { teacher_id: string; starts_at: string; ends_at: string }[] = [], owners: string[] = []) =>
      buildOverview({ ...base, profiles: [{ id: "t", full_name: "T", email: "t@x.com", created_at: created }], periods, owners }, now).teachers[0];
    it("shows the 30-day trial from sign-up as trial", () => {
      const t = run(iso(-5));
      expect(t?.status).toBe("trial");
    });
    it("trial ending within 14 days is ending soon, and after 30 days it is none", () => {
      expect(run(iso(-20))?.status).toBe("soon");
      expect(run(iso(-45))?.status).toBe("expired");
    });
    it("a future-start period is upcoming, not expired", () => {
      const t = run(iso(-45), [{ teacher_id: "t", starts_at: iso(10), ends_at: iso(40) }]);
      expect(t?.status).toBe("upcoming");
      expect(t?.endsAt).toBe(iso(10));
    });
    it("a paid period beats the trial label", () => {
      expect(run(iso(-5), [{ teacher_id: "t", starts_at: iso(-5), ends_at: iso(100) }])?.status).toBe("active");
    });
    it("the owner is exempt", () => {
      expect(run(iso(-400), [], ["t"])?.status).toBe("owner");
    });
    it("counts archived courses", () => {
      const o = buildOverview({ ...base, profiles: [], periods: [], courses: [{ id: "c", teacher_id: "t", status: "archived" }] }, now);
      expect(o.totals.archivedCourses).toBe(1);
    });
  });
});
