import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { publicPlatformOptions } from "@/lib/platform";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/news")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicPlatformOptions),
  head: () => ({ meta: [
    { title: "أخبار التعليم والتحديثات — ذكاؤبيا سمارت كلاس" },
    { name: "description", content: "أخبار التدريس والتعليم وآخر تحديثات منصة ذكاؤبيا سمارت كلاس." },
    { property: "og:title", content: "الأخبار والتحديثات — ذكاؤبيا سمارت كلاس" },
    { property: "og:description", content: "تابع أخبار التعليم وتحديثات أدوات المعلم والطالب في ذكاؤبيا سمارت كلاس." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: NewsPage,
});

function NewsPage() {
  const { locale, tr } = useI18n();
  const { data } = useSuspenseQuery(publicPlatformOptions);
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-4xl px-4 py-12">
    <h1 className="mb-8 text-3xl font-bold">{tr("الأخبار والتحديثات")}</h1>
    {!data.news.length && <p className="text-muted-foreground">{tr("لا توجد أخبار منشورة حاليًا")}</p>}
    <div className="space-y-8">{data.news.map(n => <article key={n.id} className="border-b border-border pb-8">
      <span className="text-sm text-primary">{tr(n.category === "update" ? "تحديثات المنصة" : "أخبار التعليم")}</span>
      <h2 className="mt-2 break-words text-2xl font-bold">{locale === "ar" ? n.title_ar : n.title_en || n.title_ar}</h2>
      <time className="mt-2 block text-sm text-muted-foreground" dateTime={n.created_at}>{new Date(n.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { timeZone: "UTC" })}</time>
      <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed">{locale === "ar" ? n.body_ar : n.body_en || n.body_ar}</p>
    </article>)}</div>
  </main></div>;
}