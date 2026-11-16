import type { Locale } from "./i18n";

// Fixed system wording only; names, answers, source quotes and teacher comments stay unchanged.
const phrases: Record<string, string> = {
  "انتهت مدة التجربة أو الاشتراك. يمكنك قراءة مقرراتك وتقاريرك، وطلب التجديد لاستئناف الإنشاء والتوليد والنشر.": "Your trial or subscription has ended. You can read your courses and reports, and request renewal to resume creating, generating and publishing.",
  "تعذر التحقق من الاشتراك؛ حاول مرة أخرى.": "Unable to verify your subscription. Please try again.",
  "النشاط غير متاح — activity not available": "Activity not available",
  "لا يمكنك إعادة حل هذا النشاط إلا بإذن المعلم": "You can only retake this activity with your teacher's permission",
  "غير مصرح — not the course teacher": "Only the course teacher can perform this action",
  "المستند غير موجود — document not found": "Document not found",
  "الدرس غير موجود": "Lesson not found",
  "لا توجد امتحانات سابقة محلّلة — ارفع ملف امتحانات وانتظر تحليله أولًا.": "No analyzed past exams. Upload an exam file and wait for analysis first.",
  "ملفات الامتحانات بلا نص قابل للقراءة.": "The exam files contain no readable text.",
  "خيارات ناقصة": "Missing answer options",
  "الإجابة الصحيحة غير موجودة ضمن الخيارات": "The correct answer is missing from the options",
  "بلا صفحة أو اقتباس من الكتاب": "Missing source page or book quote",
  "لا يمكن النشر: لا يوجد سؤال معتمد مكتمل وموثّق بالمصدر": "Cannot publish: no complete, approved question with a verified source",
  "هذه الصفحة متاحة لمعلم المقرر فقط": "This page is only available to the course teacher",
  "المحاولة غير موجودة": "Attempt not found",
  "سماح بإعادة الحل": "Retake allowed",
  "أذن لك معلمك بإعادة حل أحد الأنشطة.": "Your teacher has allowed you to retake an activity.",
  "تعليق جديد من معلمك": "New comment from your teacher",
  "تعليق المعلم على نتيجة ابنك": "Teacher comment on your child's result",
  "تنبيه: مهارة تحتاج مراجعة": "Alert: a skill needs review",
  "تعذّر تحميل الملف — file download failed": "Unable to download the file",
  "تعذّر استخراج نص من الملف حتى بعد قراءة الصور — No readable text found, even after OCR.": "No readable text found, even after OCR.",
  "الملف طويل جدًا؛ تم تحليل الجزء الأول فقط — Document truncated for analysis.": "The document is too long; only the first part was analyzed.",
  "لا توجد نصوص مفهرسة لهذا المقرر — analyze a document first.": "No indexed text for this course. Analyze a document first.",
  "تم استبعاد سؤال بصيغة غير صالحة.": "A question with an invalid format was excluded.",
  "لم يُعثر على الاقتباس في الكتاب — يحتاج مراجعة.": "The quote was not found in the book — review required.",
  "لعدم وجود دليل نصي في الكتاب.": "because no supporting text was found in the book.",
  "تم استبعاد سؤال بلا دليل في الكتاب:": "Excluded a question without supporting text in the book:",
  "استبعد المدقق سؤالًا:": "The validator excluded a question:",
  "تسليم جديد:": "New submission:",
  "— الدرجة": "— Score",
  "في": "in",
  "تراجع مستوى": "Mastery decline for",
  "مستوى إتقانك أقل من 50% في:": "Your mastery is below 50% in:",
  "إتقان أقل من 50% في:": "Mastery below 50% in:",
  "إتقان أقل من 50% في": "Mastery below 50% in",
  "درس": "Lesson",
  "تم استبعاد": "Excluded",
  "هدف/أهداف": "objectives"
};

export function localizeMessage(locale: Locale, text: string) {
  if (locale !== "en") return text;
  if (phrases[text]) return phrases[text];
  let result = text;
  for (const [source, translated] of Object.entries(phrases).sort((a, b) => b[0].length - a[0].length)) {
    if (source === "في" || source === "درس") continue;
    result = result.split(source).join(translated);
  }
  return result;
}

export function localizeNotification(locale: Locale, title: string, body: string | null, kind: string) {
  if (locale !== "en") return { title, body };
  // Comment bodies are user-authored, never translate them.
  const translatedTitle = localizeMessage(locale, title);
  let translatedBody = kind === "teacher_comment" ? body : body ? localizeMessage(locale, body) : body;
  if (title.startsWith("تسليم جديد:") && translatedBody) translatedBody = translatedBody.replace(/(\d+\/\d+) في /, "$1 in ");
  return { title: translatedTitle, body: translatedBody };
}
