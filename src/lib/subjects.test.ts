import { expect, it } from "vitest";
import { subjectLabel } from "./subjects";

it("renames display labels without changing the subject identity used by teachers", () => {
  const catalog = [{ subject_key: "الرياضيات", name_ar: "الرياضيات المتقدمة", name_en: "Advanced mathematics" }];
  expect(subjectLabel("الرياضيات", "ar", catalog)).toBe("الرياضيات المتقدمة");
  expect(subjectLabel("الرياضيات", "en", catalog)).toBe("Advanced mathematics");
  expect(catalog[0]?.subject_key).toBe("الرياضيات");
});
it("preserves names on historic teacher assignments when a subject is hidden", () => {
  expect(subjectLabel("الرياضيات", "ar", [])).toBe("الرياضيات");
  expect(subjectLabel("الرياضيات", "en", [])).toBe("Mathematics");
});