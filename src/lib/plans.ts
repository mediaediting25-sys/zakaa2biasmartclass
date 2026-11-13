import { Crown, Rocket, Sparkles, Users } from "lucide-react";

export const PLANS = [
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

