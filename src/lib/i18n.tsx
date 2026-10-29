import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translateUi } from "./ui-translations";
import { localizeMessage } from "./localized-messages";

export type Locale = "ar" | "en";

const STORAGE_KEY = "smartclass.locale";

const dict = {
  "app.name": { ar: "سمارت كلاس", en: "SmartClass" },
  "app.tagline": {
    ar: "منصة تعليمية تبني المنهج من ملفاتك بالذكاء الاصطناعي",
    en: "An AI platform that builds your curriculum from your own files",
  },
  "nav.signIn": { ar: "تسجيل الدخول", en: "Sign in" },
  "nav.dashboard": { ar: "لوحتي", en: "My dashboard" },
  "nav.signOut": { ar: "تسجيل الخروج", en: "Sign out" },
  "nav.language": { ar: "English", en: "العربية" },

  "role.teacher": { ar: "معلم", en: "Teacher" },
  "role.student": { ar: "طالب", en: "Student" },
  "role.parent": { ar: "ولي أمر", en: "Parent" },
  "role.admin": { ar: "مشرف", en: "Admin" },

  "auth.signInTitle": { ar: "مرحبًا بعودتك", en: "Welcome back" },
  "auth.signUpTitle": { ar: "أنشئ حسابك", en: "Create your account" },
  "auth.email": { ar: "البريد الإلكتروني", en: "Email" },
  "auth.password": { ar: "كلمة المرور", en: "Password" },
  "auth.fullName": { ar: "الاسم الكامل", en: "Full name" },
  "auth.role": { ar: "أنا", en: "I am a" },
  "auth.signIn": { ar: "دخول", en: "Sign in" },
  "auth.signUp": { ar: "إنشاء حساب", en: "Create account" },
  "auth.google": { ar: "المتابعة بحساب Google", en: "Continue with Google" },
  "auth.toSignUp": { ar: "ليس لديك حساب؟ أنشئ واحدًا", en: "No account? Create one" },
  "auth.toSignIn": { ar: "لديك حساب؟ سجّل الدخول", en: "Have an account? Sign in" },
  "auth.or": { ar: "أو", en: "or" },
  "auth.checkEmail": {
    ar: "أرسلنا رابط تأكيد إلى بريدك. افتحه لإكمال التسجيل.",
    en: "We sent a confirmation link to your email.",
  },

  "common.loading": { ar: "جارٍ التحميل…", en: "Loading…" },
  "common.save": { ar: "حفظ", en: "Save" },
  "common.cancel": { ar: "إلغاء", en: "Cancel" },
  "common.create": { ar: "إنشاء", en: "Create" },
  "common.back": { ar: "رجوع", en: "Back" },
  "common.empty": { ar: "لا يوجد شيء بعد", en: "Nothing here yet" },
} as const;

export type TranslationKey = keyof typeof dict;

type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey) => string;
  tr: (text: string, ...values: (string | number)[]) => string;
  message: (text: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") setLocaleState(stored);
  }, []);

  const dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir,
      setLocale,
      toggleLocale: () => setLocale(locale === "ar" ? "en" : "ar"),
      t: (key) => dict[key]?.[locale] ?? key,
      tr: (text, ...values) => translateUi(locale, text, ...values),
      message: (text) => localizeMessage(locale, text),
    }),
    [locale, dir, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
