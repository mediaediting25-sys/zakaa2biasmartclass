export const SUBJECTS: { ar: string; en: string }[] = [
  { ar: "اللغة العربية", en: "Arabic" },
  { ar: "اللغة الإنجليزية", en: "English" },
  { ar: "اللغة الفرنسية", en: "French" },
  { ar: "الرياضيات", en: "Mathematics" },
  { ar: "العلوم", en: "Science" },
  { ar: "الفيزياء", en: "Physics" },
  { ar: "الكيمياء", en: "Chemistry" },
  { ar: "الأحياء", en: "Biology" },
  { ar: "الدراسات الاجتماعية", en: "Social studies" },
  { ar: "التاريخ", en: "History" },
  { ar: "الجغرافيا", en: "Geography" },
  { ar: "التربية الدينية", en: "Religious education" },
  { ar: "الحاسب الآلي", en: "Computer science" },
];

export type CatalogSubject = { subject_key: string; name_ar: string; name_en: string };

export function subjectLabel(key: string, locale: string, catalog: readonly CatalogSubject[] = []) {
  const subject = catalog.find(s => s.subject_key === key);
  if (subject) return locale === "ar" ? subject.name_ar : subject.name_en;
  if (locale === "ar") return key;
  return SUBJECTS.find((s) => s.ar === key)?.en ?? key;
}
