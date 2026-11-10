import { useEffect, useState } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type Palette = "dark" | "light" | "cyber";
const palettes: Palette[] = ["dark", "light", "cyber"];

export function ThemeToggle() {
  const { tr } = useI18n();
  const [palette, setPalette] = useState<Palette>("cyber");

  useEffect(() => {
    const sync = () => {
      const current = document.documentElement.dataset["palette"];
      setPalette(current === "dark" || current === "light" ? current : "cyber");
    };
    sync();
    window.addEventListener("palette-change", sync);
    return () => window.removeEventListener("palette-change", sync);
  }, []);

  const names: Record<Palette, string> = {
    dark: tr("الألوان الداكنة — 1"),
    light: tr("الألوان الفاتحة — 2"),
    cyber: tr("الاستايل السياني — 3"),
  };
  const label = `${tr("تغيير التصميم")}: ${names[palette]}`;
  const Icon = palette === "dark" ? Moon : palette === "light" ? Sun : Sparkles;

  return (
    <Button
      size="icon"
      variant="ghost"
      title={label}
      aria-label={label}
      onClick={() => {
        const next = palettes[(palettes.indexOf(palette) + 1) % palettes.length] ?? "cyber";
        document.documentElement.dataset["palette"] = next;
        try { localStorage.setItem("smartclass.palette", next); } catch { /* Session choice still works. */ }
        window.dispatchEvent(new Event("palette-change"));
      }}
    >
      <Icon className="size-4" />
    </Button>
  );
}
