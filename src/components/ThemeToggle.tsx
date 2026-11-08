import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle() {
  const { tr } = useI18n();
  const [light, setLight] = useState(false);
  useEffect(() => {
    const sync = () => setLight(document.documentElement.dataset["palette"] === "light");
    sync();
    window.addEventListener("palette-change", sync);
    return () => window.removeEventListener("palette-change", sync);
  }, []);
  const label = tr(light ? "الألوان الداكنة — 1" : "الألوان الفاتحة — 2");
  return <Button size="icon" variant="ghost" title={label} aria-label={label} onClick={() => {
    const next = light ? "dark" : "light";
    document.documentElement.dataset["palette"] = next;
    try { localStorage.setItem("smartclass.palette", next); } catch { /* Session choice still works. */ }
    window.dispatchEvent(new Event("palette-change"));
  }}>{light ? <Moon className="size-4" /> : <Sun className="size-4" />}</Button>;
}