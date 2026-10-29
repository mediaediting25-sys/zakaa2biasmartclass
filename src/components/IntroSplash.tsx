import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import portrait from "@/assets/splash-portrait.mp4.asset.json";
import landscape from "@/assets/splash-landscape.mp4.asset.json";

export function IntroSplash() {
  const { tr } = useI18n();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("intro-seen")) return;
    const isPortrait = window.matchMedia("(orientation: portrait)").matches;
    setSrc(isPortrait ? portrait.url : landscape.url);
    setShow(true);
  }, []);

  const close = () => {
    sessionStorage.setItem("intro-seen", "1");
    setLeaving(true);
    setTimeout(() => setShow(false), 500);
  };

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(close, 8000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show || !src) return null;
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <video src={src} autoPlay muted playsInline onEnded={close} onError={close} className="h-full w-full object-cover" />
      <Button
        variant="ghost"
        onClick={close}
        className="absolute top-4 left-4 rounded-full bg-card px-4 py-1.5 text-sm text-foreground opacity-80 hover:opacity-100"
      >
        {tr("تخطي")}
      </Button>
    </div>
  );
}
