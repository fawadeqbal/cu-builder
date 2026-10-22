"use client";

import { useEffect } from "react";
import { DETAIL_LABELS, newId, regionRules, type DetailKey } from "@cvb/domain";
import { Chip, EmptyState, Icon, ProgressBar } from "@cvb/ui";
import { useT } from "@/lib/i18n";
import type { CV, Education, Experience, ListKey, Personal, Project } from "@cvb/domain";
import { BulletsAssist } from "./ai/BulletsAssist";
import { SkillsAssist } from "./ai/SkillsAssist";
import { SummaryAssist } from "./ai/SummaryAssist";
import { PhotoField } from "./cv/PhotoField";
import { LinesField, Panel, TextArea, TextField } from "./fields";
import { BulletView, EditableCard, EditingScope, EntryList, TagView, TextView, ViewRows, moveItem, useEditingScope } from "./form/editable";

/*
 * The editor steps. Each part of a step is a read-only card with an Edit button; one part is
 * open at a time and changes show in the preview as you type.
 */

export type SectionProps = { cv: CV; onChange: (cv: CV) => void };

const blank = (...values: (string | string[])[]) => values.every((v) => (Array.isArray(v) ? v.every((x) => !x.trim()) : !v.trim()));
const joinDot = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(" · ");

/** Update / add / remove / move helpers for the list sections. */
function useList(cv: CV, onChange: (cv: CV) => void) {
  function set<K extends ListKey>(list: K, id: string, patch: Partial<CV[K][number]>) {
    onChange({ ...cv, [list]: (cv[list] as CV[K][number][]).map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  }
  function add<K extends ListKey>(list: K, item: CV[K][number]): string {
    onChange({ ...cv, [list]: [...cv[list], item] });
    return item.id;
  }
  const remove = (list: ListKey) => (id: string) => onChange({ ...cv, [list]: (cv[list] as { id: string }[]).filter((i) => i.id !== id) });
  const move = (list: ListKey) => (index: number, dir: -1 | 1) => onChange({ ...cv, [list]: moveItem(cv[list] as { id: string }[], index, dir) });
  return { set, add, remove, move };
}

/** Shown in place of an empty list, above its "Add" button. */
function Empty({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <EmptyState icon={icon} title={title} className="rounded-lg border border-dashed border-line-strong px-4 py-8 [&_.cvb-h2]:text-[17px] [&_.cvb-h2]:leading-6">
      {children}
    </EmptyState>
  );
}

/** Two fields side by side when there's room. */
function Row({ children, wide }: { children: React.ReactNode; wide?: string }) {
  return <div className={`grid grid-cols-1 gap-4 ${wide ?? "@min-[520px]:grid-cols-2"}`}>{children}</div>;
}

/* ------------------------------------------------------------------ Personal */

export type PersonalErrors = Partial<Record<keyof Personal, string>>;

export function PersonalSection(props: SectionProps & { errors?: PersonalErrors }) {
  const p = props.cv.personal;
  // A new CV opens on the first part that still needs something.
  const initial = !p.name.trim() || !p.headline.trim() ? "about" : !p.email.trim() ? "contact" : null;
  return (
    <EditingScope initial={initial}>
      <PersonalCards {...props} />
    </EditingScope>
  );
}

function PersonalCards({ cv, onChange, errors = {} }: SectionProps & { errors?: PersonalErrors }) {
  const t = useT();
  const scope = useEditingScope();
  const p = cv.personal;
  const set = (key: keyof Personal) => (value: string) => onChange({ ...cv, personal: { ...cv.personal, [key]: value } });

  const aboutInvalid = Boolean(errors.name || errors.headline);
  const contactInvalid = Boolean(errors.email);
  const firstError = aboutInvalid ? "about" : contactInvalid ? "contact" : null;
  const { open } = scope;
  // "Continue" with a missing required field opens the part that has it.
  useEffect(() => {
    if (firstError) open(firstError);
  }, [firstError, open]);

  return (
    <div className="flex flex-col gap-3">
      <EditableCard
        id="about"
        icon="user"
        title={t("f.aboutYou")}
        subtitle={t("f.aboutYouDesc")}
        invalid={aboutInvalid}
        empty={blank(p.name, p.headline, p.tagline)}
        view={
          <ViewRows
            showEmpty
            rows={[
              { label: t("f.fullName"), value: p.name },
              { label: t("f.jobTitleWanted"), value: p.headline },
              ...(p.tagline.trim() ? [{ label: t("f.skillsLine"), value: p.tagline }] : []),
            ]}
          />
        }
      >
        <Row>
          <TextField label={t("f.fullName")} required value={p.name} onChange={set("name")} placeholder="Sara Ahmed" error={errors.name} />
          <TextField label={t("f.jobTitleWanted")} required value={p.headline} onChange={set("headline")} placeholder="Full Stack Developer" error={errors.headline} />
        </Row>
        <TextField label={t("f.skillsLine")} value={p.tagline} onChange={set("tagline")} placeholder="React · Node.js · PostgreSQL · Docker" />
      </EditableCard>

      <EditableCard
        id="contact"
        icon="mail"
        title={t("f.contact")}
        subtitle={t("f.contactDesc")}
        invalid={contactInvalid}
        empty={blank(p.email, p.phone, p.location, p.website, p.linkedin, p.github, p.extra)}
        view={
          <ViewRows
            rows={[
              { label: t("f.email"), value: p.email || "", icon: "mail", ltr: true },
              { label: t("f.phone"), value: p.phone, icon: "phone", ltr: true },
              { label: t("f.cityCountry"), value: p.location, icon: "map-pin" },
              { label: t("f.website"), value: p.website, icon: "globe", ltr: true },
              { label: t("f.linkedin"), value: p.linkedin, icon: "link", ltr: true },
              { label: t("f.github"), value: p.github, icon: "link", ltr: true },
              { label: t("f.extra"), value: p.extra, icon: "info" },
            ]}
          />
        }
      >
        <Row>
          <TextField label={t("f.email")} type="email" required value={p.email} onChange={set("email")} placeholder="you@example.com" error={errors.email} />
          <TextField label={t("f.phone")} type="tel" value={p.phone} onChange={set("phone")} placeholder="+92 300 1234567" />
          <TextField label={t("f.cityCountry")} value={p.location} onChange={set("location")} placeholder="Lahore, Pakistan" />
          <TextField label={t("f.website")} value={p.website} onChange={set("website")} placeholder="yourname.dev" />
          <TextField label={t("f.linkedin")} value={p.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/you" />
          <TextField label={t("f.github")} value={p.github} onChange={set("github")} placeholder="github.com/you" />
        </Row>
        <TextField label={t("f.extra")} value={p.extra} onChange={set("extra")} placeholder="Nationality, visa status, driving licence…" />
      </EditableCard>

      <Panel title={t("photo.title")} description={t("photo.desc")}>
        <PhotoField cv={cv} onChange={onChange} />
      </Panel>

      <DetailsCard cv={cv} onChange={onChange} />
    </div>
  );
}

/** Date of birth, nationality, visa status… The fields the CV's country format uses come first. */
function DetailsCard({ cv, onChange }: SectionProps) {
  const t = useT();
  const region = cv.settings.region;
  // International format: every field. Others: just the fields the region expects.
  const keys = region === "default" ? (Object.keys(DETAIL_LABELS) as DetailKey[]) : regionRules(region).details;
  if (!keys.length) return null;
  const set = (key: DetailKey) => (value: string) => onChange({ ...cv, details: { ...cv.details, [key]: value } });
  const desc = region === "default" ? t("details.descAll") : t("details.desc", { region: t(`region.${region}`) });
  return (
    <EditableCard
      id="details"
      icon="flag"
      title={t("details.title")}
      subtitle={desc}
      empty={keys.every((k) => !cv.details[k].trim())}
      view={<ViewRows rows={keys.map((k) => ({ label: t(`details.${k}`), value: cv.details[k] }))} />}
    >
      <Row>
        {keys.map((k) => (
          <TextField key={k} label={t(`details.${k}`)} value={cv.details[k]} onChange={set(k)} />
        ))}
      </Row>
    </EditableCard>
  );
}

/* ------------------------------------------------------------------ Summary */

const SUMMARY_STARTERS = [
  "Full stack developer with X years of experience building …",
  "Frontend developer who turns designs into fast, accessible web apps with …",
  "Recent Software Engineering graduate skilled in …",
];

export function SummarySection(props: SectionProps) {
  return (
    <EditingScope initial={props.cv.summary.trim() ? null : "summary"}>
      <SummaryCard {...props} />
    </EditingScope>
  );
}

function SummaryCard({ cv, onChange }: SectionProps) {
  const t = useT();
  const words = cv.summary.trim() ? cv.summary.trim().split(/\s+/).length : 0;
  const good = words >= 30 && words <= 90;
  const tone = words === 0 ? "brand" : good ? "success" : "warning";
  const label = words === 0 ? "Aim for 40–80 words" : words < 30 ? "A little short" : good ? "Good length" : "Try to shorten it";
  const status = (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${good ? "text-success" : words ? "text-warning" : "text-ink-3"}`}>
      {good ? <Icon name="check-circle" size={14} /> : words > 0 && <Icon name="alert-triangle" size={14} />}
      {label}
    </span>
  );

  return (
    <EditableCard
      id="summary"
      icon="list"
      title={t("step.summary.short")}
      subtitle={words ? `${words} words` : undefined}
      empty={!words}
      emptyText="Two to four sentences: who you are, what you do and what you are best at."
      view={
        <div className="flex flex-col gap-2">
          <TextView text={cv.summary} lines={5} />
          {status}
        </div>
      }
    >
      <TextArea
        label={t("f.summary")}
        rows={7}
        value={cv.summary}
        placeholder="Who you are, what you build or do, and what you are best at."
        onChange={(v) => onChange({ ...cv, summary: v })}
      />
      <SummaryAssist cv={cv} onChange={(summary) => onChange({ ...cv, summary })} />
      <ProgressBar value={Math.min(words, 80)} max={80} tone={tone} label={status} valueLabel={<span className="text-xs text-ink-3">{words} words</span>} />
      {!cv.summary.trim() && (
        <div className="flex flex-col gap-2">
          <span className="cvb-label">{t("f.summaryStarters")}</span>
          {SUMMARY_STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...cv, summary: s })}
              className="rounded-md border border-line bg-surface px-3.5 py-2.5 text-start text-sm text-ink-2 transition hover:border-brand hover:bg-brand-soft hover:text-ink focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </EditableCard>
  );
}

/* ------------------------------------------------------------------ Experience */

export function ExperienceSection(props: SectionProps) {
  return (
    <EditingScope>
      <ExperienceList {...props} />
    </EditingScope>
  );
}

function ExperienceList({ cv, onChange }: SectionProps) {
  const t = useT();
  const { set, add, remove, move } = useList(cv, onChange);
  return (
    <EntryList<Experience>
      list="experience"
      items={cv.experience}
      getId={(e) => e.id}
      title={(e) => [e.role, e.company].map((s) => s.trim()).filter(Boolean).join(" at ") || t("f.untitled")}
      subtitle={(e) => joinDot(e.date, e.location) || undefined}
      view={(e) =>
        e.bullets.some((b) => b.trim()) || e.stack.trim() ? (
          <div className="flex flex-col gap-2">
            <BulletView lines={e.bullets} />
            {e.stack.trim() && <TagView text={e.stack} />}
          </div>
        ) : (
          <p className="text-sm text-ink-3">No lines yet. Add what you did and achieved.</p>
        )
      }
      isBlank={(e) => blank(e.role, e.company, e.location, e.date, e.bullets, e.stack)}
      onAdd={() => add("experience", { id: newId("exp"), role: "", company: "", location: "", date: "", bullets: [], stack: "" })}
      addLabel={cv.experience.length ? "Add another job" : "Add a job"}
      onMove={move("experience")}
      onRemove={remove("experience")}
      noun="job"
      empty={
        <Empty icon="briefcase" title="No jobs added yet.">
          Internships, part-time and freelance work all count.
          <br />
          No experience yet? Skip this step and add projects instead.
        </Empty>
      }
      edit={(e) => (
        <>
          <Row>
            <TextField label={t("f.jobTitle")} value={e.role} placeholder="Frontend Developer" onChange={(v) => set("experience", e.id, { role: v })} />
            <TextField label={t("f.company")} value={e.company} placeholder="Bright Labs" onChange={(v) => set("experience", e.id, { company: v })} />
            <TextField label={t("f.location")} value={e.location} placeholder="Lahore or Remote" onChange={(v) => set("experience", e.id, { location: v })} />
            <TextField label={t("f.dates")} value={e.date} placeholder="Jan 2024 – Present" onChange={(v) => set("experience", e.id, { date: v })} />
          </Row>
          <LinesField
            label={t("f.achievements")}
            rows={5}
            value={e.bullets}
            placeholder={"Built a booking dashboard used by 120 clinics\nCut page load time from 4 s to 1 s"}
            onChange={(v) => set("experience", e.id, { bullets: v })}
          />
          <div className="-mt-2">
            <BulletsAssist bullets={e.bullets} role={e.role} company={e.company} onChange={(v) => set("experience", e.id, { bullets: v })} />
          </div>
          <TextField label={t("f.tools")} value={e.stack} placeholder="React, Node.js, PostgreSQL" onChange={(v) => set("experience", e.id, { stack: v })} />
        </>
      )}
    />
  );
}

/* ------------------------------------------------------------------ Education */

export function EducationSection(props: SectionProps) {
  return (
    <EditingScope>
      <EducationList {...props} />
    </EditingScope>
  );
}

function EducationList({ cv, onChange }: SectionProps) {
  const t = useT();
  const { set, add, remove, move } = useList(cv, onChange);
  return (
    <EntryList<Education>
      list="education"
      items={cv.education}
      getId={(e) => e.id}
      title={(e) => e.degree.trim() || e.school.trim() || t("f.untitled")}
      subtitle={(e) => joinDot(e.degree.trim() ? e.school : "", e.date) || undefined}
      view={(e) => (e.details.trim() ? <p className="text-sm text-ink-2">{e.details}</p> : null)}
      isBlank={(e) => blank(e.degree, e.school, e.date, e.details)}
      onAdd={() => add("education", { id: newId("edu"), degree: "", school: "", date: "", details: "" })}
      addLabel={cv.education.length ? "Add another" : "Add education"}
      onMove={move("education")}
      onRemove={remove("education")}
      noun="education"
      empty={<Empty icon="graduation-cap" title="Add your degree, diploma or school." />}
      edit={(e) => (
        <Row>
          <TextField label={t("f.degree")} value={e.degree} placeholder="BS Computer Science" onChange={(v) => set("education", e.id, { degree: v })} />
          <TextField label={t("f.school")} value={e.school} placeholder="University of the Punjab" onChange={(v) => set("education", e.id, { school: v })} />
          <TextField label={t("f.dates")} value={e.date} placeholder="2018 – 2022" onChange={(v) => set("education", e.id, { date: v })} />
          <TextField label={t("f.details")} value={e.details} placeholder="City · CGPA 3.4 / 4.0" onChange={(v) => set("education", e.id, { details: v })} />
        </Row>
      )}
    />
  );
}

/* ------------------------------------------------------------------ Skills */

const SKILL_GROUPS = ["Frontend", "Backend", "Databases", "DevOps & tools", "Mobile", "Design", "Soft skills"];

export function SkillsSection(props: SectionProps) {
  return (
    <EditingScope>
      <SkillsList {...props} />
    </EditingScope>
  );
}

function SkillsList({ cv, onChange }: SectionProps) {
  const t = useT();
  const { open } = useEditingScope();
  const { set, add, remove, move } = useList(cv, onChange);
  const used = new Set(cv.skills.map((s) => s.category.trim().toLowerCase()));
  const suggestions = SKILL_GROUPS.filter((g) => !used.has(g.toLowerCase()));
  const addGroup = (category: string) => add("skills", { id: newId("skill"), category, items: "" });

  return (
    <div className="flex flex-col gap-3">
      <SkillsAssist cv={cv} onChange={onChange} />
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="cvb-label">Quick add a group:</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((g) => (
              <Chip key={g} icon="plus" onClick={() => open(`skills:${addGroup(g)}`)}>
                {g}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <EntryList
        list="skills"
        items={cv.skills}
        getId={(s) => s.id}
        title={(s) => s.category.trim() || t("f.untitled")}
        view={(s) => <TagView text={s.items} max={20} />}
        // A group name alone adds nothing to the CV, so a group without skills is dropped on close.
        isBlank={(s) => !s.items.trim()}
        onAdd={() => addGroup("")}
        addLabel="Add a custom group"
        onMove={move("skills")}
        onRemove={remove("skills")}
        noun="group"
        edit={(s) => (
          <>
            <TextField label={t("f.groupName")} value={s.category} placeholder="Frontend" onChange={(v) => set("skills", s.id, { category: v })} />
            <TextArea
              label={t("f.skills")}
              hint="separate with commas"
              rows={2}
              value={s.items}
              placeholder="React, Next.js, TypeScript, Tailwind CSS"
              onChange={(v) => set("skills", s.id, { items: v })}
            />
          </>
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Projects */

export function ProjectsSection(props: SectionProps) {
  return (
    <EditingScope>
      <ProjectsList {...props} />
    </EditingScope>
  );
}

function ProjectsList({ cv, onChange }: SectionProps) {
  const t = useT();
  const { set, add, remove, move } = useList(cv, onChange);
  return (
    <EntryList<Project>
      list="projects"
      items={cv.projects}
      getId={(p) => p.id}
      title={(p) => p.name.trim() || t("f.untitled")}
      subtitle={(p) => joinDot(p.date, ...p.links.slice(0, 1).map((l) => l.replace(/^https?:\/\//, ""))) || undefined}
      view={(p) =>
        p.bullets.some((b) => b.trim()) || p.stack.trim() ? (
          <div className="flex flex-col gap-2">
            <BulletView lines={p.bullets} />
            {p.stack.trim() && <TagView text={p.stack} />}
          </div>
        ) : (
          <p className="text-sm text-ink-3">No lines yet. Say what it does and what you built.</p>
        )
      }
      isBlank={(p) => blank(p.name, p.date, p.links, p.bullets, p.stack)}
      onAdd={() => add("projects", { id: newId("proj"), name: "", date: "", links: [], bullets: [], stack: "" })}
      addLabel={cv.projects.length ? "Add another project" : "Add a project"}
      onMove={move("projects")}
      onRemove={remove("projects")}
      noun="project"
      empty={
        <Empty icon="files" title="Projects show what you can build.">
          Add personal, university or freelance projects.
        </Empty>
      }
      edit={(p) => (
        <>
          <Row wide="@min-[520px]:grid-cols-[1fr_9rem]">
            <TextField label={t("f.projectName")} value={p.name} placeholder="TaskFlow — Team Task Board" onChange={(v) => set("projects", p.id, { name: v })} />
            <TextField label={t("f.year")} value={p.date} placeholder="2025" onChange={(v) => set("projects", p.id, { date: v })} />
          </Row>
          <LinesField label={t("f.links")} rows={2} value={p.links} placeholder={"https://github.com/you/project\nhttps://project.live"} onChange={(v) => set("projects", p.id, { links: v })} />
          <LinesField label={t("f.whatItDoes")} rows={4} value={p.bullets} placeholder={"Kanban board with drag and drop\nJWT login and REST API"} onChange={(v) => set("projects", p.id, { bullets: v })} />
          <div className="-mt-2">
            <BulletsAssist bullets={p.bullets} role={p.name} onChange={(v) => set("projects", p.id, { bullets: v })} />
          </div>
          <TextField label={t("f.tools")} value={p.stack} placeholder="React, Express, MongoDB" onChange={(v) => set("projects", p.id, { stack: v })} />
        </>
      )}
    />
  );
}

/* ------------------------------------------------------------------ Extras */

export function ExtrasSection(props: SectionProps) {
  return (
    <EditingScope>
      <ExtrasLists {...props} />
    </EditingScope>
  );
}

function ExtrasLists({ cv, onChange }: SectionProps) {
  const t = useT();
  const { set, add, remove, move } = useList(cv, onChange);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="cvb-h3">{t("f.languages")}</h3>
        <EntryList
          list="languages"
          items={cv.languages}
          getId={(l) => l.id}
          title={(l) => l.name.trim() || t("f.untitled")}
          subtitle={(l) => l.level.trim() || undefined}
          view={() => null}
          isBlank={(l) => blank(l.name, l.level)}
          onAdd={() => add("languages", { id: newId("lang"), name: "", level: "" })}
          addLabel="Add a language"
          onMove={move("languages")}
          onRemove={remove("languages")}
          noun="language"
          edit={(l) => (
            <Row>
              <TextField label={t("f.language")} value={l.name} placeholder="English" onChange={(v) => set("languages", l.id, { name: v })} />
              <TextField label={t("f.level")} value={l.level} placeholder="Native, Fluent, Basic…" onChange={(v) => set("languages", l.id, { level: v })} />
            </Row>
          )}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="cvb-h3">{t("f.certificates")}</h3>
        <EntryList
          list="certificates"
          items={cv.certificates}
          getId={(c) => c.id}
          title={(c) => c.name.trim() || t("f.untitled")}
          subtitle={(c) => joinDot(c.issuer, c.year) || undefined}
          view={(c) => (c.url.trim() ? <p dir="ltr" className="truncate text-start text-sm text-ink-2">{c.url}</p> : null)}
          isBlank={(c) => blank(c.name, c.issuer, c.year, c.url)}
          onAdd={() => add("certificates", { id: newId("cert"), name: "", issuer: "", year: "", url: "" })}
          addLabel="Add a certificate"
          onMove={move("certificates")}
          onRemove={remove("certificates")}
          noun="certificate"
          edit={(c) => (
            <>
              <TextField label={t("f.certificate")} value={c.name} placeholder="AWS Cloud Practitioner" onChange={(v) => set("certificates", c.id, { name: v })} />
              <Row wide="@min-[520px]:grid-cols-[1fr_6rem]">
                <TextField label={t("f.issuer")} value={c.issuer} placeholder="Coursera" onChange={(v) => set("certificates", c.id, { issuer: v })} />
                <TextField label={t("f.year")} value={c.year} placeholder="2024" onChange={(v) => set("certificates", c.id, { year: v })} />
              </Row>
              <TextField label={t("f.linkOptional")} value={c.url} onChange={(v) => set("certificates", c.id, { url: v })} />
            </>
          )}
        />
      </div>
    </div>
  );
}
