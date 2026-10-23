"use client";

import type { ResumeDto } from "@cvb/contracts";
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
import {
  Badge,
  Button,
  Chip,
  ColorSwatches,
  Dialog,
  EmptyState,
  IconButton,
  PageHeader,
  PaperSheet,
  PreviewCanvas,
  SearchField,
  SegmentedControl,
  Switch,
  Tabs,
  TierBadge,
  Toast,
} from "@cvb/ui";
import { isUnlocked, usePlan } from "@/lib/access";
import { track } from "@/lib/analytics";
import { api, isApiError } from "@/lib/api";
import { useCatalog } from "@/lib/catalog";
import type { Gate } from "@/lib/plans";
import { useResume } from "@/lib/queries";
import { AppHeader } from "./AppHeader";
import { FullPageMessage } from "./ui/FullPageMessage";
import { UpgradeDialog } from "./UpgradeDialog";

const A4_PX = 793.7; // 210mm at 96dpi

/** The full template gallery: filter by tier, style, layout and ATS, recolour, preview, choose. */
export default function TemplateGallery() {
  const resumeId = useSearchParams().get("resume");
  const resume = useResume(resumeId ?? "", Boolean(resumeId));
  if (resumeId && !resume.data) {
    return <FullPageMessage>{resume.isError ? "We couldn't open that CV." : "Loading templates…"}</FullPageMessage>;
  }
  return <Gallery resume={resume.data ?? null} />;
}

const fromResume = (r: ResumeDto): Saved => ({
  cv: normalizeCV(r.data),
  template: isTemplateId(r.templateId) ? r.templateId : "classic",
  accent: r.accent,
  pageSize: r.pageSize,
  fontScale: r.style.fontScale,
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

  const backHref = resume ? `/edit/${resume.id}` : signedIn ? "/app" : "/builder";

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
        track("cv_started", { source: "blank", from: "templates" });
        router.push(`/edit/${created.id}`);
      } else {
        save({ ...saved, template: id, accent });
        router.push("/builder");
      }
    } catch (e) {
      if (isApiError(e, "PLAN_REQUIRED")) setGate({ kind: "feature", feature: "resume.multiple" });
      else setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const count = (t: Tier | "all") => (t === "all" ? TEMPLATES.length : TEMPLATES.filter((x) => x.tier === t).length);
  const tierTabs = (["all", ...TIERS.map((t) => t.id)] as const).map((id) => ({
    id,
    label: TIERS.find((t) => t.id === id)?.name ?? "All templates",
    count: count(id),
  }));

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />

      <main className="mx-auto flex max-w-(--layout-xl) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
        <PageHeader
          back={{ href: backHref, label: resume || !signedIn ? "Back to editor" : "My CVs" }}
          title="Choose a template"
          description={`${TEMPLATES.length} designs in four tiers. Switch any time: your content stays exactly as it is.`}
          actions={
            hasOwnCV && (
              <SegmentedControl<"mine" | "example">
                label="Preview with"
                value={useMine ? "mine" : "example"}
                onChange={(v) => setUseMine(v === "mine")}
                options={[
                  { value: "mine", label: "Preview with My CV" },
                  { value: "example", label: "Preview with Example" },
                ]}
              />
            )
          }
        />

        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <Tabs<Tier | "all"> label="Tier" items={tierTabs} value={tier} onChange={setTier} />
          </div>
          {tier !== "all" && (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <TierBadge tier={tier} /> {TIERS.find((t) => t.id === tier)?.blurb}
            </p>
          )}
        </div>

        {/* Filters */}
        <section
          aria-label="Filters"
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8"
        >
          <FilterGroup label="Style">
            {STYLES.map((s) => {
              const on = styles.includes(s.id);
              return (
                <Chip
                  key={s.id}
                  selected={on}
                  onClick={() => setStyles((cur) => (on ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}
                >
                  {s.name}
                </Chip>
              );
            })}
          </FilterGroup>

          <FilterGroup label="Layout">
            {[{ id: "any" as const, name: "Any" }, ...LAYOUTS].map((l) => (
              <Chip key={l.id} selected={layout === l.id} onClick={() => setLayout(l.id)}>
                {l.name}
              </Chip>
            ))}
          </FilterGroup>

          <Switch label="ATS-friendly only" checked={atsOnly} onChange={setAtsOnly} className="text-sm font-medium" />

          <FilterGroup label="Colour">
            <button
              type="button"
              title="Each template's own colour"
              aria-pressed={accent === null}
              onClick={() => setAccent(null)}
              className="cvb-swatch aria-pressed:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)]"
              style={{ background: `conic-gradient(${[...ACCENTS.map((a) => a.value), ACCENTS[0]?.value].join(",")})` }}
            >
              <span className="sr-only">Template colours</span>
            </button>
            <ColorSwatches
              label="Accent colour"
              colors={ACCENTS}
              value={accent ?? ""}
              onChange={setAccent}
              className="min-w-0 flex-1 lg:flex-none"
            />
          </FilterGroup>

          <SearchField
            label="Search templates"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full lg:ms-auto lg:w-56"
          />
        </section>

        <div className="flex flex-col gap-4">
          <div className="flex min-h-8 items-center justify-between text-sm text-ink-3">
            <span>
              {results.length} {results.length === 1 ? "template" : "templates"}
            </span>
            {filtered && (
              <Button variant="link" size="sm" onClick={clear}>
                Clear filters
              </Button>
            )}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon="filter"
              title="No templates match these filters."
              className="rounded-lg border border-dashed border-line-strong bg-surface"
              actions={<Button onClick={clear}>Clear filters</Button>}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((t) => (
                <li key={t.id} className="min-w-0">
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
        </div>
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
        <div role="alert" className="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex justify-center">
          <div className="pointer-events-auto">
            <Toast tone="danger" onDismiss={() => setError("")}>
              {error}
            </Toast>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="cvb-overline me-1 w-14 shrink-0 text-ink-3 lg:w-auto" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

/** An A4 sheet scaled to the width of its box (fills a PaperSheet). */
function ScaledSheet({ cv, template, accent }: { cv: CV; template: TemplateId; accent: string | null }) {
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
    <div ref={ref} className="absolute inset-0" dir="ltr">
      {scale > 0 && (
        <div className="absolute start-0 top-0 w-[210mm] origin-top-left" style={{ transform: `scale(${scale})` }}>
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
    <article className="cvb-template group h-full" data-current={current ? "" : undefined}>
      <div className="cvb-template-thumb">
        <PaperSheet accent={accent ?? meta.accent}>
          <span inert>
            <ScaledSheet cv={cv} template={meta.id} accent={accent} />
          </span>
        </PaperSheet>
        <button
          type="button"
          onClick={onPreview}
          className="absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus"
          aria-label={`Preview ${meta.name}`}
        />
        {current && (
          <Badge tone="brand" variant="solid" icon="check">
            In use
          </Badge>
        )}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[2] flex flex-wrap justify-center gap-2 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          <Button size="sm" icon="eye" onClick={onPreview} className="shadow-md">
            Preview
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={locked ? "lock" : undefined}
            onClick={onChoose}
            className="shadow-md"
          >
            {current ? "Keep using" : locked ? "Unlock" : "Use template"}
          </Button>
        </div>
      </div>
      <div className="cvb-template-meta flex-1 gap-1">
        <div className="cvb-template-row">
          <span
            className="size-2.5 shrink-0 rounded-full ring-1 ring-line-strong"
            style={{ background: accent ?? meta.accent }}
            aria-hidden="true"
          />
          <h2 className="cvb-h3 min-w-0 flex-1 truncate">{meta.name}</h2>
        </div>
        <div className="cvb-template-row flex-wrap">
          <TierBadge tier={meta.tier} />
          {meta.ats && (
            <Badge tone="success" icon="check">
              ATS
            </Badge>
          )}
        </div>
        <p className="text-sm text-ink-2">{meta.description}</p>
        <p className="cvb-caption mt-auto pt-2 text-ink-3">{meta.bestFor}</p>
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
  const index = Math.max(
    0,
    list.findIndex((t) => t.id === id),
  );
  const meta = list[index] ?? list[0];
  const go = (dir: 1 | -1) => onNavigate(list[(index + dir + list.length) % list.length].id);

  // Escape, focus and scroll locking come from the dialog; the arrow keys browse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const swatches = [{ value: meta.accent, name: "Template colour" }, ...ACCENTS.filter((a) => a.value !== meta.accent)];

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={meta.name}
      description={
        <span className="cvb-num" dir="ltr">
          {index + 1} of {list.length}
        </span>
      }
      footer={
        <>
          <span className="cvb-caption me-auto hidden self-center text-ink-3 md:inline">
            Use ← → to browse · Esc to close
          </span>
          <Button variant="primary" onClick={() => onChoose(meta.id)}>
            {meta.id === current ? "Keep using this template" : "Use this template"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        <PreviewCanvas className="relative grid-cols-[minmax(0,1fr)] px-14 py-6 sm:px-16">
          <PaperSheet accent={accent ?? meta.accent} maxWidth={560}>
            <span inert>
              <ScaledSheet cv={cv} template={meta.id} accent={accent} />
            </span>
          </PaperSheet>
          <span className="absolute start-2 top-1/2 -translate-y-1/2">
            <IconButton
              icon="chevron-left"
              variant="secondary"
              label="Previous template"
              onClick={() => go(-1)}
              tooltip={false}
            />
          </span>
          <span className="absolute end-2 top-1/2 -translate-y-1/2">
            <IconButton
              icon="chevron-right"
              variant="secondary"
              label="Next template"
              onClick={() => go(1)}
              tooltip={false}
            />
          </span>
        </PreviewCanvas>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            <TierBadge tier={meta.tier} />
            {meta.ats && (
              <Badge tone="success" icon="check">
                ATS-friendly
              </Badge>
            )}
          </div>
          <p className="text-sm text-ink-2">{meta.description}</p>
          <p className="cvb-caption text-ink-3">{templateTags(meta)}</p>
          <div className="flex flex-col gap-2">
            <span className="cvb-overline text-ink-3">Colour</span>
            <ColorSwatches
              label="Colour"
              colors={swatches}
              value={accent ?? meta.accent}
              onChange={(v) => onAccent(v === meta.accent ? null : v)}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
