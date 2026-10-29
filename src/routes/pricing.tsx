import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Crown, Rocket, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "الباقات والأسعار — سمارت كلاس | Pricing — SmartClass AI" },
      {
        name: "description",
        content:
          "باقات مناسبة للمعلم والسنتر في مصر والخليج: ابدأ مجانًا، واشترك في الباقة التي تناسب عدد طلابك وملفات الذكاء الاصطناعي.",
      },
      { property: "og:title", content: "الباقات والأسعار — سمارت كلاس" },
      {
        property: "og:description",
        content: "ابدأ مجانًا واختر الباقة التي تناسب عدد طلابك ومذكراتك.",
      },
    ],
  }),
  component: PricingPage,
});

type Currency = "egp" | "sar" | "usd";

const CURRENCIES: { id: Currency; ar: string; en: string }[] = [
  { id: "egp", ar: "ج.م", en: "EGP" },
  { id: "sar", ar: "ر.س", en: "SAR" },
  { id: "usd", ar: "دولار", en: "USD" },
];

const PLANS = [
  {
    id: "starter",
    icon: Rocket,
    price: { egp: 0, sar: 0, usd: 0 },
    popular: false,
    ar: {
      name: "باقة التجربة",
      blurb: "جرّب المنصة كاملة قبل أي اشتراك",
      cta: "ابدأ مجانًا",
      features: [
        "مقرر واحد فقط",
        "حتى 10 طلاب",
        "ملف PDF واحد بالذكاء الاصطناعي شهريًا",
        "تقارير أساسية",
      ],
    },
    en: {
      name: "Starter",
      blurb: "Try the full platform before subscribing",
      cta: "Start free",
      features: ["1 course only", "Up to 10 students", "1 AI PDF per month", "Basic reports"],
    },
  },
  {
    id: "pro",
    icon: Sparkles,
    price: { egp: 290, sar: 79, usd: 21 },
    popular: true,
    ar: {
      name: "المعلم الفردي",
      blurb: "لمدرس الدروس الخصوصية والمجموعات",
      cta: "اشترك الآن",
      features: [
        "حتى 3 مقررات",
        "حتى 70 طالبًا",
        "10 ملفات PDF بالذكاء الاصطناعي شهريًا",
        "ربط أولياء الأمور وتقارير تفصيلية",
        "منع إعادة حل النشاط إلا بإذنك",
      ],
    },
    en: {
      name: "Pro Teacher",
      blurb: "For tutors and small groups",
      cta: "Subscribe now",
      features: [
        "Up to 3 courses",
        "Up to 70 students",
        "10 AI PDFs per month",
        "Parent linking and detailed reports",
        "Retake requires teacher permission",
      ],
    },
  },
  {
    id: "elite",
    icon: Crown,
    price: { egp: 590, sar: 169, usd: 45 },
    popular: false,
    ar: {
      name: "المعلم المتميز",
      blurb: "للمدرس الأكثر شعبية أو متعدد المراحل",
      cta: "اشترك الآن",
      features: [
        "مقررات غير محدودة",
        "حتى 250 طالبًا",
        "30 ملف PDF بالذكاء الاصطناعي شهريًا",
        "تنبيهات متقدمة وتعليقات فورية",
        "دعم فني عبر واتساب",
      ],
    },
    en: {
      name: "Elite Teacher",
      blurb: "For popular teachers across grade levels",
      cta: "Subscribe now",
      features: [
        "Unlimited courses",
        "Up to 250 students",
        "30 AI PDFs per month",
        "Advanced alerts and instant feedback",
        "WhatsApp support",
      ],
    },
  },
  {
    id: "center",
    icon: Users,
    price: { egp: 1490, sar: 449, usd: 120 },
    popular: false,
    ar: {
      name: "السناتر والمدارس",
      blurb: "للمراكز التعليمية والمدارس الخاصة",
      cta: "اشترك الآن",
      features: [
        "حسابات لـ 5 معلمين",
        "حتى 800 طالب",
        "رفع مفتوح للمذكرات بالذكاء الاصطناعي",
        "لوحة تحكم مجمعة للإدارة",
      ],
    },
    en: {
      name: "Center / School",
      blurb: "For centers and private schools",
      cta: "Subscribe now",
      features: [
        "5 teacher seats",
        "Up to 800 students",
        "Open AI syllabus uploads",
        "Combined admin dashboard",
      ],
    },
  },
] as const;

const ADDONS = {
  egp: { ar: "50 ج.م = 5 مذكرات إضافية", en: "EGP 50 = 5 extra uploads" },
  sar: { ar: "25 ر.س = 10 مذكرات إضافية", en: "SAR 25 = 10 extra uploads" },
  usd: { ar: "$7 = 10 مذكرات إضافية", en: "$7 = 10 extra uploads" },
} as const;

function PricingPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [currency, setCurrency] = useState<Currency>("egp");

  const symbol = CURRENCIES.find((c) => c.id === currency)![ar ? "ar" : "en"];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
            {ar ? "باقات تناسب كل معلم" : "Plans for every teacher"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {ar
              ? "ابدأ مجانًا، واختر الباقة حسب عدد طلابك وعدد المذكرات التي تريد رفعها بالذكاء الاصطناعي."
              : "Start free, then pick a plan by your student count and AI uploads."}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div className="flex rounded-full border border-border bg-card p-1">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                  (period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {p === "monthly" ? (ar ? "شهري" : "Monthly") : ar ? "سنوي — وفّر شهرين" : "Yearly — 2 months free"}
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-border bg-card p-1">
            {CURRENCIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCurrency(c.id)}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                  (currency === c.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {c[ar ? "ar" : "en"]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const price = period === "yearly" ? plan.price[currency] * 10 : plan.price[currency];
            return (
              <article
                key={plan.id}
                className={
                  "relative flex flex-col p-6 " +
                  (plan.popular ? "surface ring-2 ring-primary" : "surface")
                }
              >
                {plan.popular && (
                  <span className="absolute -top-3 start-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    {ar ? "الأكثر اختيارًا" : "Most popular"}
                  </span>
                )}
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <plan.icon className="size-5" />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold">{plan[ar ? "ar" : "en"].name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan[ar ? "ar" : "en"].blurb}</p>
                <p className="mt-4 flex items-baseline gap-1" dir="ltr">
                  <span className="font-display text-3xl font-extrabold">{price}</span>
                  <span className="text-sm text-muted-foreground">
                    {symbol} / {period === "yearly" ? (ar ? "سنة" : "year") : ar ? "شهر" : "month"}
                  </span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {plan[ar ? "ar" : "en"].features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={plan.popular ? "default" : "outline"}>
                  <Link to="/auth">{plan[ar ? "ar" : "en"].cta}</Link>
                </Button>
              </article>
            );
          })}
        </div>

        <section className="surface mt-10 p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">
            {ar ? "إذا خلص رصيد الذكاء الاصطناعي" : "If your AI credit runs out"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {ar
              ? "كل باقة تشمل رصيد ملفات شهري للذكاء الاصطناعي. لو خلص خلال الشهر، يظل كل الطلاب يحلون ويظهر لهم النتائج والتقارير بشكل طبيعي، ويمكنك شراء رصيد إضافي فقط إذا أردت رفع مذكرات جديدة."
              : "Each plan includes a monthly AI upload allowance. If it runs out, students keep solving and reports keep working normally — buy extra credits only when you want new uploads."}
          </p>
          <p className="mt-3 text-sm font-medium" dir={ar ? "rtl" : "ltr"}>
            {ar ? "رصيد إضافي: " : "Extra credit: "}
            {ADDONS[currency][ar ? "ar" : "en"]}
          </p>
        </section>

        <div className="mt-10 text-center">
          <Button asChild size="lg">
            <Link to="/auth">{ar ? "ابدأ الآن مجانًا" : "Get started free"}</Link>
          </Button>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        {ar ? "سمارت كلاس — تعليم مبني على الأدلة" : "SmartClass — evidence-based teaching"}
      </footer>
    </div>
  );
}
