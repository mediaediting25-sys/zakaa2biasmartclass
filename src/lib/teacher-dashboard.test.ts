import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { buildStudentRows } from "./teacher-dashboard";

const enrollments = [{ course_id: "math", student_id: "student", created_at: "2026-10-17" }];
describe("teacher dashboard roster", () => {
  test("includes every enrolled student even without an attempt", () => {
    const rows = buildStudentRows(enrollments, [{ id: "student", full_name: "أحمد", email: null }], [], []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, "أحمد");
    assert.equal(rows[0]?.status, "not_started");
    assert.equal(rows[0]?.percentage, null);
  });
  test("keeps results scoped to the same course", () => {
    const rows = buildStudentRows(enrollments, [], [], [{ course_id: "science", student_id: "student", activity_id: "a", score: 10, max_score: 10, submitted_at: "2026-10-17" }]);
    assert.equal(rows[0]?.attempts, 0);
  });
  test("counts a retaken activity once and uses its latest grade", () => {
    const rows = buildStudentRows(enrollments, [], [{ id: "a", course_id: "math" }], [
      { course_id: "math", student_id: "student", activity_id: "a", score: 1, max_score: 2, submitted_at: "2026-10-16" },
      { course_id: "math", student_id: "student", activity_id: "a", score: 2, max_score: 2, submitted_at: "2026-10-17" },
    ]);
    assert.equal(rows[0]?.completed, 1);
    assert.equal(rows[0]?.percentage, 100);
    assert.equal(rows[0]?.attempts, 2);
  });
});