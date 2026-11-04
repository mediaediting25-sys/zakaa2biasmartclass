import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, FileText, LineChart, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { SUBJECTS, subjectLabel } from "@/lib/subjects";

function FeaturedTeachers({ ar }: { ar: boolean }) {
  const { locale } = useI18n();
  const q = useQuery({
    queryKey: ["teacher-listings-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_listings")
        .select("teacher_id, display_name, subjects, grade_levels")
        .eq("is_listed", true)
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{ar ? "المدرسون المتاحون على المنصة" : "Available teachers"}</h2>
          <p className="mt-2 text-muted-foreground">{ar ? "اختر مدرسك واطلب الانضمام لمجموعته من خلالنا." : "Choose a teacher and request to join through us."}</p>
        </div>
        <Button asChild variant="outline"><Link to="/teachers">{ar ? "عرض كل المدرسين" : "All teachers"}</Link></Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!q.data?.length ? (
          <p className="text-muted-foreground">{ar ? "سيظهر المدرسون هنا فور انضمامهم للدليل." : "Teachers will appear here once they join the directory."}</p>
        ) : (
          q.data.map((t) => (
            <Link key={t.teacher_id} to="/teachers" className="surface flex items-center gap-3 rounded-2xl p-5 transition-shadow hover:shadow-lg">
              <span className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground"><UserRound className="size-5" /></span>
              <div>
                <div className="font-display font-bold">{t.display_name}</div>
                <div className="text-xs text-muted-foreground">{t.subjects.map((s) => subjectLabel(s, locale)).join(" · ") || t.grade_levels}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "سمارت كلاس — منهج ذكي من ملفاتك | SmartClass AI" },
      {
        name: "description",
        content:
          "منصة تعليمية تحوّل ملفات المنهج والامتحانات السابقة إلى دروس وأهداف وأسئلة يعتمدها المعلم، مع متابعة تقدم حقيقية للطالب وولي الأمر.",
      },
      { property: "og:title", content: "سمارت كلاس — منهج ذكي من ملفاتك" },
      {
        property: "og:description",
        content: "حوّل ملفات المنهج إلى دروس وأسئلة يعتمدها المعلم، وتابع إتقان كل طالب.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { locale } = useI18n();
  const ar = locale === "ar";

  const features = [
    {
      icon: FileText,
      title: ar ? "ارفع ملف المنهج" : "Upload your syllabus",
      body: ar
        ? "ملفات PDF تُحفظ في مساحة خاصة لا يراها غيرك، وتُقرأ صفحة بصفحة."
        : "PDFs are stored privately and read page by page.",
    },
    {
      icon: Sparkles,
      title: ar ? "مسودة منهج مقترحة" : "A suggested draft",
      body: ar
        ? "وحدات ودروس وأهداف وأسئلة مقترحة، مع المصدر ورقم الصفحة لكل عنصر."
        : "Units, lessons, objectives and questions, each with its source page.",
    },
    {
      icon: ShieldCheck,
      title: ar ? "لا نشر بدون اعتمادك" : "Nothing publishes itself",
      body: ar
        ? "كل عنصر يبقى مسودة حتى يراجعه المعلم ويعتمده بنفسه."
        : "Every item stays a draft until a teacher approves it.",
    },
    {
      icon: BookOpenCheck,
      title: ar ? "الطالب يرى المعتمد فقط" : "Students see approved work only",
      body: ar
        ? "الطالب يفتح ما سُجّل به فقط، ويحلّ الأسئلة فتُسجَّل إجاباته."
        : "Students only open what they're enrolled in, and answers are recorded.",
    },
    {
      icon: LineChart,
      title: ar ? "إتقان محسوب لا مُختلق" : "Mastery from evidence",
      body: ar
        ? "نسبة الإتقان تُحسب من إجابات الطالب الحقيقية لكل هدف تعليمي."
        : "Mastery is computed from real answers per objective.",
    },
    {
      icon: Users,
      title: ar ? "ولي الأمر يرى أبناءه" : "Parents see their children",
      body: ar
        ? "ولي الأمر يتابع تقدم أبنائه المرتبطين فقط، بعد موافقتهم."
        : "Parents follow only their approved, linked children.",
    },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="gradient-hero">
        <div className="mx-auto flex min-h-[540px] w-full max-w-6xl items-center px-4 py-16 md:py-20">
          <div className="max-w-md">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5 text-accent" />
              {ar ? "عربي وإنجليزي — بلا ترجمة تلقائية للمحتوى" : "Arabic & English, no auto-translation"}
            </p>
            <h1 className="font-display text-4xl leading-tight font-extrabold sm:text-5xl">
              {ar ? "سمارت كلاس" : "SmartClass AI"}
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              {ar
                ? "ارفع ملف المنهج والامتحانات السابقة، واحصل على وحدات ودروس وأهداف وأسئلة مقترحة تعتمدها بنفسك قبل أن يراها أي طالب."
                : "Upload your syllabus and past exams, then review and approve every generated unit, lesson and question before students see it."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">{ar ? "ابدأ الآن" : "Get started"}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pricing">{ar ? "الباقات والأسعار" : "Pricing"}</Link>
              </Button>
            </div>
          </div>


        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="surface p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <f.icon className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{ar ? "ملخص المنصة: كل ما تقدمه سمارت كلاس" : "Platform overview"}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { t: ar ? "للمعلم" : "For teachers", items: ar
              ? ["إنشاء مقررات ورفع ملفات المنهج والامتحانات (حتى 500 ميغابايت)", "مسودة ذكية للوحدات والدروس والأهداف والأسئلة مع رقم الصفحة", "مراجعة واعتماد كل عنصر قبل النشر", "تقارير لكل طالب: الإجابات والدرجة والتعليق", "السماح بإعادة الحل لطالب محدد", "ملف في دليل المدرسين لاستقبال طلبات الانضمام"]
              : ["Create courses and upload syllabus/exam PDFs (up to 500MB)", "AI draft of units, lessons, objectives and questions with page sources", "Review and approve everything before publishing", "Per-student reports: answers, score, comments", "Grant a retake to a specific student", "Directory profile to receive join requests"] },
            { t: ar ? "للطالب" : "For students", items: ar
              ? ["يرى مواد مدرسيه فقط", "حل الأنشطة المنشورة وتسجيل الإجابات", "نسبة إتقان لكل هدف من إجاباته الحقيقية", "تعليقات المعلم والإشعارات", "البحث عن مدرس حسب المادة وطلب الانضمام"]
              : ["Sees only their own teachers' courses", "Solve published activities", "Mastery per objective from real answers", "Teacher comments and notifications", "Find a teacher by subject and request to join"] },
            { t: ar ? "لولي الأمر" : "For parents", items: ar
              ? ["ربط حساب الابن برمز من الابن نفسه", "متابعة التقدم والدرجات وتعليقات المعلم", "اختيار مدرسين لابنه وتقديم طلب انضمام", "تطبيق يُثبَّت على الموبايل من أي متصفح"]
              : ["Link a child with the child's own code", "Follow progress, scores and comments", "Choose teachers for a child and send a request", "Installable app on any mobile browser"] },
          ].map((col) => (
            <article key={col.t} className="surface rounded-2xl p-6">
              <h3 className="font-display text-lg font-bold text-primary">{col.t}</h3>
              <ul className="mt-3 list-disc space-y-1.5 ps-5 text-sm text-muted-foreground">
                {col.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{ar ? "كيف يضيف المعلم طلابه؟" : "How teachers add students"}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="surface rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold">{ar ? "الطريقة الأولى: رمز المقرر" : "Option 1: Course code"}</h3>
            <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground">
              {(ar
                ? ["ينشئ المعلم المقرر وينشره من لوحته.", "يظهر للمقرر رمز من 6 أحرف، يرسله المعلم لطلابه (واتساب أو في الفصل).", "يكتب الطالب الرمز في لوحته ويضغط «انضمام».", "يُضاف الطالب فورًا ويظهر في جدول «طلاب المواد» عند المعلم. لا يوجد حد لعدد الطلاب في المقرر."]
                : ["The teacher creates and publishes a course.", "The course gets a 6-letter code the teacher shares.", "The student enters the code and taps “Join”.", "The student appears instantly in the teacher's student table. No limit on students."]
              ).map((s) => <li key={s}>{s}</li>)}
            </ol>
          </article>
          <article className="surface rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold">{ar ? "الطريقة الثانية: طلب انضمام عبر المنصة" : "Option 2: Join request"}</h3>
            <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground">
              {(ar
                ? ["يختار الطالب أو ولي الأمر المادة من صفحة «المدرسون».", "يختار المدرس ويرسل طلب انضمام مع رسالة اختيارية.", "يصل الطلب للمدرس كإشعار في لوحته.", "يقبل المدرس ويحدد المقرر (المجموعة)، فيُضاف الطالب ويصله إشعار بالقبول."]
                : ["The student or parent picks a subject on the Teachers page.", "They choose a teacher and send a request.", "The teacher is notified in their dashboard.", "The teacher accepts and picks a course; the student is added and notified."]
              ).map((s) => <li key={s}>{s}</li>)}
            </ol>
          </article>
        </div>
        <div className="surface mt-4 flex items-start gap-3 rounded-2xl p-5 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            {ar
              ? "خصوصية المواد: الطالب يرى فقط المقررات التي أضافه إليها مدرسه، ولا يمكنه رؤية مواد أي مدرس آخر. والمدرس يرى طلابه هو فقط."
              : "Privacy: a student only sees courses their own teacher added them to, never another teacher's material. Teachers only see their own students."}
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{ar ? "المواد الدراسية" : "Subjects"}</h2>
        <p className="mt-2 text-muted-foreground">{ar ? "اختر مادة لترى المدرسين المتاحين لها على المنصة." : "Pick a subject to see its available teachers."}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SUBJECTS.map((s) => (
            <Link key={s.ar} to="/teachers" search={{ subject: s.ar }} className="surface rounded-2xl p-4 text-center font-display font-bold transition-shadow hover:shadow-lg">
              {ar ? s.ar : s.en}
            </Link>
          ))}
        </div>
      </section>

      <FeaturedTeachers ar={ar} />

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        {ar ? "سمارت كلاس — تعليم مبني على الأدلة" : "SmartClass — evidence-based teaching"}
      </footer>
    </div>
  );
}
