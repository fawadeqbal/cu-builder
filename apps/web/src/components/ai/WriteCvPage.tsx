"use client";

import type { MeDto, ResumeDto } from "@cvb/contracts";
import type { CV } from "@cvb/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { Alert, Button, Card, Field, Icon, IconButton, markPlaceholders, PageHeader, SegmentedControl, TextArea, TextField } from "@cvb/ui";
import { useAiCall, useCredits } from "@/lib/ai";
import {
  assembleCv,
  blankEducation,
  blankJob,
  blankProject,
  clipLines,
  LEVELS,
  usedJobs,
  usedProjects,
  validateDraft,
  type CvDraft,
  type DraftEducation,
  type DraftJob,
  type DraftProject,
  type DraftResults,
  type Level,
} from "@/lib/ai-cv";
import { track } from "@/lib/analytics";
import { api, isApiError } from "@/lib/api";
import { gateTitle, type Gate } from "@/lib/plans";
import { keys, useResumes } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { AiStepList, useAiSteps, type AiTask } from "./AiSteps";

const MAX_JOBS = 6;
const MAX_PROJECTS = 4;
const MAX_EDUCATION = 6;
const fid = (key: string) => `cv-${key}`;
const entryName = (a: string, b: string, fallback: string) => [a.trim(), b.trim()].filter(Boolean).join(" at ") || fallback;

/** "Write a new CV with AI": a guided form, then AI writes the lines and summary from it. */
export function WriteCvPage() {
  return (
    <RequireAuth>
      {(me) => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <WriteCv me={me} />
        </div>
      )}
    </RequireAuth>
  );
}

type Outcome = { cv: CV; missed: string[]; gate: Gate | null; cancelled: boolean; resumeId?: string };

function WriteCv({ me }: { me: MeDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { call } = useAiCall();
  const credits = useCredits(true);
  const resumes = useResumes();
  const runner = useAiSteps();
  const [d, setD] = useState<CvDraft>(() => ({
    name: me.name.includes("@") ? "" : me.name,
    title: "",
    email: me.email,
    phone: "",
    location: "",
    link: "",
    level: "mid",
    jobs: [blankJob()],
    projects: [],
    education: [blankEducation()],
    skills: "",
    languages: "",
  }));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState<"form" | "run" | "done">("form");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [gate, setGate] = useState<Gate | null>(null);

  const limit = me.limits.resumes;
  const atLimit = limit !== null && (resumes.data?.items.length ?? 0) >= limit;
  const errors = validateDraft(d);
  const err = (key: string) => (submitted || touched.has(key) ? errors[key] : undefined);
  const blur = (key: string) => () => setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));
  const set = <K extends keyof CvDraft>(k: K, v: CvDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const early = d.level === "student" || d.level === "entry";

  const jobsWithNotes = usedJobs(d).filter((j) => j.notes.trim().length > 3);
  const projectsWithNotes = usedProjects(d).filter((p) => p.notes.trim().length > 3);
  const cost = jobsWithNotes.length + projectsWithNotes.length + (d.skills.trim() ? 1 : 0) + 1;

  async function save(cv: CV): Promise<string | null> {
    setSaving(true);
    setSaveError("");
    try {
      const r = await api.post<ResumeDto>("/resumes", { title: `${d.name.trim()} — ${d.title.trim()}`.slice(0, 120), data: cv });
      track("cv_started", { source: "ai" });
      void qc.invalidateQueries({ queryKey: keys.resumes });
      return r.id;
    } catch (e) {
      if (isApiError(e, "PLAN_REQUIRED")) setGate({ kind: "feature", feature: "resume.multiple" });
      else setSaveError(e instanceof Error ? e.message : "Couldn't save the CV");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setSubmitted(true);
    const first = Object.keys(errors)[0];
    if (first) {
      document.getElementById(fid(first))?.focus();
      return;
    }
    if (atLimit) return setGate({ kind: "feature", feature: "resume.multiple" });

    const targetTitle = d.title.trim().slice(0, 160);
    const results: DraftResults = { bullets: {}, skills: null, summary: null };
    const tasks: AiTask[] = [];
    for (const j of jobsWithNotes) {
      const name = entryName(j.role, j.company, "Job");
      tasks.push({
        id: j.key,
        label: name,
        doing: `Writing ${name}`,
        run: async () => {
          const r = await call<{ bullets: string[] }>("/ai/improve-entry", { kind: "experience", title: j.role.trim(), organisation: j.company.trim() || undefined, bullets: [], notes: j.notes.trim().slice(0, 4000), targetTitle });
          const lines = clipLines(r.bullets);
          if (lines.length) results.bullets[j.key] = lines;
        },
      });
    }
    for (const p of projectsWithNotes) {
      const name = p.name.trim() || "Project";
      tasks.push({
        id: p.key,
        label: name,
        doing: `Writing ${name}`,
        run: async () => {
          const r = await call<{ bullets: string[] }>("/ai/improve-entry", { kind: "project", title: p.name.trim(), bullets: [], notes: p.notes.trim().slice(0, 4000), targetTitle });
          const lines = clipLines(r.bullets);
          if (lines.length) results.bullets[p.key] = lines;
        },
      });
    }
    if (d.skills.trim())
      tasks.push({
        id: "skills",
        label: "Skills",
        doing: "Grouping your skills",
        run: async () => {
          const r = await call<{ skills: { category: string; items: string }[] }>("/ai/organise-skills", { skills: [], extra: d.skills.trim().slice(0, 2000), targetTitle });
          if (r.skills.some((g) => g.items.trim())) results.skills = r.skills;
        },
      });
    tasks.push({
      id: "summary",
      label: "Summary",
      doing: "Writing your summary",
      run: async () => {
        const r = await call<{ options: string[] }>("/ai/write-summary", { cv: assembleCv(d, results), targetTitle });
        results.summary = r.options[0]?.trim() || null;
      },
    });

    setPhase("run");
    setOutcome(null);
    window.scrollTo({ top: 0 });
    const res = await runner.run(tasks);
    const cv = assembleCv(d, results);
    const written = (id: string) => (id === "summary" ? results.summary !== null : id === "skills" ? results.skills !== null : Boolean(results.bullets[id]));
    const missed = tasks.filter((t) => !written(t.id)).map((t) => t.label);
    if (res.gate || res.cancelled) {
      // Stopped part way: the person decides whether to keep what's done.
      setOutcome({ cv, missed, gate: res.gate, cancelled: res.cancelled });
      setPhase("done");
      return;
    }
    const id = await save(cv);
    if (id && missed.length === 0) return router.push(`/edit/${id}`);
    setOutcome({ cv, missed, gate: null, cancelled: false, resumeId: id ?? undefined });
    setPhase("done");
  }

  async function keep() {
    if (!outcome) return;
    const id = await save(outcome.cv);
    if (id) router.push(`/edit/${id}`);
  }

  const updateList = <K extends "jobs" | "projects" | "education">(k: K, key: string, patch: Partial<CvDraft[K][number]>) =>
    setD((x) => ({ ...x, [k]: (x[k] as CvDraft[K][number][]).map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  const removeFrom = (k: "jobs" | "projects" | "education", key: string) => setD((x) => ({ ...x, [k]: (x[k] as { key: string }[]).filter((it) => it.key !== key) }));

  const jobsCard = (
    <Card
      title="Jobs"
      description={early ? "Internships, part-time work and volunteering count. Most recent first." : "Most recent first. Up to 6 here; you can add more in the editor."}
      footer={
        d.jobs.length < MAX_JOBS ? (
          <Button icon="plus" onClick={() => set("jobs", [...d.jobs, blankJob()])}>
            Add a job
          </Button>
        ) : undefined
      }
    >
      {d.jobs.length === 0 ? (
        <p className="text-sm text-ink-3">No jobs added. That&apos;s fine if you&apos;re just starting out.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {d.jobs.map((j, i) => (
            <JobFields key={j.key} n={i + 1} job={j} err={err} blur={blur} onChange={(patch) => updateList("jobs", j.key, patch)} onRemove={() => removeFrom("jobs", j.key)} />
          ))}
        </div>
      )}
    </Card>
  );

  const educationCard = (
    <Card
      title="Education"
      description="Degrees, diplomas or school. Add details like grades or modules if they help."
      footer={
        d.education.length < MAX_EDUCATION ? (
          <Button icon="plus" onClick={() => set("education", [...d.education, blankEducation()])}>
            Add education
          </Button>
        ) : undefined
      }
    >
      {d.education.length === 0 ? (
        <p className="text-sm text-ink-3">No education added.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {d.education.map((e, i) => (
            <EducationFields key={e.key} n={i + 1} edu={e} err={err} blur={blur} onChange={(patch) => updateList("education", e.key, patch)} onRemove={() => removeFrom("education", e.key)} />
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <main className="mx-auto flex w-full max-w-(--layout-md) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
      <PageHeader
        back={{ href: "/app", label: "My CVs" }}
        title="Write a new CV with AI"
        description="Tell us about your work in your own words. AI turns it into clear CV lines and a summary, then opens it in the editor."
      />

      {phase === "run" && (
        <Card title="Writing your CV" description="One part at a time. If the AI is slow or stops, you keep what's done.">
          <AiStepList steps={runner.steps} running={runner.running || saving} stopping={runner.stopping} onCancel={runner.running ? runner.cancel : undefined} />
          {saving && (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
              <span className="cvb-spinner" aria-hidden="true" /> Saving your CV…
            </p>
          )}
        </Card>
      )}

      {phase === "done" && outcome && (
        <Card
          title={outcome.resumeId ? "Your CV is ready" : outcome.gate ? "AI stopped part way" : outcome.cancelled ? "Stopped" : "Your CV is written"}
          description={
            outcome.resumeId
              ? "It's saved in My CVs. Check each part in the editor and fill in anything highlighted."
              : outcome.gate || outcome.cancelled
                ? "Your answers are kept. Create the CV with what's done, or go back and change something."
                : "It isn't saved yet. Try saving it again."
          }
          footer={
            outcome.resumeId ? (
              <Button variant="primary" iconEnd="arrow-right" href={`/edit/${outcome.resumeId}`}>
                Open your CV
              </Button>
            ) : (
              <>
                <Button variant="ghost" icon="arrow-left" onClick={() => setPhase("form")}>
                  Back to the form
                </Button>
                <Button variant="primary" loading={saving} onClick={() => void keep()}>
                  {outcome.gate || outcome.cancelled ? "Create CV with what's done" : "Save CV"}
                </Button>
              </>
            )
          }
        >
          <div className="flex flex-col gap-3">
            {outcome.gate && (
              <Alert
                tone="highlight"
                title={gateTitle(outcome.gate)}
                actions={
                  <Button size="sm" variant="highlight" href={outcome.gate.kind === "credits" ? "/pricing#credits" : "/pricing"}>
                    {outcome.gate.kind === "credits" ? "Get more credits" : "See plans"}
                  </Button>
                }
              />
            )}
            {outcome.missed.length > 0 ? (
              <Alert tone="warning" title="Not written by AI">
                <p>These parts use your own words as you typed them{outcome.missed.includes("Summary") ? ", and the summary is empty" : ""}:</p>
                <ul className="mt-1 list-disc ps-5">
                  {outcome.missed.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Alert tone="success">Every part was written by AI.</Alert>
            )}
            {saveError && <Alert tone="danger">{saveError}</Alert>}
          </div>
        </Card>
      )}

      {phase === "form" && (
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <Alert tone="info" icon="lightbulb" title="AI only uses what you type here">
            It won&apos;t invent jobs, numbers or skills. Where a figure would make a line stronger, it leaves a placeholder like {markPlaceholders("[number]")} for you to fill in.
          </Alert>
          {atLimit && (
            <Alert
              tone="warning"
              actions={
                <Button size="sm" variant="highlight" icon="sparkle" href="/pricing?plan=standard">
                  Upgrade
                </Button>
              }
            >
              Your plan keeps {limit} {limit === 1 ? "CV" : "CVs"} and you have {limit}. Upgrade, or delete one in My CVs, to write a new one.
            </Alert>
          )}

          <Card title="About you" description="Your name and the job you want are all we need to start.">
            <div className="flex flex-col gap-4">
              <div className="cvb-field-row">
                <TextField id={fid("name")} label="Full name" required autoComplete="name" maxLength={120} value={d.name} error={err("name")} onBlur={blur("name")} onChange={(e) => set("name", e.target.value)} />
                <TextField
                  id={fid("title")}
                  label="Target job title"
                  required
                  maxLength={160}
                  placeholder="Frontend Developer"
                  value={d.title}
                  error={err("title")}
                  onBlur={blur("title")}
                  onChange={(e) => set("title", e.target.value)}
                />
              </div>
              <div className="cvb-field-row">
                <TextField id={fid("email")} label="Email" type="email" autoComplete="email" dir="ltr" maxLength={160} value={d.email} error={err("email")} onBlur={blur("email")} onChange={(e) => set("email", e.target.value)} />
                <TextField id={fid("phone")} label="Phone" type="tel" autoComplete="tel" dir="ltr" maxLength={60} value={d.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="cvb-field-row">
                <TextField id={fid("location")} label="Location" placeholder="Lahore, Pakistan" maxLength={160} value={d.location} onChange={(e) => set("location", e.target.value)} />
                <TextField id={fid("link")} label="LinkedIn or website" dir="ltr" placeholder="linkedin.com/in/you" maxLength={240} value={d.link} onChange={(e) => set("link", e.target.value)} />
              </div>
              <Field label="Experience level" hint={early ? "We'll put your education first; projects help a lot." : undefined}>
                <SegmentedControl<Level>
                  label="Experience level"
                  block
                  value={d.level}
                  onChange={(level) => {
                    set("level", level);
                    // Students often have no jobs yet: start them with a project instead of an empty job.
                    if (level === "student" && d.projects.length === 0) set("projects", [blankProject()]);
                  }}
                  options={LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                />
              </Field>
            </div>
          </Card>

          {early ? (
            <>
              {educationCard}
              {jobsCard}
            </>
          ) : (
            <>
              {jobsCard}
              {educationCard}
            </>
          )}

          <Card
            title="Projects"
            description="Optional. Side projects, coursework or open source, up to 4."
            footer={
              d.projects.length < MAX_PROJECTS ? (
                <Button icon="plus" onClick={() => set("projects", [...d.projects, blankProject()])}>
                  Add a project
                </Button>
              ) : undefined
            }
          >
            {d.projects.length === 0 ? (
              <p className="text-sm text-ink-3">No projects added.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {d.projects.map((p, i) => (
                  <ProjectFields key={p.key} n={i + 1} project={p} err={err} blur={blur} onChange={(patch) => updateList("projects", p.key, patch)} onRemove={() => removeFrom("projects", p.key)} />
                ))}
              </div>
            )}
          </Card>

          <Card title="Skills and languages" description="List them however you like; AI sorts skills into groups and adds nothing new.">
            <div className="flex flex-col gap-4">
              <TextArea id={fid("skills")} label="Skills" rows={3} maxLength={2000} placeholder="React, Node.js, SQL, teamwork…" value={d.skills} onChange={(e) => set("skills", e.target.value)} />
              <TextField id={fid("languages")} label="Languages" optional maxLength={400} placeholder="English – fluent, Urdu – native" value={d.languages} onChange={(e) => set("languages", e.target.value)} />
            </div>
          </Card>

          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center">
            <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-ink-2">
              <Icon name="sparkle" size={16} className="mt-0.5 shrink-0 text-brand-ink" />
              <span>
                Uses about <strong className="cvb-num text-ink">{cost}</strong> {cost === 1 ? "credit" : "credits"}, one per job, project, skills list and summary
                {credits.data && (
                  <>
                    {" "}
                    · you have <span className="cvb-num">{credits.data.remaining}</span>
                  </>
                )}
                .
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" href="/app">
                Cancel
              </Button>
              <Button type="submit" variant="primary" icon="sparkle">
                Write my CV
              </Button>
            </div>
          </div>
          {submitted && Object.keys(errors).length > 0 && (
            <Alert tone="danger">
              {Object.keys(errors).length === 1 ? "One field needs" : `${Object.keys(errors).length} fields need`} your attention above.
            </Alert>
          )}
        </form>
      )}

      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
    </main>
  );
}

type FieldProps = { err: (key: string) => string | undefined; blur: (key: string) => () => void };

function Entry({ heading, onRemove, removeLabel, children }: { heading: string; onRemove: () => void; removeLabel: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <h4 id={id} className="min-w-0 flex-1 text-sm font-semibold text-ink">
          {heading}
        </h4>
        <IconButton icon="trash" size="sm" label={removeLabel} onClick={onRemove} />
      </div>
      {children}
    </div>
  );
}

function JobFields({ n, job, onChange, onRemove, err, blur }: FieldProps & { n: number; job: DraftJob; onChange: (p: Partial<DraftJob>) => void; onRemove: () => void }) {
  const k = `job-${job.key}`;
  return (
    <Entry heading={`Job ${n}`} onRemove={onRemove} removeLabel={`Remove job ${n}`}>
      <div className="cvb-field-row">
        <TextField id={fid(`${k}-role`)} label="Job title" maxLength={160} value={job.role} error={err(`${k}-role`)} onBlur={blur(`${k}-role`)} onChange={(e) => onChange({ role: e.target.value })} />
        <TextField id={fid(`${k}-company`)} label="Company" maxLength={160} value={job.company} onChange={(e) => onChange({ company: e.target.value })} />
      </div>
      <div className="cvb-field-row">
        <TextField id={fid(`${k}-location`)} label="Location" maxLength={160} value={job.location} onChange={(e) => onChange({ location: e.target.value })} />
        <TextField id={fid(`${k}-date`)} label="Dates" placeholder="Mar 2022 – now" maxLength={80} value={job.date} onChange={(e) => onChange({ date: e.target.value })} />
      </div>
      <TextArea
        id={fid(`${k}-notes`)}
        label="What did you do?"
        hint="Rough notes are fine: tasks, tools, results, any numbers you know. One idea per line helps."
        rows={4}
        maxLength={4000}
        placeholder={"built the checkout in React\nfixed slow pages\nhelped 2 new developers"}
        value={job.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
      />
    </Entry>
  );
}

function ProjectFields({ n, project, onChange, onRemove, err, blur }: FieldProps & { n: number; project: DraftProject; onChange: (p: Partial<DraftProject>) => void; onRemove: () => void }) {
  const k = `project-${project.key}`;
  return (
    <Entry heading={`Project ${n}`} onRemove={onRemove} removeLabel={`Remove project ${n}`}>
      <div className="cvb-field-row">
        <TextField id={fid(`${k}-name`)} label="Name" maxLength={160} value={project.name} error={err(`${k}-name`)} onBlur={blur(`${k}-name`)} onChange={(e) => onChange({ name: e.target.value })} />
        <TextField id={fid(`${k}-link`)} label="Link" optional dir="ltr" placeholder="github.com/you/project" maxLength={240} value={project.link} onChange={(e) => onChange({ link: e.target.value })} />
      </div>
      <TextArea
        id={fid(`${k}-notes`)}
        label="What is it, and what did you do?"
        hint="Rough notes are fine."
        rows={3}
        maxLength={4000}
        value={project.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
      />
    </Entry>
  );
}

function EducationFields({ n, edu, onChange, onRemove, err, blur }: FieldProps & { n: number; edu: DraftEducation; onChange: (p: Partial<DraftEducation>) => void; onRemove: () => void }) {
  const k = `edu-${edu.key}`;
  return (
    <Entry heading={`Education ${n}`} onRemove={onRemove} removeLabel={`Remove education ${n}`}>
      <div className="cvb-field-row">
        <TextField id={fid(`${k}-degree`)} label="Degree or qualification" maxLength={160} placeholder="BSc Computer Science" value={edu.degree} error={err(`${k}-degree`)} onBlur={blur(`${k}-degree`)} onChange={(e) => onChange({ degree: e.target.value })} />
        <TextField id={fid(`${k}-school`)} label="School" maxLength={160} value={edu.school} onChange={(e) => onChange({ school: e.target.value })} />
      </div>
      <div className="cvb-field-row">
        <TextField id={fid(`${k}-date`)} label="Dates" placeholder="2018 – 2022" maxLength={80} value={edu.date} onChange={(e) => onChange({ date: e.target.value })} />
        <TextField id={fid(`${k}-details`)} label="Details" optional maxLength={400} placeholder="Grade, modules, awards" value={edu.details} onChange={(e) => onChange({ details: e.target.value })} />
      </div>
    </Entry>
  );
}
