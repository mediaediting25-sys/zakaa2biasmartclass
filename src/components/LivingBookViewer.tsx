import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, List, Maximize, Minimize, Moon, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n";
import type { LessonSlide } from "@/lib/lesson-tools";
import type { BookShape, LivingBook } from "@/lib/living-book";

function Shape({ shape }: { shape: BookShape }) {
  const { x, y, width, height, radius, path } = shape;
  const props = { className: `book-shape book-color-${shape.color}` };
  switch (shape.kind) {
    case "path": return <path {...props} d={path} />;
    case "circle": return <circle {...props} cx={x} cy={y} r={radius} />;
    case "ellipse": return <ellipse {...props} cx={x} cy={y} rx={width} ry={height} />;
    case "rect": return <rect {...props} x={x} y={y} width={width} height={height} rx={radius} />;
    case "line": return <line {...props} x1={x} y1={y} x2={width} y2={height} />;
  }
}

function BookScene({ book }: { book: LivingBook }) {
  const { tr } = useI18n();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const active = book.steps[step];
  const layer = book.layers.find(item => item.id === selected);
  return <div className="book-experiment">
    <div className="book-run"><span>{tr("تجربة حيّة")}</span><span>{step + 1} / {book.steps.length}</span></div>
    <figure className="book-figure">
      <svg viewBox="0 0 600 400" role="img" aria-label={book.caption}>
        <title>{book.caption}</title>
        {book.layers.map(item => <g key={item.id} className={`book-layer ${active?.visibleIds.includes(item.id) ? "is-visible" : ""} ${selected === item.id ? "is-selected" : ""}`}>
          {item.shapes.map((shape, index) => <Shape key={index} shape={shape} />)}
        </g>)}
      </svg>
      <figcaption>{book.caption}</figcaption>
    </figure>
    <div className="book-chips">{book.layers.map(item => <Button key={item.id} variant="outline" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</Button>)}</div>
    <div className="book-note" aria-live="polite"><strong>{layer?.label ?? active?.title}</strong><p>{layer?.description ?? active?.description}</p></div>
    <Slider aria-label={tr("مراحل التجربة")} min={0} max={book.steps.length - 1} step={1} value={[step]} onValueChange={value => { setStep(value[0] ?? 0); setSelected(null); }} />
    <div className="book-chips">{book.steps.map((item, index) => <Button key={index} variant="outline" aria-pressed={step === index} onClick={() => { setStep(index); setSelected(null); }}>{item.title}</Button>)}</div>
    <Button variant="outline" size="icon" title={tr("ابدأ من جديد")} aria-label={tr("ابدأ من جديد")} onClick={() => { setStep(0); setSelected(null); }}><RotateCcw className="size-4" /></Button>
  </div>;
}

function Prediction({ slide, answer, onAnswer }: { slide: LessonSlide; answer: string | undefined; onAnswer: (value: string) => void }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  if (!slide.challenge) return null;
  return <section className="book-predict">
    <h3>{tr("توقّع ثم اكتشف")}</h3><p>{slide.challenge}</p>
    <div className="book-options">{slide.options.map(option => <Button key={option} variant="outline" aria-pressed={answer === option} className={answer === option ? (option === slide.correctAnswer ? "book-correct" : "book-incorrect") : ""} onClick={() => { onAnswer(option); setOpen(false); }}>{option}</Button>)}</div>
    <Button variant="outline" className={`book-flap ${open ? "is-open" : ""}`} disabled={!answer} aria-expanded={open} onClick={() => setOpen(!open)}>{tr("اكشف الإجابة")}</Button>
    {open && <div className="book-note" role="status"><strong>{answer === slide.correctAnswer ? "✓" : "✗"} {slide.correctAnswer}</strong><p>{slide.explanation}</p></div>}
  </section>;
}

function WordCards({ cards }: { cards: LivingBook["cards"] }) {
  const { tr } = useI18n();
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const card = cards[index];
  return <div className="book-words">
    <Button variant="outline" className={`book-flashcard ${flip ? "is-flipped" : ""}`} aria-label={tr("اقلب البطاقة")} aria-pressed={flip} onClick={() => setFlip(!flip)}>{flip ? card?.back : card?.front}</Button>
    <div className="book-chips">{cards.map((item, i) => <Button key={i} variant="outline" aria-pressed={index === i} onClick={() => { setIndex(i); setFlip(false); }}>{item.front} {known.has(i) ? "✓" : ""}</Button>)}</div>
    <div className="book-chips"><Button variant="outline" onClick={() => { setKnown(new Set([...known, index])); setIndex((index + 1) % cards.length); setFlip(false); }}>{tr("عرفتها ✓")}</Button><span>{known.size} / {cards.length}</span></div>
  </div>;
}

function WordBank({ blanks }: { blanks: LivingBook["blanks"] }) {
  const { tr } = useI18n();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  return <div className="book-wordbank">{blanks.map((blank, i) => <section key={i} className="book-blank">
    <p>{blank.sentence.split("___")[0]} <strong className={checked ? (answers[i] === blank.answer ? "book-correct" : "book-incorrect") : ""}>{answers[i] ?? "___"}</strong> {blank.sentence.split("___")[1]}</p>
    <div className="book-chips">{blank.options.map(option => <Button key={option} variant="outline" aria-pressed={answers[i] === option} onClick={() => { setAnswers({ ...answers, [i]: option }); setChecked(false); }}>{option}</Button>)}</div>
    {checked && <p role="status">{answers[i] === blank.answer ? "✓" : "✗"} {blank.answer} · {blank.explanation}</p>}
  </section>)}<div className="book-chips"><Button onClick={() => setChecked(true)} disabled={Object.keys(answers).length < blanks.length}>{tr("تحقق")}</Button><Button variant="outline" onClick={() => { setAnswers({}); setChecked(false); }}><RotateCcw className="size-4" />{tr("ابدأ من جديد")}</Button></div></div>;
}

export function LivingBookViewer({ title, slides, dir, onClose }: { title: string; slides: LessonSlide[]; dir: "rtl" | "ltr"; onClose: () => void }) {
  const { tr } = useI18n();
  const [index, setIndex] = useState(0);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);
  const [full, setFull] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cards = slides.flatMap(slide => slide.livingBook?.cards ?? []);
  const blanks = slides.flatMap(slide => slide.livingBook?.blanks ?? []);
  const sections = [...slides.map(slide => slide.title), ...(cards.length ? [tr("كلمات الدرس")] : []), ...(blanks.length ? [tr("العب واختبر نفسك")] : [])];
  const slide = slides[index];
  const go = (next: number) => { setIndex(Math.max(0, Math.min(sections.length - 1, next))); setMenu(false); panel.current?.querySelector(".book-scroll")?.scrollTo(0, 0); };
  useEffect(() => {
    const before = document.title;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.title = before; document.body.style.overflow = old; };
  }, []);
  useEffect(() => { document.title = `${index + 1}/${sections.length} — ${title}`; }, [index, sections.length, title]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input, textarea, [role=slider]")) return;
      if (event.key === "ArrowRight") go(index + (dir === "rtl" ? -1 : 1));
      if (event.key === "ArrowLeft") go(index + (dir === "rtl" ? 1 : -1));
    };
    const changed = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("keydown", listener);
    document.addEventListener("fullscreenchange", changed);
    return () => { document.removeEventListener("keydown", listener); document.removeEventListener("fullscreenchange", changed); };
  }, [index, sections.length, dir]);
  const toggleFull = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await panel.current?.requestFullscreen().catch(() => setFull(false));
  };
  const completed = slides.filter((item, i) => item.challenge && answers[i] === item.correctAnswer).length;
  const total = slides.filter(item => item.challenge).length;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent ref={panel} className="living-book-viewer" data-book-theme={dark ? "dark" : "light"} dir={dir} aria-describedby={undefined}>
    <header className="book-toolbar"><BookOpen className="size-5" /><DialogTitle>{title}</DialogTitle><span className="book-label">{tr("الكتاب الحي")}</span></header>
    <div className="book-scroll" onTouchStart={event => { const touch = event.touches[0]; if (touch) start.current = { x: touch.clientX, y: touch.clientY }; }} onTouchEnd={event => { const touch = event.changedTouches[0]; const origin = start.current; start.current = null; if (!touch || !origin || (event.target as HTMLElement).closest("button, [role=slider]")) return; const dx = touch.clientX - origin.x; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(touch.clientY - origin.y) * 1.5) go(index + (dx < 0 ? 1 : -1)); }}>
      <main className="living-book-spread" key={index}>
        <section className="book-page book-text">
          <div className="book-run"><span>{tr("الكتاب الحي")}</span><span>{index + 1} / {sections.length}</span></div>
          <h2>{sections[index]}</h2>
          {slide ? <><div className="book-definition"><p>{slide.narrative}</p></div><ul className="book-points">{slide.points.map((point, i) => <li key={i}>{point}</li>)}</ul><Prediction slide={slide} answer={answers[index]} onAnswer={value => setAnswers({ ...answers, [index]: value })} /><footer className="book-source">{tr("المصدر ص")} {slide.sourcePage}: «{slide.sourceQuote}»</footer></> : <>
            <div className="book-score"><strong>{completed} / {total}</strong><span>{tr("إجابات صحيحة")}</span></div>
            {cards.length > 0 && index === slides.length ? <ul className="book-points">{cards.map((card, i) => <li key={i}>{card.front}</li>)}</ul> : null}
          </>}
        </section>
        <section className="book-page book-live">
          {slide?.livingBook ? <BookScene book={slide.livingBook} /> : slide ? <div className="book-note"><h3>{slide.title}</h3><ul className="book-points">{slide.points.map((point, i) => <li key={i}>{point}</li>)}</ul></div> : cards.length > 0 && index === slides.length ? <WordCards cards={cards} /> : <WordBank blanks={blanks} />}
        </section>
      </main>
    </div>
    <nav className="book-pager" aria-label={tr("قائمة الأقسام")}>
      <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} title={tr("تبديل الوضع الفاتح والداكن")} aria-label={tr("تبديل الوضع الفاتح والداكن")}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button>
      <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => go(index - 1)} aria-label={tr("السابق")}><ChevronRight className="size-5 ltr:rotate-180" /></Button>
      <span className="book-pager-title">{index + 1} · {sections[index]}</span>
      <Button variant="ghost" size="icon" disabled={index >= sections.length - 1} onClick={() => go(index + 1)} aria-label={tr("التالي")}><ChevronLeft className="size-5 ltr:rotate-180" /></Button>
      <Button variant="ghost" size="icon" onClick={() => setMenu(!menu)} aria-expanded={menu} title={tr("قائمة الأقسام")} aria-label={tr("قائمة الأقسام")}><List className="size-5" /></Button>
      <Button variant="ghost" size="icon" onClick={toggleFull} title={tr("ملء الشاشة")} aria-label={tr("ملء الشاشة")}>{full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}</Button>
      {menu && <div className="book-section-menu">{sections.map((section, i) => <Button key={i} variant="ghost" aria-current={index === i ? "page" : undefined} onClick={() => go(i)}>{i + 1} · {section}</Button>)}</div>}
    </nav>
  </DialogContent></Dialog>;
}
