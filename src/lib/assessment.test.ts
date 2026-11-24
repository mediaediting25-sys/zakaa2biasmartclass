import { describe, expect, it } from "vitest";
import { assessmentOptions, assessmentSection, batchReadyForPublication, distributeQuestionCount, isRepeatedQuestion, canDeleteQuestion, isDuplicateQuestion, buildActivityTitle, displayActivityTitle } from "./assessment";

describe("teacher assessment rules", () => {
  it("accepts Arabic, English and both for question and homework generation", () => {
    for (const language of ["ar", "en", "both"]) expect(assessmentOptions.parse({ count: 5, language }).language).toBe(language);
    expect(assessmentOptions.safeParse({ count: 5, language: "fr" }).success).toBe(false);
  });
  it("only allows deletion of rejected questions", () => {
    expect(canDeleteQuestion("rejected")).toBe(true);
    for (const status of ["draft", "approved", "published"]) expect(canDeleteQuestion(status)).toBe(false);
  });
  it("keeps a batch in review until all non-rejected questions are approved", () => {
    expect(batchReadyForPublication([{ status: "approved" }, { status: "draft" }], () => false)).toBe(false);
    expect(batchReadyForPublication([{ status: "approved" }, { status: "rejected" }], () => false)).toBe(true);
    expect(batchReadyForPublication([{ status: "approved" }], () => true)).toBe(false);
    expect(batchReadyForPublication([], () => false)).toBe(false);
  });
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
  it("catches the same fact asked twice in one set", () => {
    const a = "تدور الأقمار الصناعية حول الأرض لإرسال المعلومات";
    expect(isRepeatedQuestion("الأقمار الصناعية تدور حول الأرض لإرسال المعلومات", [a])).toBe(true);
    expect(isRepeatedQuestion("ما وظيفة الرادار في الطقس؟", [a])).toBe(false);
    const first = { stem: "ما الأداة التي تكشف الأمطار والعواصف؟", correct_answer: "جهاز الرادار" };
    expect(isDuplicateQuestion({ stem: "أي أداة تستخدم لكشف العواصف والأمطار؟", correct_answer: "جهاز الرادار" }, [first])).toBe(true);
    expect(isDuplicateQuestion({ stem: "ما وظيفة الأقمار الصناعية؟", correct_answer: "جهاز الرادار" }, [first])).toBe(false);
    expect(isDuplicateQuestion({ stem: "الشمس نجم", correct_answer: "صح" }, [{ stem: "القمر تابع", correct_answer: "صح" }])).toBe(false);
  });
  it("builds readable activity titles without ISO timestamps", () => {
    const now = new Date("2026-11-21T22:19:57.846Z");
    const t = buildActivityTitle({ language: "ar", lessonTitle: "الطقس", sequence: 3, now });
    expect(t).toBe("تدريب: الطقس · عربي · #3 · 2026-11-22");
    expect(buildActivityTitle({ language: "en", homework: true, lessonTitle: "Weather", sequence: 1, now })).toBe("Homework: Weather · English · #1 · 2026-11-22");
    expect(t).not.toMatch(/T\d{2}:/);
  });
  it("shows old titles with a short date and time instead of raw ISO", () => {
    expect(displayActivityTitle("تدريب: الطقس · AR · 2026-11-21T22:19:57.846Z")).toBe("تدريب: الطقس · عربي · 2026-11-22 00:19");
    expect(displayActivityTitle("تدريب: الطقس")).toBe("تدريب: الطقس");
  });
});
