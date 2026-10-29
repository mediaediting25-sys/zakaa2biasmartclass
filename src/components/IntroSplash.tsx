import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import introVideo from "@/assets/intro.mp4.asset.json";

export function IntroSplash() {
  const { tr } = useI18n();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("intro-seen")) setShow(true);
  }, []);

  const close = () => {
    sessionStorage.setItem("intro-seen", "1");
    setLeaving(true);
    setTimeout(() => setShow(false), 500);
  };

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(close, 6000); // safety fallback
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      <video
        src={introVideo.url}
        autoPlay
        muted
        playsInline
        onEnded={close}
        onError={close}
        className="h-full w-full object-contain"
      />
      <Button variant="ghost"
        onClick={close}
        className="absolute top-4 left-4 rounded-full bg-card px-4 py-1.5 text-sm text-foreground opacity-80 hover:opacity-100"
      >
        {tr("تخطي")}
      </Button>
    </div>
  );
}
