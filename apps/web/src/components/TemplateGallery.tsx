"use client";

import type { ResumeDto } from "@cvb/contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeCV, sampleCV } from "@cvb/domain";
import { FRESH, loadSaved, save, type Saved } from "@/lib/cv";
import type { CV } from "@cvb/domain";
import {
  ACCENTS,
  CVDocument,
  isTemplateId,
  LAYOUTS,
  STYLES,
  TIERS,
  type LayoutKind,
  type Style,
  type TemplateId,
  type TemplateMeta,
  type Tier,
  templateTags,
} from "@cvb/templates";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LockIcon, PreviewIcon } from "@cvb/ui";
import { TierBadge } from "@cvb/ui";
import { isUnlocked, usePlan } from "@/lib/access";
import { track } from "@/lib/analytics";
import { api, isApiError } from "@/lib/api";
import { useCatalog } from "@/lib/catalog";
import type { Gate } from "@/lib/plans";
import { useResume } from "@/lib/queries";
import { UpgradeDialog } from "./UpgradeDialog";

const A4_PX = 793.7; // 210mm at 96dpi

/** The full template gallery: filter by tier, style, layout and ATS, recolour, preview, choose. */
export default function TemplateGallery() {
  const resumeId = useSearchParams().get("resume");
  const resume = useResume(resumeId ?? "", Boolean(resumeId));
  if (resumeId && !resume.data) {
    return <div className="grid h-dvh place-items-center bg-stone-50 text-sm text-stone-500">{resume.isError ? "We couldn't open that CV." : "Loading templates…"}</div>;
  }
  return <Gallery resume={resume.data ?? null} />;
}

const fromResume = (r: ResumeDto): Saved => ({
  cv: normalizeCV(r.data),
  template: isTemplateId(r.templateId) ? r.templateId : "classic",
  accent: r.accent,
  pageSize: r.pageSize,
  step: 0,
  started: true,
});

/**
 * Picks a template for one CV: the CV in this browser (guests), a CV in the account
 * (`?resume=<id>`), or a new account CV when a signed-in user opens the gallery directly.
 */
function Gallery({ resume }: { resume: ResumeDto | null }) {
  const router = useRouter();
  const { plan, signedIn } = usePlan();
  const { templates: TEMPLATES } = useCatalog();
  const [gate, setGate] = useState<Gate | null>(null);
  const [error, setError] = useState("");
  const [saved] = useState<Saved>(() => (resume ? fromResume(resume) : (loadSaved() ?? FRESH)));
  const hasOwnCV = !!saved.cv.personal.name.trim();
  const [useMine, setUseMine] = useState(hasOwnCV);
  const cv: CV = useMine && hasOwnCV ? saved.cv : sampleCV;

  const [tier, setTier] = useState<Tier | "all">("all");
  const [styles, setStyles] = useState<Style[]>([]);
  const [layout, setLayout] = useState<LayoutKind | "any">("any");
  const [atsOnly, setAtsOnly] = useState(false);
  const [accent, setAccent] = useState<string | null>(saved.accent);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<TemplateId | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter(
      (t) =>
        (tier === "all" || t.tier === tier) &&
        (styles.length === 0 || styles.includes(t.style)) &&
        (layout === "any" || t.layout === layout) &&
        (!atsOnly || t.ats) &&
        (!q || `${t.name} ${t.description} ${t.bestFor} ${t.style} ${t.tier}`.toLowerCase().includes(q)),
    );
  }, [tier, styles, layout, atsOnly, query, TEMPLATES]);

  const filtered = styles.length > 0 || layout !== "any" || atsOnly || query.trim() !== "" || tier !== "all";
  const clear = () => {
    setTier("all");
    setStyles([]);
    setLayout("any");
    setAtsOnly(false);
    setQuery("");
  };

  const backHref = resume ? `/edit/${resume.id}` : signedIn ? "/app" : "/";

  async function choose(id: TemplateId) {
    const meta = TEMPLATES.find((t) => t.id === id);
    if (meta && !isUnlocked(plan, meta.tier)) return setGate({ kind: "tier", tier: meta.tier, name: meta.name });
    track("template_selected", { template: id, from: "gallery" });
    try {
      if (resume) {
        await api.patch(`/resumes/${resume.id}`, { templateId: id, accent });
        router.push(`/edit/${resume.id}`);
      } else if (signedIn) {
        const created = await api.post<ResumeDto>("/resumes", { title: "Untitled CV", templateId: id, accent });
        router.push(`/edit/${created.id}`);
      } else {
        save({ ...saved, template: id, accent });
        router.push("/");
      }
    } catch (e) {
      if (isApiError(e, "PLAN_REQUIRED")) setGate({ kind: "feature", feature: "resume.multiple" });
      else setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const count = (t: Tier | "all") => (t === "all" ? TEMPLATES.length : TEMPLATES.filter((x) => x.tier === t).length);
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition ${
      on ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-600 ring-stone-200 hover:ring-stone-300 hover:text-stone-900"
    }`;

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href={backHref} className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-[11px] font-bold tracking-wide text-white shadow-sm shadow-brand/30">
              CV
            </span>
            <span className="text-sm font-semibold text-stone-900">Templates</span>
          </Link>
          <Link
            href={backHref}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <ArrowLeftIcon className="size-4" /> {resume || !signedIn ? "Back to editor" : "My CVs"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Choose a template</h1>
            <p className="mt-1.5 max-w-xl text-[15px] text-stone-600">
              {TEMPLATES.length} designs in four tiers. Switch any time: your content stays exactly as it is.
            </p>
          </div>
          {hasOwnCV && (
            <div className="flex rounded-lg bg-stone-100 p-0.5 text-[13px] ring-1 ring-inset ring-stone-200">
              {[
                [true, "My CV"],
                [false, "Example"],
              ].map(([v, label]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setUseMine(v as boolean)}
                  className={`rounded-md px-3 py-1.5 font-medium ${useMine === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
                >
                  Preview with {label as string}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tiers */}
        <div role="tablist" aria-label="Tier" className="mt-7 flex gap-1 overflow-x-auto border-b border-stone-200">
          {(["all", ...TIERS.map((t) => t.id)] as const).map((id) => {
            const on = tier === id;
            const info = TIERS.find((t) => t.id === id);
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTier(id)}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                  on ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                {info ? info.name : "All templates"}
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-brand/10 text-brand" : "bg-stone-100 text-stone-500"}`}>
                  {count(id)}
                </span>
              </button>
            );
          })}
        </div>
        {tier !== "all" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-stone-600">
            <TierBadge tier={tier} /> {TIERS.find((t) => t.id === tier)?.blurb}
          </p>
        )}

        {/* Filters */}
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8">
          <FilterGroup label="Style">
            {STYLES.map((s) => {
              const on = styles.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStyles((cur) => (on ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}
                  className={chip(on)}
                >
                  {s.name}
                </button>
              );
            })}
          </FilterGroup>

          <FilterGroup label="Layout">
            {[{ id: "any" as const, name: "Any" }, ...LAYOUTS].map((l) => (
              <button key={l.id} type="button" aria-pressed={layout === l.id} onClick={() => setLayout(l.id)} className={chip(layout === l.id)}>
                {l.name}
              </button>
            ))}
          </FilterGroup>

          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-stone-700">
            <span className="relative inline-flex">
              <input type="checkbox" className="peer sr-only" checked={atsOnly} onChange={(e) => setAtsOnly(e.target.checked)} />
              <span className="h-5 w-9 rounded-full bg-stone-200 transition peer-checked:bg-emerald-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
              <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
            </span>
            ATS-friendly only
          </label>

          <FilterGroup label="Colour">
            <button
              type="button"
              title="Each template's own colour"
              aria-pressed={accent === null}
              onClick={() => setAccent(null)}
              className={`grid size-7 place-items-center rounded-full bg-[conic-gradient(#1e4b8f,#0f766e,#c2410c,#7c5e10,#6b21a8,#1e4b8f)] ring-1 ring-black/10 ${
                accent === null ? "outline-2 outline-offset-2 outline-stone-900" : ""
              }`}
            >
              <span className="sr-only">Template colours</span>
            </button>
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                title={a.name}
                aria-label={a.name}
                aria-pressed={accent === a.value}
                onClick={() => setAccent(a.value)}
                className={`size-7 rounded-full ring-1 ring-black/10 transition hover:scale-110 ${
                  accent === a.value ? "outline-2 outline-offset-2 outline-stone-900" : ""
                }`}
                style={{ background: a.value }}
              />
            ))}
          </FilterGroup>

          <div className="relative lg:ml-auto">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates"
              className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 lg:w-56"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-stone-500">
          <span>
            {results.length} {results.length === 1 ? "template" : "templates"}
          </span>
          {filtered && (
            <button type="button" onClick={clear} className="font-medium text-brand hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
            <p className="text-sm text-stone-600">No templates match these filters.</p>
            <button type="button" onClick={clear} className="mt-3 text-sm font-semibold text-brand hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((t) => (
              <li key={t.id}>
                <TemplateCard
                  meta={t}
                  cv={cv}
                  accent={accent}
                  current={t.id === saved.template}
                  locked={!isUnlocked(plan, t.tier)}
                  onPreview={() => setOpen(t.id)}
                  onChoose={() => void choose(t.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {open && (
        <PreviewDialog
          list={results.length ? results : TEMPLATES}
          id={open}
          cv={cv}
          accent={accent}
          onAccent={setAccent}
          current={saved.template}
          onNavigate={setOpen}
          onClose={() => setOpen(null)}
          onChoose={(id) => void choose(id)}
        />
      )}
      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
      {error && (
        <div role="alert" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-400 lg:w-auto">{label}</span>
      {children}
    </div>
  );
}

/** An A4 sheet scaled to the width of its box. */
function ScaledSheet({ cv, template, accent, className = "" }: { cv: CV; template: TemplateId; accent: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / A4_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`relative aspect-[210/297] overflow-hidden bg-white ${className}`}>
      {scale > 0 && (
        <div className="absolute left-0 top-0 w-[210mm] origin-top-left" style={{ transform: `scale(${scale})` }}>
          <div className="paper !shadow-none">
            <CVDocument cv={cv} template={template} accent={accent} />
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  meta,
  cv,
  accent,
  current,
  locked,
  onPreview,
  onChoose,
}: {
  meta: TemplateMeta;
  cv: CV;
  accent: string | null;
  current: boolean;
  locked: boolean;
  onPreview: () => void;
  onChoose: () => void;
}) {
  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-lg ${
        current ? "border-brand ring-2 ring-brand/20" : "border-stone-200"
      }`}
    >
      <div className="relative border-b border-stone-100 bg-stone-100 p-4">
        <button type="button" onClick={onPreview} className="block w-full overflow-hidden rounded-md shadow-md ring-1 ring-black/5" aria-label={`Preview ${meta.name}`}>
          <ScaledSheet cv={cv} template={meta.id} accent={accent} />
        </button>
        {current && (
          <span className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            <CheckIcon className="size-3" /> In use
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center gap-2 opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            onClick={onPreview}
            className="flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-stone-800 shadow-lg ring-1 ring-black/5 hover:bg-white"
          >
            <PreviewIcon className="size-4" /> Preview
          </button>
          <button
            type="button"
            onClick={onChoose}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-lg hover:bg-brand-dark"
          >
            {locked && <LockIcon className="size-3.5" />}
            {current ? "Keep using" : locked ? "Unlock" : "Use template"}
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: accent ?? meta.accent }} />
          <h2 className="text-[15px] font-semibold text-stone-900">{meta.name}</h2>
          <TierBadge tier={meta.tier} className="ml-auto" />
          {meta.ats && (
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
              ATS
            </span>
          )}
        </div>
        <p className="text-sm leading-snug text-stone-600">{meta.description}</p>
        <p className="mt-auto pt-2 text-xs text-stone-500">{meta.bestFor}</p>
      </div>
    </article>
  );
}

function PreviewDialog({
  list,
  id,
  cv,
  accent,
  onAccent,
  current,
  onNavigate,
  onClose,
  onChoose,
}: {
  list: TemplateMeta[];
  id: TemplateId;
  cv: CV;
  accent: string | null;
  onAccent: (a: string | null) => void;
  current: TemplateId;
  onNavigate: (id: TemplateId) => void;
  onClose: () => void;
  onChoose: (id: TemplateId) => void;
}) {
  const index = Math.max(0, list.findIndex((t) => t.id === id));
  const meta = list[index] ?? list[0];
  const go = (dir: 1 | -1) => onNavigate(list[(index + dir + list.length) % list.length].id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={`${meta.name} preview`} className="fixed inset-0 z-50 flex bg-stone-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="m-auto flex h-[min(92dvh,1000px)] w-[min(96vw,1180px)] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="preview-canvas relative hidden min-w-0 flex-1 overflow-y-auto p-8 md:block">
          <div className="mx-auto w-full max-w-[640px] shadow-xl">
            <ScaledSheet cv={cv} template={meta.id} accent={accent} />
          </div>
          <button type="button" onClick={() => go(-1)} aria-label="Previous template" className="absolute left-4 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white text-stone-700 shadow-lg ring-1 ring-black/5 hover:bg-stone-50">
            <ArrowLeftIcon className="size-5" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next template" className="absolute right-4 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white text-stone-700 shadow-lg ring-1 ring-black/5 hover:bg-stone-50">
            <ArrowRightIcon className="size-5" />
          </button>
        </div>

        <aside className="flex w-full flex-col gap-5 overflow-y-auto border-l border-stone-200 p-6 md:w-80">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-stone-500">
                {index + 1} of {list.length}
              </div>
              <h2 className="mt-1 text-xl font-semibold text-stone-900">{meta.name}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TierBadge tier={meta.tier} />
            {meta.ats && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">ATS-friendly</span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-stone-600">{meta.description}</p>
          <p className="text-xs text-stone-500">{templateTags(meta)}</p>

          <div className="md:hidden">
            <div className="mx-auto w-full max-w-xs overflow-hidden rounded-md shadow-lg ring-1 ring-black/5">
              <ScaledSheet cv={cv} template={meta.id} accent={accent} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Colour</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                title="Template colour"
                onClick={() => onAccent(null)}
                className={`size-7 rounded-full ring-1 ring-black/10 ${accent === null ? "outline-2 outline-offset-2 outline-stone-900" : ""}`}
                style={{ background: meta.accent }}
              />
              {ACCENTS.filter((a) => a.value !== meta.accent).map((a) => (
                <button
                  key={a.value}
                  type="button"
                  title={a.name}
                  aria-label={a.name}
                  onClick={() => onAccent(a.value)}
                  className={`size-7 rounded-full ring-1 ring-black/10 transition hover:scale-110 ${accent === a.value ? "outline-2 outline-offset-2 outline-stone-900" : ""}`}
                  style={{ background: a.value }}
                />
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onChoose(meta.id)}
              className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
            >
              {meta.id === current ? "Keep using this template" : "Use this template"}
            </button>
            <p className="text-center text-xs text-stone-500">Use ← → to browse · Esc to close</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
