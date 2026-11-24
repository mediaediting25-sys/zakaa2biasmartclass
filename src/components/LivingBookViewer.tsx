import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, List, Maximize, Minimize, Moon, RotateCcw, Sun, Play, Shuffle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/lib/i18n";
import type { LessonSlide } from "@/lib/lesson-tools";
import { resolveBookExperiment, type BookShape, type LivingBook } from "@/lib/living-book";

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

function BookScene({ book, selected, onSelect }: { book: LivingBook; selected: string | null; onSelect: (id: string | null) => void }) {
  const { tr } = useI18n();
  const [step, setStep] = useState(0);
  const [tool, setTool] = useState<string | null>(book.tools?.[0]?.id ?? null);
  const [run, setRun] = useState<{ step: number; tool: string | null } | null>(null);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const result = resolveBookExperiment(book, run?.step ?? 0, run?.tool ?? null);
  const layer = book.layers.find(item => item.id === selected);
  const visible = run ? result.visibleIds : book.steps[0]?.visibleIds ?? [];
  const meters = [{ label: tr("عناصر ظاهرة"), value: visible.length, max: book.layers.length }, { label: tr("مراحل مكتشفة"), value: visited.size, max: book.steps.length }, { label: tr("عناصر المشهد"), value: book.layers.length, max: book.layers.length }];
  return <div className="book-experiment">
    <div className="book-run"><span>{tr("تجربة حيّة")}</span><span>{step + 1} / {book.steps.length}</span></div>
    <div className="book-tubes" aria-live="polite">{meters.map((meter, i) => <div className={`book-tube book-tube-${i}`} key={meter.label}><div className="book-glass"><svg viewBox="0 0 30 80" aria-hidden="true"><rect x="0" y={80 - 80 * meter.value / meter.max} width="30" height={80 * meter.value / meter.max} /></svg></div><b>{meter.value} / {meter.max}</b><span>{meter.label}</span></div>)}</div>
    <figure className="book-figure">
      <svg viewBox="0 0 600 400" role="img" aria-label={book.caption}>
        <title>{book.caption}</title>
        {book.layers.map(item => <g key={item.id} className={`book-layer ${visible.includes(item.id) ? "is-visible" : ""} ${selected === item.id ? "is-selected" : ""}`}>
          {item.shapes.map((shape, index) => <Shape key={index} shape={shape} />)}
        </g>)}
      </svg>
      <figcaption>{book.caption}</figcaption>
    </figure>
    <div className="book-chips">{(book.tools ?? []).map(item => <Button key={item.id} variant="outline" aria-pressed={tool === item.id} title={item.description} onClick={() => { setTool(item.id); onSelect(null); }}>{item.label}</Button>)}</div>
    <Slider aria-label={tr("مراحل التجربة")} min={0} max={book.steps.length - 1} step={1} value={[step]} onValueChange={value => { setStep(value[0] ?? 0); onSelect(null); }} />
    <div className="book-chips">{book.steps.map((item, index) => <Button key={index} variant="outline" aria-pressed={step === index} onClick={() => { setStep(index); onSelect(null); }}>{item.title}</Button>)}</div>
    <div className="book-chips"><Button onClick={() => { setRun({ step, tool }); setVisited(new Set([...visited, step])); onSelect(null); }}><Play className="size-4" />{tr("أطلق التجربة")}</Button><Button variant="outline" onClick={() => { setStep(0); setRun(null); setVisited(new Set()); setTool(book.tools?.[0]?.id ?? null); onSelect(null); }}><RotateCcw className="size-4" />{tr("ابدأ من جديد")}</Button></div>
    <div className="book-note" aria-live="polite"><strong>{layer?.label ?? (run ? result.title : book.steps[step]?.title)}</strong><p>{layer?.description ?? (run ? result.description : book.steps[step]?.description)}</p></div>
    <aside className="book-hand"><span>{tr("ملاحظات المستكشف")}</span><b>{book.tools?.find(item => item.id === tool)?.label ?? book.steps[step]?.title}</b><span>{tr("عناصر ظاهرة")}: {visible.length} / {book.layers.length}</span></aside>
  </div>;
}

function Prediction({ slide, answer, onAnswer, onTry }: { slide: LessonSlide; answer: string | undefined; onAnswer: (value: string) => void; onTry: () => void }) {
  const { tr } = useI18n();
  const [open, setOpen] = useState(false);
  if (!slide.challenge) return null;
  return <section className="book-predict">
    <h3>{tr("توقّع قبل أن تجرّب")}</h3><p>{slide.challenge}</p>
    <div className="book-options">{slide.options.map(option => <Button key={option} variant="outline" disabled={open} aria-pressed={answer === option} className={open ? (option === slide.correctAnswer ? "book-correct" : answer === option ? "book-incorrect" : "") : ""} onClick={() => onAnswer(option)}><span className="book-radio">{answer === option ? "●" : "○"}</span>{option}</Button>)}</div>
    <div className={`book-flap-wrap ${open ? "is-open" : ""}`}>
      <div className="book-flap-answer" aria-hidden={!open}>{open && <><strong>{answer === slide.correctAnswer ? "✓" : "✗"} {slide.correctAnswer}</strong><p>{slide.explanation}</p><Button variant="outline" onClick={onTry}><FlaskConical className="size-4" />{tr("جرّب بنفسك")}</Button></>}</div>
      <Button variant="outline" className="book-flap" disabled={!answer || open} aria-expanded={open} onClick={() => setOpen(true)}><span>{tr("ارفع هنا")}</span><strong>{tr("ارفع الورقة لترى الإجابة")}</strong><small>{tr("بعد أن تسجّل توقعك")}</small></Button>
    </div>
  </section>;
}

function WordCards({ cards }: { cards: LivingBook["cards"] }) {
  const { tr } = useI18n();
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const card = cards[index];
  const go = (i: number) => { setIndex((i + cards.length) % cards.length); setFlip(false); };
  return <div className="book-words">
    <Button variant="outline" className={`book-flashcard ${flip ? "is-flipped" : ""}`} aria-label={tr("اقلب البطاقة")} aria-pressed={flip} onClick={() => setFlip(!flip)}><span className="book-flash-front">{card?.front}</span><span className="book-flash-back">{card?.back}</span></Button>
    <div className="book-chips"><Button variant="outline" size="icon" aria-label={tr("السابق")} onClick={() => go(index - 1)}><ChevronRight className="size-4" /></Button><span>{index + 1} / {cards.length}</span><Button variant="outline" size="icon" aria-label={tr("التالي")} onClick={() => go(index + 1)}><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" aria-label={tr("اخلط البطاقات")} title={tr("اخلط البطاقات")} onClick={() => go(index + 1 + Math.floor(Math.random() * Math.max(1, cards.length - 1)))}><Shuffle className="size-4" /></Button></div>
    <div className="book-chips"><Button variant="outline" aria-pressed={known.has(index)} onClick={() => { const next = new Set(known); if (next.has(index)) next.delete(index); else next.add(index); setKnown(next); }}>{tr("عرفتها ✓")}</Button><span>{known.size} / {cards.length}</span></div>
    <div className="book-chips">{cards.map((item, i) => <Button key={i} variant="outline" aria-pressed={index === i} onClick={() => go(i)}>{item.front} {known.has(i) ? "✓" : ""}</Button>)}</div>
  </div>;
}

function WordBank({ blanks }: { blanks: LivingBook["blanks"] }) {
  const { tr } = useI18n();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [active, setActive] = useState(0);
  const [checked, setChecked] = useState(false);
  const words = [...new Set(blanks.flatMap(blank => blank.options))];
  const fill = (word: string) => { const next = { ...answers, [active]: word }; setAnswers(next); setChecked(false); const empty = blanks.findIndex((_, i) => !next[i]); if (empty >= 0) setActive(empty); };
  return <div className="book-wordbank">{blanks.map((blank, i) => <section key={i} className="book-blank">
    <p>{blank.sentence.split("___")[0]} <Button variant="outline" aria-label={tr("الفراغ {0}", i + 1)} aria-pressed={active === i} className={checked ? (answers[i] === blank.answer ? "book-correct" : "book-incorrect") : ""} onClick={() => { const next = { ...answers }; delete next[i]; setAnswers(next); setActive(i); setChecked(false); }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const word = event.dataTransfer.getData("text/plain"); if (!words.includes(word)) return; setAnswers({ ...answers, [i]: word }); setChecked(false); }}>{answers[i] ?? "___"}</Button> {blank.sentence.split("___")[1]}</p>
    {checked && <p role="status">{answers[i] === blank.answer ? "✓" : "✗"} {blank.answer} · {blank.explanation}</p>}
  </section>)}<div className="book-chips book-bank">{words.map(word => <Button variant="outline" key={word} draggable onDragStart={event => event.dataTransfer.setData("text/plain", word)} onClick={() => fill(word)}>{word}</Button>)}</div><div className="book-chips"><Button onClick={() => setChecked(true)} disabled={Object.keys(answers).length < blanks.length}>{tr("تحقق")}</Button><Button variant="outline" onClick={() => { setAnswers({}); setChecked(false); setActive(0); }}><RotateCcw className="size-4" />{tr("ابدأ من جديد")}</Button></div>{checked && <p role="status">{tr("إجابات صحيحة")}: {blanks.filter((blank, i) => answers[i] === blank.answer).length} / {blanks.length}</p>}</div>;
}

function Exercises({ slides, onTry }: { slides: LessonSlide[]; onTry: (index: number) => void }) {
  const { tr } = useI18n();
  const questions = slides.map((slide, index) => ({ slide, index })).filter(item => item.slide.challenge);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const item = questions[index];
  if (!item) return null;
  const score = questions.filter((question, i) => answers[i] === question.slide.correctAnswer).length;
  return <div className="book-exercises"><div className="book-score"><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="book-ring-track" cx="50" cy="50" r="42" /><circle className="book-ring-value" cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${100 * score / questions.length} 100`} /></svg><strong>{score} / {questions.length}</strong><span>{tr("إجابات صحيحة")}</span></div>
    <div className="book-chips">{questions.map((question, i) => <Button variant="outline" key={i} aria-label={tr("السؤال {0}", i + 1)} aria-pressed={index === i} className={answers[i] ? answers[i] === question.slide.correctAnswer ? "book-correct" : "book-incorrect" : ""} onClick={() => setIndex(i)}>{i + 1}</Button>)}</div>
    <h3>{item.slide.challenge}</h3><div className="book-options">{item.slide.options.map(option => <Button variant="outline" key={option} disabled={Boolean(answers[index])} className={answers[index] ? option === item.slide.correctAnswer ? "book-correct" : option === answers[index] ? "book-incorrect" : "" : ""} onClick={() => setAnswers({ ...answers, [index]: option })}>{option}</Button>)}</div>
    {answers[index] && <div className="book-note" role="status"><strong>{item.slide.correctAnswer}</strong><p>{item.slide.explanation}</p><Button variant="outline" onClick={() => onTry(item.index)}><FlaskConical className="size-4" />{tr("جرّبها في التجربة")}</Button></div>}
    <div className="book-chips"><Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>{tr("السابق")}</Button><Button variant="outline" disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}>{tr("التالي")}</Button><Button variant="outline" onClick={() => { setAnswers({}); setIndex(0); }}><RotateCcw className="size-4" />{tr("ابدأ من جديد")}</Button></div>
  </div>;
}

export function LivingBookViewer({ title, slides, dir, onClose }: { title: string; slides: LessonSlide[]; dir: "rtl" | "ltr"; onClose: () => void }) {
  const { tr } = useI18n();
  const [index, setIndex] = useState(0);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cards = slides.flatMap(slide => slide.livingBook?.cards ?? []);
  const blanks = slides.flatMap(slide => slide.livingBook?.blanks ?? []);
  const sections = [...slides.map(slide => slide.title), ...(cards.length ? [tr("كلمات الدرس")] : []), ...(blanks.length ? [tr("العب واختبر نفسك")] : []), ...(slides.some(slide => slide.challenge) ? [tr("تمارين الدرس")] : [])];
  const slide = slides[index];
  const go = (next: number) => { setIndex(Math.max(0, Math.min(sections.length - 1, next))); setMenu(false); setSelected(null); panel.current?.querySelector(".book-scroll")?.scrollTo(0, 0); };
  useEffect(() => {
    const before = document.title;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
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
          {slide ? <><div className="book-definition"><p>{slide.narrative}</p></div><ul className="book-points">{slide.points.map((point, i) => <li key={i}>{point}</li>)}</ul>{slide.livingBook && <div className="book-concepts">{slide.livingBook.layers.map(layer => <div className="book-concept" key={layer.id}><FlaskConical className="size-6" /><div><h3>{layer.label}</h3><p>{layer.description}</p></div><Button variant="outline" onClick={() => { setSelected(layer.id); panel.current?.querySelector(".book-live")?.scrollIntoView({ behavior: "instant", block: "start" }); }}>{tr("جرّب")}</Button></div>)}</div>}<Prediction slide={slide} answer={answers[index]} onAnswer={value => setAnswers({ ...answers, [index]: value })} onTry={() => { setSelected(slide.livingBook?.layers[0]?.id ?? null); panel.current?.querySelector(".book-live")?.scrollIntoView({ behavior: "instant", block: "start" }); }} /><footer className="book-source">{tr("المصدر ص")} {slide.sourcePage}: «{slide.sourceQuote}»</footer></> : <>
            <div className="book-score"><strong>{completed} / {total}</strong><span>{tr("إجابات صحيحة")}</span></div>
            {cards.length > 0 && index === slides.length ? <ul className="book-points">{cards.map((card, i) => <li key={i}>{card.front}</li>)}</ul> : null}
          </>}
        </section>
        <section className="book-page book-live">
          {slide?.livingBook ? <BookScene book={slide.livingBook} selected={selected} onSelect={setSelected} /> : slide ? <div className="book-note"><h3>{slide.title}</h3><ul className="book-points">{slide.points.map((point, i) => <li key={i}>{point}</li>)}</ul></div> : cards.length > 0 && index === slides.length ? <WordCards cards={cards} /> : blanks.length > 0 && index === slides.length + (cards.length ? 1 : 0) ? <WordBank blanks={blanks} /> : <Exercises slides={slides} onTry={go} />}
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
