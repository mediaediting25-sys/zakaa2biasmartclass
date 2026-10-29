import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpenCheck, FileText, LineChart, ShieldCheck, Sparkles, Users } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

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

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        {ar ? "سمارت كلاس — تعليم مبني على الأدلة" : "SmartClass — evidence-based teaching"}
      </footer>
    </div>
  );
}
