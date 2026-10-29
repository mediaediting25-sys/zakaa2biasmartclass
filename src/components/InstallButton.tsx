import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallButton({ className = "" }: { className?: string }) {
  const { tr } = useI18n();
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (evt) {
      await evt.prompt();
      await evt.userChoice;
      setEvt(null);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(
      ios
        ? tr("على آيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»")
        : tr("من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»"),
      { duration: 8000 },
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={install} aria-label={tr("ثبّت التطبيق")} className={className}>
      <Download className="size-4" />
      <span className="hidden sm:inline">{tr("ثبّت التطبيق")}</span>
    </Button>
  );
}
