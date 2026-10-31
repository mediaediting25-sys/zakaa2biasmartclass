import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { installPlatform } from "@/lib/install-platform";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const InstallContext = createContext({ installed: false, openInstall: () => {} });
export const useInstallPrompt = () => useContext(InstallContext);

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const { tr, t, dir } = useI18n();
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [platform, setPlatform] = useState({ ios: false, mobile: false, embedded: false });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    const detected = installPlatform(navigator.userAgent, navigator.maxTouchPoints);
    setPlatform(detected);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const alreadyInstalled = displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(alreadyInstalled);
    try { dismissed.current = sessionStorage.getItem("smartclass.install-dismissed") === "1"; } catch { /* Storage may be blocked. */ }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as PromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setOpen(false); setPromptEvent(null); };
    const onDisplayMode = () => { if (displayMode.matches) onInstalled(); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayMode.addEventListener("change", onDisplayMode);
    // Wait until the opening video has finished, even if playback fails.
    const timer = window.setTimeout(() => {
      if (detected.mobile && !alreadyInstalled && !dismissed.current && !displayMode.matches) setOpen(true);
    }, 9000);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode.removeEventListener("change", onDisplayMode);
    };
  }, []);

  function close() {
    setOpen(false);
    dismissed.current = true;
    try { sessionStorage.setItem("smartclass.install-dismissed", "1"); } catch { /* Keep dismissal in memory. */ }
  }

  async function install() {
    if (!promptEvent || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      // Only appinstalled/display-mode can confirm installation.
      if (choice.outcome === "accepted") close();
    } catch {
      setPromptEvent(null);
      setFailed(true);
    } finally { setBusy(false); }
  }

  const direct = promptEvent && !platform.embedded;
  return (
    <InstallContext.Provider value={{ installed, openInstall: () => { setFailed(false); setOpen(true); } }}>
      {children}
      <Dialog open={open && !installed} onOpenChange={(next) => { if (!next) close(); }}>
        <DialogContent dir={dir} className="install-prompt rounded-lg bg-card text-card-foreground">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="" className="size-14 rounded-lg" />
            <DialogTitle className="text-start leading-relaxed">{tr("أضف سمارت كلاس على موبايلك")}</DialogTitle>
          </div>
          <DialogDescription className="text-start">{t("app.name")}</DialogDescription>
          {failed && <p role="status" className="text-sm text-muted-foreground">{tr("تعذّر فتح نافذة التثبيت. استخدم قائمة المتصفح للإضافة.")}</p>}
          {direct ? (
            <Button className="w-full btn-motion" onClick={install} disabled={busy}>
              <Download className="size-4" />{tr(busy ? "جارٍ فتح التثبيت…" : "ثبّت التطبيق")}
            </Button>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed">
              {platform.embedded ? <p className="flex gap-2"><Smartphone className="mt-1 size-4 shrink-0 text-primary" />{tr("افتح الرابط في Safari على آيفون أو Chrome على أندرويد، ثم أضفه للشاشة الرئيسية.")}</p>
                : platform.ios ? <p className="flex gap-2"><Share className="mt-1 size-4 shrink-0 text-primary" />{tr("اضغط المشاركة ثم «إضافة إلى الشاشة الرئيسية» ثم «إضافة». لو الخيار مش ظاهر، افتح الرابط في Safari.")}</p>
                : <p className="flex gap-2"><Smartphone className="mt-1 size-4 shrink-0 text-primary" />{tr("من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». لو الخيار مش موجود، افتح الرابط في Chrome؛ بعض المتصفحات تضيف اختصارًا فقط.")}</p>}
            </div>
          )}
          <Button variant="ghost" onClick={close}>{tr("ليس الآن")}</Button>
        </DialogContent>
      </Dialog>
    </InstallContext.Provider>
  );
}