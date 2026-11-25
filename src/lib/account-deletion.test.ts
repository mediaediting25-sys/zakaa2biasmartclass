import { describe, expect, it } from "vitest";
import { emailConfirmed, studentDisplayName, LEFT_COURSE_LABEL } from "./account-deletion";

describe("account deletion rules", () => {
  it("requires the typed email to match the account email", () => {
    expect(emailConfirmed("Ali@Example.com", " ali@example.com ")).toBe(true);
    expect(emailConfirmed("ali@example.com", "other@example.com")).toBe(false);
    expect(emailConfirmed("", "")).toBe(false);
  });
  it("keeps the real name and adds the left-course label for a departed student", () => {
    expect(studentDisplayName({ full_name: "Sara", email: "s@x.com" }, undefined)).toEqual({ name: "Sara", left: false });
    const gone = studentDisplayName(undefined, { full_name: "Sara", email: "s@x.com" });
    expect(gone.left).toBe(true);
    expect(gone.name).toBe(`Sara (${LEFT_COURSE_LABEL})`);
    expect(studentDisplayName(undefined, undefined).name).toContain(LEFT_COURSE_LABEL);
  });
});
