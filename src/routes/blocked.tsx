import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/blocked")({
  head: () => ({
    meta: [
      { title: "الحساب محظور — ذكاؤبيا سمارت كلاس" },
      { name: "description", content: "هذا الحساب محظور من استخدام ذكاؤبيا سمارت كلاس." },
      { property: "og:title", content: "الحساب محظور — ذكاؤبيا سمارت كلاس" },
      { property: "og:description", content: "تم إيقاف وصول هذا الحساب إلى المنصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BlockedPage,
});

function BlockedPage() {
  const { tr } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="surface w-full max-w-md p-8 text-center">
        <ShieldX className="mx-auto size-12 text-destructive" aria-hidden="true" />
        <h1 className="mt-5 font-display text-2xl font-bold">{tr("هذا الحساب محظور")}</h1>
        <p className="mt-3 text-muted-foreground">{tr("تم إيقاف وصولك إلى المنصة. تواصل مع إدارة المنصة إذا كنت تعتقد أن ذلك خطأ.")}</p>
        <Button className="mt-6" variant="outline" onClick={signOut}>{tr("تسجيل الخروج")}</Button>
      </section>
    </main>
  );
}
