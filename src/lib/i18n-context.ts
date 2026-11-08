import { createContext, type Context } from "react";

export type Locale = "ar" | "en";
export type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string) => string;
  tr: (text: string, ...values: (string | number)[]) => string;
  message: (text: string) => string;
};

// Keep provider and consumers on the same context when translation modules
// are replaced while a preview is open. No state is shared between SSR users.
const retainedContext = import.meta.hot?.data?.i18nContext as Context<I18nValue | null> | undefined;
export const I18nContext = retainedContext ?? createContext<I18nValue | null>(null);
if (import.meta.hot?.data) {
  import.meta.hot.data.i18nContext = I18nContext;
}