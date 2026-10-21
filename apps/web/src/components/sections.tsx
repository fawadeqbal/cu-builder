"use client";

import { newId } from "@cvb/domain";
import type { CV, ListKey, Personal } from "@cvb/domain";
import { AddButton, ItemCard, LinesField, Panel, TextArea, TextField } from "./fields";

export type SectionProps = { cv: CV; onChange: (cv: CV) => void };

/** Shared add / update / remove / move helpers for the list sections. */
function useList(cv: CV, onChange: (cv: CV) => void) {
  function set<K extends ListKey>(list: K, id: string, patch: Partial<CV[K][number]>) {
    onChange({
      ...cv,
      [list]: (cv[list] as CV[K][number][]).map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }
  function add<K extends ListKey>(list: K, item: CV[K][number]) {
    onChange({ ...cv, [list]: [...cv[list], item] });
  }
  function card(list: ListKey, index: number, title: string, id: string) {
    return {
      title: title || "Untitled",
      index,
      total: cv[list].length,
      onMove: (dir: -1 | 1) => {
        const items = [...(cv[list] as { id: string }[])];
        const target = index + dir;
        if (target < 0 || target >= items.length) return;
        [items[index], items[target]] = [items[target], items[index]];
        onChange({ ...cv, [list]: items });
      },
      onRemove: () =>
        onChange({ ...cv, [list]: (cv[list] as { id: string }[]).filter((i) => i.id !== id) }),
    };
  }
  return { set, add, card };
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-4 py-8 text-center text-sm text-stone-500">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Personal */

export type PersonalErrors = Partial<Record<keyof Personal, string>>;

export function PersonalSection({ cv, onChange, errors = {} }: SectionProps & { errors?: PersonalErrors }) {
  const p = cv.personal;
  const set = (key: keyof Personal) => (value: string) =>
    onChange({ ...cv, personal: { ...cv.personal, [key]: value } });

  return (
    <div className="flex flex-col gap-4">
      <Panel title="About you" description="Shown at the top of your CV.">
        <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2">
          <TextField label="Full name" required value={p.name} onChange={set("name")} placeholder="Sara Ahmed" error={errors.name} />
          <TextField
            label="Job title you want"
            required
            value={p.headline}
            onChange={set("headline")}
            placeholder="Full Stack Developer"
            error={errors.headline}
          />
        </div>
        <TextField
          label="Key skills line (optional)"
          value={p.tagline}
          onChange={set("tagline")}
          placeholder="React · Node.js · PostgreSQL · Docker"
        />
      </Panel>

      <Panel title="Contact" description="How employers reach you. Only email is required.">
        <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2">
          <TextField
            label="Email"
            type="email"
            required
            value={p.email}
            onChange={set("email")}
            placeholder="you@example.com"
            error={errors.email}
          />
          <TextField label="Phone" type="tel" value={p.phone} onChange={set("phone")} placeholder="+92 300 1234567" />
          <TextField label="City, country" value={p.location} onChange={set("location")} placeholder="Lahore, Pakistan" />
          <TextField label="Website / portfolio" value={p.website} onChange={set("website")} placeholder="yourname.dev" />
          <TextField label="LinkedIn" value={p.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/you" />
          <TextField label="GitHub" value={p.github} onChange={set("github")} placeholder="github.com/you" />
        </div>
        <TextField
          label="Anything else (optional)"
          value={p.extra}
          onChange={set("extra")}
          placeholder="Nationality, visa status, driving licence…"
        />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ Summary */

const SUMMARY_STARTERS = [
  "Full stack developer with X years of experience building …",
  "Frontend developer who turns designs into fast, accessible web apps with …",
  "Recent Software Engineering graduate skilled in …",
];

export function SummarySection({ cv, onChange }: SectionProps) {
  const words = cv.summary.trim() ? cv.summary.trim().split(/\s+/).length : 0;
  const tone =
    words === 0 ? "text-stone-400" : words < 30 ? "text-amber-600" : words <= 90 ? "text-emerald-600" : "text-amber-600";
  const label =
    words === 0 ? "Aim for 40–80 words" : words < 30 ? "A little short" : words <= 90 ? "Good length" : "Try to shorten it";

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <TextArea
          label="About you"
          rows={7}
          value={cv.summary}
          placeholder="Who you are, what you build or do, and what you are best at."
          onChange={(v) => onChange({ ...cv, summary: v })}
        />
        <div className="flex items-center gap-3 text-xs">
          <span className={`font-medium ${tone}`}>{label}</span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
            <span
              className={`block h-full rounded-full transition-[width] duration-300 ${words >= 30 && words <= 90 ? "bg-emerald-500" : words ? "bg-amber-400" : ""}`}
              style={{ width: `${Math.min(100, (words / 80) * 100)}%` }}
            />
          </span>
          <span className="tabular-nums text-stone-500">{words} words</span>
        </div>
      </Panel>
      {!cv.summary.trim() && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-stone-500">Need a start? Tap one and edit it:</span>
          {SUMMARY_STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...cv, summary: s })}
              className="rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-left text-sm text-stone-600 shadow-xs transition hover:border-brand/50 hover:bg-brand/[0.03] hover:text-brand"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Experience */

export function ExperienceSection({ cv, onChange }: SectionProps) {
  const { set, add, card } = useList(cv, onChange);
  const addJob = () =>
    add("experience", { id: newId("exp"), role: "", company: "", location: "", date: "", bullets: [], stack: "" });

  return (
    <div className="flex flex-col gap-3">
      {cv.experience.length === 0 && (
        <Empty>
          No jobs added yet. Internships, part-time and freelance work all count.
          <br />
          No experience yet? Skip this step and add projects instead.
        </Empty>
      )}
      {cv.experience.map((e, i) => (
        <ItemCard key={e.id} {...card("experience", i, [e.role, e.company].filter(Boolean).join(" · "), e.id)}>
          <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2">
            <TextField label="Job title" value={e.role} placeholder="Frontend Developer" onChange={(v) => set("experience", e.id, { role: v })} />
            <TextField label="Company" value={e.company} placeholder="Bright Labs" onChange={(v) => set("experience", e.id, { company: v })} />
            <TextField label="Location" value={e.location} placeholder="Lahore or Remote" onChange={(v) => set("experience", e.id, { location: v })} />
            <TextField label="Dates" value={e.date} placeholder="Jan 2024 – Present" onChange={(v) => set("experience", e.id, { date: v })} />
          </div>
          <LinesField
            label="What you did and achieved"
            rows={5}
            value={e.bullets}
            placeholder={"Built a booking dashboard used by 120 clinics\nCut page load time from 4 s to 1 s"}
            onChange={(v) => set("experience", e.id, { bullets: v })}
          />
          <TextField
            label="Tools used (optional)"
            value={e.stack}
            placeholder="React, Node.js, PostgreSQL"
            onChange={(v) => set("experience", e.id, { stack: v })}
          />
        </ItemCard>
      ))}
      <AddButton onClick={addJob}>{cv.experience.length ? "Add another job" : "Add a job"}</AddButton>
    </div>
  );
}

/* ------------------------------------------------------------------ Education */

export function EducationSection({ cv, onChange }: SectionProps) {
  const { set, add, card } = useList(cv, onChange);
  return (
    <div className="flex flex-col gap-3">
      {cv.education.length === 0 && <Empty>Add your degree, diploma or school.</Empty>}
      {cv.education.map((ed, i) => (
        <ItemCard key={ed.id} {...card("education", i, ed.degree, ed.id)}>
          <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2">
            <TextField label="Degree" value={ed.degree} placeholder="BS Computer Science" onChange={(v) => set("education", ed.id, { degree: v })} />
            <TextField label="School / university" value={ed.school} placeholder="University of the Punjab" onChange={(v) => set("education", ed.id, { school: v })} />
            <TextField label="Dates" value={ed.date} placeholder="2018 – 2022" onChange={(v) => set("education", ed.id, { date: v })} />
            <TextField label="Details (optional)" value={ed.details} placeholder="City · CGPA 3.4 / 4.0" onChange={(v) => set("education", ed.id, { details: v })} />
          </div>
        </ItemCard>
      ))}
      <AddButton onClick={() => add("education", { id: newId("edu"), degree: "", school: "", date: "", details: "" })}>
        {cv.education.length ? "Add another" : "Add education"}
      </AddButton>
    </div>
  );
}

/* ------------------------------------------------------------------ Skills */

const SKILL_GROUPS = ["Frontend", "Backend", "Databases", "DevOps & tools", "Mobile", "Design", "Soft skills"];

export function SkillsSection({ cv, onChange }: SectionProps) {
  const { set, add, card } = useList(cv, onChange);
  const used = new Set(cv.skills.map((s) => s.category.trim().toLowerCase()));
  const suggestions = SKILL_GROUPS.filter((g) => !used.has(g.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-stone-500">Quick add a group:</span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => add("skills", { id: newId("skill"), category: g, items: "" })}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-xs transition hover:border-brand/50 hover:text-brand"
              >
                + {g}
              </button>
            ))}
          </div>
        </div>
      )}
      {cv.skills.map((s, i) => (
        <ItemCard key={s.id} {...card("skills", i, s.category, s.id)}>
          <TextField label="Group name" value={s.category} placeholder="Frontend" onChange={(v) => set("skills", s.id, { category: v })} />
          <TextArea
            label="Skills"
            hint="separate with commas"
            rows={2}
            value={s.items}
            placeholder="React, Next.js, TypeScript, Tailwind CSS"
            onChange={(v) => set("skills", s.id, { items: v })}
          />
        </ItemCard>
      ))}
      <AddButton onClick={() => add("skills", { id: newId("skill"), category: "", items: "" })}>Add a custom group</AddButton>
    </div>
  );
}

/* ------------------------------------------------------------------ Projects */

export function ProjectsSection({ cv, onChange }: SectionProps) {
  const { set, add, card } = useList(cv, onChange);
  return (
    <div className="flex flex-col gap-3">
      {cv.projects.length === 0 && (
        <Empty>Projects show what you can build. Add personal, university or freelance projects.</Empty>
      )}
      {cv.projects.map((p, i) => (
        <ItemCard key={p.id} {...card("projects", i, p.name, p.id)}>
          <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-[1fr_9rem]">
            <TextField label="Project name" value={p.name} placeholder="TaskFlow — Team Task Board" onChange={(v) => set("projects", p.id, { name: v })} />
            <TextField label="Year" value={p.date} placeholder="2025" onChange={(v) => set("projects", p.id, { date: v })} />
          </div>
          <LinesField
            label="Links"
            rows={2}
            value={p.links}
            placeholder={"https://github.com/you/project\nhttps://project.live"}
            onChange={(v) => set("projects", p.id, { links: v })}
          />
          <LinesField
            label="What it does"
            rows={4}
            value={p.bullets}
            placeholder={"Kanban board with drag and drop\nJWT login and REST API"}
            onChange={(v) => set("projects", p.id, { bullets: v })}
          />
          <TextField label="Tools used (optional)" value={p.stack} placeholder="React, Express, MongoDB" onChange={(v) => set("projects", p.id, { stack: v })} />
        </ItemCard>
      ))}
      <AddButton onClick={() => add("projects", { id: newId("proj"), name: "", date: "", links: [], bullets: [], stack: "" })}>
        {cv.projects.length ? "Add another project" : "Add a project"}
      </AddButton>
    </div>
  );
}

/* ------------------------------------------------------------------ Extras */

export function ExtrasSection({ cv, onChange }: SectionProps) {
  const { set, add, card } = useList(cv, onChange);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-stone-900">Languages</h3>
        {cv.languages.map((l, i) => (
          <ItemCard key={l.id} {...card("languages", i, l.name, l.id)}>
            <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2">
              <TextField label="Language" value={l.name} placeholder="English" onChange={(v) => set("languages", l.id, { name: v })} />
              <TextField label="Level" value={l.level} placeholder="Native, Fluent, Basic…" onChange={(v) => set("languages", l.id, { level: v })} />
            </div>
          </ItemCard>
        ))}
        <AddButton onClick={() => add("languages", { id: newId("lang"), name: "", level: "" })}>Add a language</AddButton>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-stone-800">Certificates</h3>
        {cv.certificates.map((c, i) => (
          <ItemCard key={c.id} {...card("certificates", i, c.name, c.id)}>
            <TextField label="Certificate" value={c.name} placeholder="AWS Cloud Practitioner" onChange={(v) => set("certificates", c.id, { name: v })} />
            <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-[1fr_6rem]">
              <TextField label="Issued by" value={c.issuer} placeholder="Coursera" onChange={(v) => set("certificates", c.id, { issuer: v })} />
              <TextField label="Year" value={c.year} placeholder="2024" onChange={(v) => set("certificates", c.id, { year: v })} />
            </div>
            <TextField label="Link (optional)" value={c.url} onChange={(v) => set("certificates", c.id, { url: v })} />
          </ItemCard>
        ))}
        <AddButton onClick={() => add("certificates", { id: newId("cert"), name: "", issuer: "", year: "", url: "" })}>
          Add a certificate
        </AddButton>
      </div>
    </div>
  );
}
