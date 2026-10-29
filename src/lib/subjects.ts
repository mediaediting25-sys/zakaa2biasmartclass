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

export function subjectLabel(ar: string, locale: string) {
  if (locale === "ar") return ar;
  return SUBJECTS.find((s) => s.ar === ar)?.en ?? ar;
}
