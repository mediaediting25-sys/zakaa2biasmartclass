import { describe, expect, it } from "vitest";
import { assessmentOptions, assessmentSection, distributeQuestionCount, isRepeatedQuestion } from "./assessment";

describe("teacher assessment rules", () => {
  it("moves published batches to history and keeps them there after unpublishing", () => {
    expect(assessmentSection({ status: "draft" })).toBe("review");
    expect(assessmentSection({ status: "approved" })).toBe("review");
    expect(assessmentSection({ status: "published" })).toBe("history");
    expect(assessmentSection({ status: "draft", published_at: "2026-11-08" })).toBe("history");
  });
  it("rejects repeated questions despite punctuation and Arabic diacritics", () => {
    expect(isRepeatedQuestion("ما أهميةُ الماء؟", ["ما اهمية الماء"])).toBe(true);
    expect(isRepeatedQuestion("ما وظيفة الجذور؟", ["ما أهمية الماء؟"])).toBe(false);
  });
  it("distributes exactly the requested count across the selected unit", () => {
    expect(distributeQuestionCount(8, ["third-a", "third-b", "third-c"])).toEqual([{ lessonId: "third-a", count: 3 }, { lessonId: "third-b", count: 3 }, { lessonId: "third-c", count: 2 }]);
    expect(distributeQuestionCount(1, ["a", "b"])).toEqual([{ lessonId: "a", count: 1 }]);
  });
  it("accepts chosen age, grade, topic and count and rejects invalid counts", () => {
    expect(assessmentOptions.parse({ age: 6, grade: "Grade 1", topic: "الوحدة الثالثة", count: 8 }).age).toBe(6);
    expect(assessmentOptions.safeParse({ count: 0 }).success).toBe(false);
    expect(assessmentOptions.safeParse({ count: 2.5 }).success).toBe(false);
  });
});