import { useRouter } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function BackButton({ className = "" }: { className?: string }) {
  const { tr } = useI18n();
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };
  return (
    <Button variant="ghost" size="sm" onClick={goBack} aria-label={tr("رجوع")} className={className}>
      <ArrowRight className="size-4 ltr:rotate-180" />
      <span className="hidden sm:inline">{tr("رجوع")}</span>
    </Button>
  );
}
