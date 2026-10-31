import { Download } from "lucide-react";
import { useInstallPrompt } from "@/components/InstallPromptProvider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function InstallButton({ className = "" }: { className?: string }) {
  const { tr } = useI18n();
  const { installed, openInstall } = useInstallPrompt();
  if (installed) return null;
  return (
    <Button variant="ghost" size="sm" onClick={openInstall} aria-label={tr("ثبّت التطبيق")} className={className}>
      <Download className="size-4" />
      <span className="hidden sm:inline">{tr("ثبّت التطبيق")}</span>
    </Button>
  );
}
