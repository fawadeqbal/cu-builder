"use client";

import { applyChanges, clean, diffCV, matchJob, type CV, type SkillGroup } from "@cvb/domain";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Checkbox, EmptyState, Icon, TextArea, TextField } from "@cvb/ui";
import { useAiCall } from "@/lib/ai";
import { clipLines, countPlaceholders, regroupSkills, SKILLS_CHANGE, skillsChange } from "@/lib/ai-cv";
import { gateTitle, type Gate } from "@/lib/plans";
import { Dialog } from "../ui/Dialog";
import { AiStepList, useAiSteps, type AiTask } from "./AiSteps";
import { ChangeReview } from "./ChangeReview";

type Parts = { summary: boolean; experience: boolean; projects: boolean; skills: boolean };
type Review = { base: CV; next: CV; skills: SkillGroup[] | null; failed: number; skipped: number; gate: Gate | null };

const entryName = (role: string, org: string, fallback: string) => [role.trim(), org.trim()].filter(Boolean).join(" at ") || fallback;

/** Every change to review: diffCV for text, plus one row for regrouped skills. */
function reviewChanges(r: Pick<Review, "base" | "next" | "skills">) {
  const skills = r.skills ? skillsChange(r.base.skills, r.skills) : null;
  return [...diffCV(r.base, { ...r.next, skills: r.base.skills }), ...(skills ? [skills] : [])];
}

/** The job title in a pasted advert: its first short line. */
const advertTitle = (advert: string) => advert.split("\n").map((l) => l.trim()).find((l) => l.length > 2 && l.length <= 120) ?? "";

/**
 * "Optimise with AI": rewrites the summary, each job's and project's lines, and the skills
 * grouping, one call at a time, then shows every change for review with the ATS score before and
 * after. Nothing changes in the CV until the person applies the changes they ticked.
 */
export function OptimiseDialog({
  open,
  onClose,
  cv,
  score,
  creditsLeft,
  onApply,
  onGate,
}: {
  open: boolean;
  onClose: () => void;
  cv: CV;
  /** The ATS score the editor would show for a CV. */
  score: (cv: CV) => number;
  creditsLeft?: number;
  onApply: (next: CV, count: number) => void;
  onGate: (gate: Gate) => void;
}) {
  const { call } = useAiCall();
  const runner = useAiSteps();
  const [phase, setPhase] = useState<"setup" | "run" | "review">("setup");
  const [title, setTitle] = useState(cv.personal.headline);
  const [advert, setAdvert] = useState("");
  const [parts, setParts] = useState<Parts>({ summary: true, experience: true, projects: true, skills: true });
  const [review, setReview] = useState<Review | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const jobs = cv.experience.filter((e) => clean(e.bullets).length);
  const projects = cv.projects.filter((p) => clean(p.bullets).length);
  const hasSkills = cv.skills.some((s) => s.items.trim());
  const cost = (parts.summary ? 1 : 0) + (parts.experience ? jobs.length : 0) + (parts.projects ? projects.length : 0) + (parts.skills && hasSkills ? 1 : 0);
  const targetTitle = (title.trim() || advertTitle(advert)).slice(0, 160) || undefined;
  // The advert's keywords, so the AI can use its exact wording where the CV's facts support it (ATS).
  const keywords = advert.trim() ? matchJob(cv, { title: targetTitle, description: advert }).keywords.map((k) => k.keyword.slice(0, 60)).slice(0, 20) : undefined;

  async function start() {
    const base = structuredClone(cv);
    const draft = structuredClone(cv);
    let skills: SkillGroup[] | null = null;
    const tasks: AiTask[] = [];
    if (parts.experience)
      for (const e of jobs) {
        const name = entryName(e.role, e.company, "Untitled job");
        tasks.push({
          id: `exp.${e.id}`,
          label: name,
          doing: `Rewriting ${name}`,
          run: async () => {
            const r = await call<{ bullets: string[] }>("/ai/improve-entry", { kind: "experience", title: e.role, organisation: e.company || undefined, bullets: clipLines(e.bullets, 20), stack: e.stack.slice(0, 600) || undefined, targetTitle, keywords });
            const lines = clipLines(r.bullets);
            if (lines.length) draft.experience = draft.experience.map((x) => (x.id === e.id ? { ...x, bullets: lines } : x));
          },
        });
      }
    if (parts.projects)
      for (const p of projects) {
        const name = p.name.trim() || "Untitled project";
        tasks.push({
          id: `proj.${p.id}`,
          label: name,
          doing: `Rewriting ${name}`,
          run: async () => {
            const r = await call<{ bullets: string[] }>("/ai/improve-entry", { kind: "project", title: p.name, bullets: clipLines(p.bullets, 20), stack: p.stack.slice(0, 600) || undefined, targetTitle, keywords });
            const lines = clipLines(r.bullets);
            if (lines.length) draft.projects = draft.projects.map((x) => (x.id === p.id ? { ...x, bullets: lines } : x));
          },
        });
      }
    if (parts.skills && hasSkills)
      tasks.push({
        id: "skills",
        label: "Skills",
        doing: "Grouping your skills",
        run: async () => {
          const groups = cv.skills.filter((s) => s.items.trim()).slice(0, 30).map((s) => ({ category: s.category.slice(0, 80), items: s.items.slice(0, 2000) }));
          const r = await call<{ skills: { category: string; items: string }[] }>("/ai/organise-skills", { skills: groups, targetTitle });
          const next = regroupSkills(cv.skills, r.skills);
          if (next.length) skills = next;
        },
      });
    // Last, so it reads the improved lines and skills.
    if (parts.summary)
      tasks.push({
        id: "summary",
        label: "Summary",
        doing: "Writing your summary",
        run: async () => {
          const r = await call<{ options: string[] }>("/ai/write-summary", { cv: { ...draft, skills: skills ?? draft.skills }, targetTitle, keywords });
          const text = r.options[0]?.trim();
          if (text) draft.summary = text.slice(0, 3000);
        },
      });

    setPhase("run");
    const result = await runner.run(tasks);
    // Turned away before anything was written: show the gate instead of an empty review.
    if (result.gate && result.done.length === 0) {
      onClose();
      onGate(result.gate);
      return;
    }
    const next = { ...draft, skills: skills ?? draft.skills };
    setReview({ base, next, skills, failed: result.failed.length - (result.gate ? 1 : 0), skipped: result.skipped.length + (result.gate ? 1 : 0), gate: result.gate });
    setAccepted(new Set(reviewChanges({ base, next, skills }).map((c) => c.id)));
    setPhase("review");
  }

  const changes = useMemo(() => (review ? reviewChanges(review) : []), [review]);

  const result = useMemo(() => {
    if (!review) return null;
    const cv = applyChanges(review.base, review.next, changes, accepted);
    return accepted.has(SKILLS_CHANGE) && review.skills ? { ...cv, skills: review.skills } : cv;
  }, [review, changes, accepted]);

  const placeholders = countPlaceholders(changes.filter((c) => accepted.has(c.id)).map((c) => c.after));
  const before = review ? score(review.base) : 0;
  const after = result ? score(result) : 0;
  const match = useMemo(() => {
    if (!review || !result || advert.trim().length < 40) return null;
    return { before: matchJob(review.base, { title: targetTitle, description: advert }).score, after: matchJob(result, { title: targetTitle, description: advert }) };
  }, [review, result, advert, targetTitle]);

  const footer =
    phase === "setup" ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" icon="sparkle" disabled={cost === 0} onClick={() => void start()}>
          Optimise ({cost} {cost === 1 ? "credit" : "credits"})
        </Button>
      </>
    ) : phase === "review" ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Discard
        </Button>
        <Button
          variant="primary"
          icon="check"
          disabled={accepted.size === 0}
          onClick={() => {
            if (result) onApply(result, accepted.size);
            onClose();
          }}
        >
          Apply {accepted.size} {accepted.size === 1 ? "change" : "changes"}
        </Button>
      </>
    ) : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Optimise your CV with AI"
      description={
        phase === "review"
          ? "Untick anything you don't want. Your CV changes only when you apply, and you can undo it."
          : "AI rewrites what's already on your CV as clear, ATS-friendly lines. It keeps your facts and numbers and never adds experience you don't have."
      }
      footer={footer}
    >
      {phase === "setup" && (
        <div className="flex flex-col gap-5">
          <TextField label="Target job title" hint="The wording leans towards this role." value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Frontend Developer" />
          <TextArea
            label="Job advert"
            optional
            rows={4}
            maxLength={8000}
            value={advert}
            onChange={(e) => setAdvert(e.target.value)}
            hint={title.trim() ? "Used to show how well the result matches the job." : "We take the job title from its first line, and show how well the result matches."}
            placeholder="Paste the job advert"
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="cvb-label mb-2">What to optimise</legend>
            <Checkbox label="Summary" description="A new summary from your experience and skills." checked={parts.summary} onChange={(e) => setParts((p) => ({ ...p, summary: e.target.checked }))} />
            <Checkbox
              label="Experience lines"
              description={jobs.length ? `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} with lines to rewrite.` : "No job lines to rewrite yet."}
              disabled={!jobs.length}
              checked={parts.experience && jobs.length > 0}
              onChange={(e) => setParts((p) => ({ ...p, experience: e.target.checked }))}
            />
            <Checkbox
              label="Project lines"
              description={projects.length ? `${projects.length} ${projects.length === 1 ? "project" : "projects"} with lines to rewrite.` : "No project lines to rewrite yet."}
              disabled={!projects.length}
              checked={parts.projects && projects.length > 0}
              onChange={(e) => setParts((p) => ({ ...p, projects: e.target.checked }))}
            />
            <Checkbox
              label="Skills grouping"
              description={hasSkills ? "Sorted into clear groups. Nothing is added." : "No skills to group yet."}
              disabled={!hasSkills}
              checked={parts.skills && hasSkills}
              onChange={(e) => setParts((p) => ({ ...p, skills: e.target.checked }))}
            />
          </fieldset>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
            <Icon name="sparkle" size={16} className="text-brand-ink" />
            <span>
              Uses <strong className="cvb-num text-ink">{cost}</strong> {cost === 1 ? "credit" : "credits"}, one per part
              {creditsLeft !== undefined && (
                <>
                  {" "}
                  · you have <span className="cvb-num">{creditsLeft}</span>
                </>
              )}
            </span>
          </p>
          {creditsLeft !== undefined && cost > creditsLeft && (
            <Alert tone="warning" title="Not enough credits for every part">
              We&apos;ll stop when they run out and you can keep what&apos;s done. Untick some parts, or{" "}
              <a className="font-medium text-brand-ink underline" href="/pricing#credits">
                get more credits
              </a>
              .
            </Alert>
          )}
        </div>
      )}

      {phase === "run" && <AiStepList steps={runner.steps} running={runner.running} stopping={runner.stopping} onCancel={runner.cancel} />}

      {phase === "review" && review && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink-2">
            <span className="inline-flex items-center gap-2">
              <Icon name="target" size={18} className="text-ink-3" />
              ATS score
              <Badge className="cvb-num">{before}</Badge>
              <Icon name="arrow-right" size={16} label="to" />
              <Badge tone={after > before ? "success" : "neutral"} icon={after > before ? "chevron-up" : undefined} className="cvb-num">
                {after}
              </Badge>
            </span>
            {match && (
              <span className="inline-flex items-center gap-2">
                <Icon name="briefcase" size={18} className="text-ink-3" />
                Job match
                <Badge className="cvb-num">{match.before}%</Badge>
                <Icon name="arrow-right" size={16} label="to" />
                <Badge tone={match.after.score > match.before ? "success" : "neutral"} className="cvb-num">
                  {match.after.score}%
                </Badge>
              </span>
            )}
          </div>
          {review.gate && (
            <Alert
              tone="highlight"
              title={gateTitle(review.gate)}
              actions={
                <Button size="sm" variant="highlight" href={review.gate.kind === "credits" ? "/pricing#credits" : "/pricing"}>
                  {review.gate.kind === "credits" ? "Get more credits" : "See plans"}
                </Button>
              }
            >
              We stopped there. Here&apos;s what was done; the rest of your CV is unchanged.
            </Alert>
          )}
          {!review.gate && (review.failed > 0 || review.skipped > 0) && (
            <Alert tone="warning">
              {review.failed > 0 && `${review.failed} ${review.failed === 1 ? "part wasn't" : "parts weren't"} rewritten because the AI didn't answer. `}
              {review.skipped > 0 && `${review.skipped} ${review.skipped === 1 ? "part was" : "parts were"} skipped after you cancelled. `}
              Those parts stay as they are.
            </Alert>
          )}
          {placeholders > 0 && (
            <Alert tone="info" icon="lightbulb" title="Fill these in">
              <span className="cvb-num">{placeholders}</span> highlighted {placeholders === 1 ? "placeholder, like" : "placeholders, like"} <span className="cvb-placeholder">[number]</span>, mark facts only you know. Replace them with real figures after applying, or delete them.
            </Alert>
          )}
          {match && match.after.missing.length > 0 && (
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink">Still missing from the advert:</span> {match.after.missing.slice(0, 8).join(", ")}. Add them to your skills only if they&apos;re true.
            </p>
          )}
          {changes.length === 0 ? (
            <EmptyState icon="check-circle" title="No changes suggested" size="sm">
              Your CV already reads well. Nothing to apply.
            </EmptyState>
          ) : (
            <ChangeReview changes={changes} accepted={accepted} onAccepted={setAccepted} />
          )}
        </div>
      )}
    </Dialog>
  );
}
