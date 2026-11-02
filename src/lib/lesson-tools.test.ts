import { describe, expect, it } from "vitest";
import { answerMatches, questionIssues, readSlides } from "./lesson-tools";

describe("mixed homework", () => {
  it("publishes sourced fill-blank without choices", () => {
    expect(questionIssues({ kind: "fill_blank", options: [], correct_answer: { value: "الماء" }, source_page: 3, source_quote: "الماء ضروري للنبات" })).toEqual([]);
  });
  it("requires a model answer for short answers", () => {
    expect(questionIssues({ kind: "short_answer", options: [], correct_answer: { value: "" }, source_page: 3, source_quote: "النبات" })).toContain("الإجابة الصحيحة ناقصة");
  });
  it("accepts teacher-approved alternatives for text answers", () => {
    expect(answerMatches("short_answer", { value: "water", accepted: ["H2O"] }, " h2o ")).toBe(true);
    expect(answerMatches("short_answer", { value: "water", accepted: ["H2O"] }, "oxygen")).toBe(false);
  });
  it("choice answers stay exact", () => {
    expect(answerMatches("multiple_choice", { value: "Water", accepted: ["Oxygen"] }, "Oxygen")).toBe(false);
  });
  it("rejects malformed saved presentations", () => { expect(readSlides([{ title: "Only title" }])).toEqual([]); });
});