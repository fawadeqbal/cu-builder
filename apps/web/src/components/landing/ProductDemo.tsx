"use client";

import { afterExampleCV, atsReport, beforeExampleCV, type CV } from "@cvb/domain";
import { Icon, ScoreRing, markPlaceholders } from "@cvb/ui";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT, type MessageKey } from "@/lib/i18n";
import { rtlBody, SectionHead, wrap } from "./shared";

/*
 * A looping, in-page demo of the product: import → ATS score rises → AI suggestion applied →
 * download. Plain HTML and CSS animations, no video. It never takes focus, pauses when off
 * screen or in a background tab, has a pause button, and shows one still frame to people who
 * ask for reduced motion. The scores are the real ATS check on the example CVs.
 */

const FRAMES = ["import", "check", "improve", "download"] as const;
type Frame = (typeof FRAMES)[number];
const FRAME_MS = 3600;

/** The example halfway: details, summary, skills and dates fixed, achievement lines not yet. */
const midExampleCV: CV = {
  ...afterExampleCV,
  experience: afterExampleCV.experience.map((e, i) => ({
    ...e,
    bullets: beforeExampleCV.experience[i]?.bullets ?? e.bullets,
  })),
};
const ats = (cv: CV) => atsReport(cv, { templateAts: true, pages: 1 }).score;
const SCORE = { before: ats(beforeExampleCV), mid: ats(midExampleCV), after: ats(afterExampleCV) };

// The example CV is in English, so its lines stay English in every interface language.
const WEAK_LINE = beforeExampleCV.experience[0]!.bullets[0]!;
const SUGGESTED = "Visit [number] retailers a week across two districts and opened [number] new accounts in 2024.";
const FILLED = afterExampleCV.experience[0]!.bullets[0]!;
const FILE = "ali-raza-cv.pdf";

const STEP_LABEL: Record<Frame, MessageKey> = {
  import: "landing.demo.step1",
  check: "landing.demo.step2",
  improve: "landing.demo.step3",
  download: "landing.demo.step4",
};

const subscribeMotion = (onChange: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
/** True when the visitor asked for less motion (true on the server, so the first paint is still). */
const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};
const usePageVisible = () =>
  useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );

export function ProductDemo() {
  const t = useT();
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = !reduced && !paused && onScreen && pageVisible;
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setFrame((f) => (f + 1) % FRAMES.length), FRAME_MS);
    return () => clearTimeout(id);
  }, [running, frame]);

  // People who prefer less motion see one still frame: the suggestion applied and the higher score.
  const shown: Frame = reduced ? "improve" : FRAMES[frame]!;
  const still = reduced;

  return (
    <section aria-labelledby="demo-title" className="py-20">
      <style>{DEMO_CSS}</style>
      <div className={`${wrap} flex flex-col gap-10`}>
        <SectionHead
          id="demo-title"
          eyebrow={t("landing.demo.eyebrow")}
          title={t("landing.demo.title")}
          lead={t("landing.demo.lead")}
          center
        />
        <div ref={ref} className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {/* The animation is a picture: one label for screen readers, nothing focusable inside. */}
          <div
            role="img"
            aria-label={t("landing.demo.label", { from: SCORE.before, to: SCORE.after })}
            className="cvb-demo overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-md)]"
            data-paused={running || still ? undefined : ""}
          >
            <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="ms-3 truncate text-xs font-medium text-ink-3">{t(STEP_LABEL[shown])}</span>
            </div>
            <div aria-hidden="true" className="grid min-h-[300px] gap-0 sm:grid-cols-[1.15fr_1fr]">
              <div className="flex flex-col justify-center gap-4 p-5 sm:p-7">
                <Panel key={`${shown}-${frame}`} frame={shown} still={still} />
              </div>
              <MiniPaper frame={shown} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ol className="flex flex-wrap gap-x-4 gap-y-2" aria-label={t("landing.demo.stepsLabel")}>
              {FRAMES.map((f, i) => {
                const current = f === shown;
                return (
                  <li
                    key={f}
                    aria-current={current ? "step" : undefined}
                    className={`flex items-center gap-2 text-sm ${current ? "font-semibold text-ink" : "text-ink-3"} ${rtlBody}`}
                  >
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs ${current ? "bg-brand text-on-brand" : "bg-surface-2 text-ink-2"}`}
                    >
                      {i + 1}
                    </span>
                    {t(STEP_LABEL[f])}
                  </li>
                );
              })}
            </ol>
            {!reduced && (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
                  {paused ? <path d="M3 1.5v11l9-5.5z" /> : <path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" />}
                </svg>
                {paused ? t("landing.demo.play") : t("landing.demo.pause")}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Counts from `from` to `to` once after mounting (or shows `to` straight away when still). */
function useCountUp(from: number, to: number, ms: number, still: boolean, delay = 0) {
  const [value, setValue] = useState(still ? to : from);
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const startAt = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - startAt) / ms));
      setValue(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms, still, delay]);
  return value;
}

function Panel({ frame, still }: { frame: Frame; still: boolean }) {
  if (frame === "import") return <ImportPanel />;
  if (frame === "check") return <CheckPanel still={still} />;
  if (frame === "improve") return <ImprovePanel still={still} />;
  return <DownloadPanel />;
}

function ImportPanel() {
  const t = useT();
  return (
    <>
      <p className={`font-display text-lg font-[700] text-ink ${rtlBody}`}>{t("landing.demo.importTitle")}</p>
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong bg-canvas p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink">
            <Icon name="file" size={18} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <bdi className="truncate text-sm font-semibold text-ink" dir="ltr">
              {FILE}
            </bdi>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <span className="cvb-demo-fill block h-full rounded-full bg-brand" />
            </span>
          </div>
        </div>
        <p className={`cvb-demo-in flex items-center gap-2 text-sm text-ink-2 [animation-delay:1.5s] ${rtlBody}`}>
          <Icon name="check-circle" size={16} className="text-success" />
          {t("landing.demo.imported")}
        </p>
      </div>
    </>
  );
}

const CHECKS: MessageKey[] = ["landing.demo.fix1", "landing.demo.fix2", "landing.demo.fix3"];

function CheckPanel({ still }: { still: boolean }) {
  const t = useT();
  const score = useCountUp(SCORE.before, SCORE.mid, 2200, still, 400);
  return (
    <>
      <div className="flex items-center gap-4">
        <ScoreRing value={score} size="lg" />
        <div className="flex flex-col">
          <span className={`font-display text-lg font-[700] text-ink ${rtlBody}`}>{t("landing.demo.atsTitle")}</span>
          <span className={`text-sm text-ink-2 ${rtlBody}`}>{t("landing.demo.atsText")}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {CHECKS.map((k, i) => (
          <li
            key={k}
            className={`cvb-demo-in flex items-center gap-2 text-sm text-ink ${rtlBody}`}
            style={{ animationDelay: `${0.5 + i * 0.6}s` }}
          >
            <Icon name="check-circle" size={16} className="shrink-0 text-success" />
            {t(k)}
          </li>
        ))}
      </ul>
    </>
  );
}

function ImprovePanel({ still }: { still: boolean }) {
  const t = useT();
  const score = useCountUp(SCORE.mid, SCORE.after, 1200, still, 2000);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
          <Icon name="sparkle" size={16} /> {t("landing.demo.aiTitle")}
        </span>
        <ScoreRing value={score} size="sm" />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-4">
        <span lang="en" dir="ltr" className="cvb-demo-strike relative self-start text-start text-sm text-ink-3">
          {WEAK_LINE}
        </span>
        <span lang="en" dir="ltr" className="cvb-demo-in text-start text-sm text-ink [animation-delay:0.6s]">
          {markPlaceholders(SUGGESTED)}
        </span>
        <span className="cvb-demo-press mt-1 inline-flex min-h-8 items-center gap-1.5 self-start rounded-md bg-brand px-3 text-xs font-semibold text-on-brand [animation-delay:1.4s]">
          <Icon name="check" size={14} /> {t("landing.demo.apply")}
        </span>
      </div>
      <p className={`cvb-demo-in flex items-start gap-2 text-xs text-ink-2 [animation-delay:2s] ${rtlBody}`}>
        <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink-3" />
        <span>{markPlaceholders(t("landing.demo.fillNote"))}</span>
      </p>
    </>
  );
}

function DownloadPanel() {
  const t = useT();
  return (
    <>
      <div className="flex items-center gap-4">
        <ScoreRing value={SCORE.after} size="lg" />
        <div className="flex flex-col">
          <span className={`font-display text-lg font-[700] text-ink ${rtlBody}`}>{t("landing.demo.readyTitle")}</span>
          <span className={`text-sm text-ink-2 ${rtlBody}`}>{t("landing.demo.readyText")}</span>
        </div>
      </div>
      <span className="cvb-demo-press inline-flex min-h-11 items-center gap-2 self-start rounded-md bg-brand px-4 text-sm font-semibold text-on-brand [animation-delay:0.8s]">
        <Icon name="download" size={16} /> {t("landing.demo.download")}
      </span>
      <span className="cvb-demo-in inline-flex items-center gap-2 self-start rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink shadow-[var(--shadow-sm)] [animation-delay:1.5s]">
        <Icon name="check-circle" size={16} className="text-success" />
        <bdi dir="ltr">{FILE}</bdi>
        <span className="text-ink-2">{t("landing.demo.downloaded")}</span>
      </span>
    </>
  );
}

/** The CV taking shape beside the panel (hidden on phones to keep the demo short). */
function MiniPaper({ frame }: { frame: Frame }) {
  const step = FRAMES.indexOf(frame);
  const cv = step === 0 ? beforeExampleCV : afterExampleCV;
  const line = step >= 2 ? FILLED : WEAK_LINE;
  return (
    <div className="hidden items-center justify-center border-s border-line bg-surface-2 p-6 sm:flex">
      <div
        lang="en"
        dir="ltr"
        className="flex w-full max-w-[260px] flex-col gap-2.5 rounded-sm bg-surface p-4 text-start shadow-[var(--shadow-sm)] ring-1 ring-line"
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-sm font-[700] text-ink">{cv.personal.name}</span>
          {cv.personal.headline ? (
            <span
              key={`h-${step}`}
              className={`text-[11px] text-brand-ink ${step === 1 ? "cvb-demo-in [animation-delay:1s]" : ""}`}
            >
              {cv.personal.headline}
            </span>
          ) : (
            <span className="h-2 w-1/3 rounded-full border border-dashed border-warning" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          {[100, 92, 60].map((w, i) => (
            <span key={i} className="h-1 rounded-full bg-line-strong" style={{ inlineSize: `${w}%` }} />
          ))}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-2">Experience</span>
        <ul className="flex flex-col gap-1.5 text-[10px] leading-[14px] text-ink-2">
          <li
            key={`l-${step >= 2}`}
            className={`rounded px-1 ${step === 2 ? "cvb-demo-glow [animation-delay:1.6s]" : ""}`}
          >
            • {line}
          </li>
          <li className="h-1 w-[85%] rounded-full bg-line-strong" />
          <li className="h-1 w-[70%] rounded-full bg-line-strong" />
        </ul>
        <div className="flex flex-col gap-1 pt-1">
          {[80, 50].map((w, i) => (
            <span key={i} className="h-1 rounded-full bg-line-strong" style={{ inlineSize: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/*
 * Each element's resting style is its final state; animations only describe how it gets there
 * (fill mode "both" holds the start until the delay ends). With reduced motion the animations
 * are switched off, which leaves the finished frame.
 */
const DEMO_CSS = `
@keyframes cvb-demo-fill { from { inline-size: 0 } to { inline-size: 100% } }
@keyframes cvb-demo-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
@keyframes cvb-demo-strike { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes cvb-demo-press { 0%, 70% { transform: scale(1) } 80% { transform: scale(0.92) } 100% { transform: scale(1) } }
@keyframes cvb-demo-glow { from { background: color-mix(in srgb, var(--brand) 22%, transparent) } to { background: transparent } }
.cvb-demo .cvb-demo-fill { inline-size: 100%; animation: cvb-demo-fill 1.4s cubic-bezier(.2,.7,.2,1) both; }
.cvb-demo .cvb-demo-in { animation: cvb-demo-in .45s ease-out both; }
.cvb-demo .cvb-demo-strike::after { content: ""; position: absolute; inset-inline: 0; top: 50%; border-top: 1.5px solid currentColor; transform-origin: left; animation: cvb-demo-strike .5s ease-out 1.6s both; }
.cvb-demo .cvb-demo-press { animation: cvb-demo-press 1s ease-out both; }
.cvb-demo .cvb-demo-glow { animation: cvb-demo-glow 1.6s ease-out both; }
.cvb-demo[data-paused] * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { .cvb-demo * { animation: none !important; } }
`;
