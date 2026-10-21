"use client";

import { newId } from "@/lib/cv";
import type { CV, ListKey, Personal } from "@/lib/types";
import { AddButton, ItemCard, LinesField, Panel, TextArea, TextField } from "./fields";

type Props = { cv: CV; onChange: (cv: CV) => void };

const personalFields: { key: keyof Personal; label: string; placeholder?: string }[] = [
  { key: "name", label: "Full name", placeholder: "Sara Ahmed" },
  { key: "headline", label: "Headline", placeholder: "Full Stack Developer" },
  { key: "tagline", label: "Tagline", placeholder: "React · Node.js · PostgreSQL" },
  { key: "email", label: "Email", placeholder: "you@example.com" },
  { key: "phone", label: "Phone", placeholder: "+92 300 1234567" },
  { key: "location", label: "Location", placeholder: "Lahore, Pakistan" },
  { key: "website", label: "Website", placeholder: "yourname.dev" },
  { key: "github", label: "GitHub", placeholder: "github.com/you" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { key: "extra", label: "Extra (optional)", placeholder: "Nationality, visa status…" },
];

export function Editor({ cv, onChange }: Props) {
  const setPersonal = (key: keyof Personal, value: string) =>
    onChange({ ...cv, personal: { ...cv.personal, [key]: value } });

  /** Updates one field of one item in a list section. */
  function setItem<K extends ListKey>(list: K, id: string, patch: Partial<CV[K][number]>) {
    onChange({
      ...cv,
      [list]: (cv[list] as CV[K][number][]).map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function addItem<K extends ListKey>(list: K, item: CV[K][number]) {
    onChange({ ...cv, [list]: [...cv[list], item] });
  }

  function removeItem(list: ListKey, id: string) {
    onChange({ ...cv, [list]: (cv[list] as { id: string }[]).filter((i) => i.id !== id) });
  }

  function moveItem(list: ListKey, index: number, dir: -1 | 1) {
    const items = [...(cv[list] as { id: string }[])];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    onChange({ ...cv, [list]: items });
  }

  const card = (list: ListKey, index: number, title: string, id: string) => ({
    title: title || "Untitled",
    index,
    total: cv[list].length,
    onMove: (dir: -1 | 1) => moveItem(list, index, dir),
    onRemove: () => removeItem(list, id),
  });

  return (
    <div className="flex flex-col gap-3">
      <Panel title="Personal details" defaultOpen>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {personalFields.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              value={cv.personal[f.key]}
              placeholder={f.placeholder}
              onChange={(v) => setPersonal(f.key, v)}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Summary">
        <TextArea
          label="About you"
          rows={6}
          value={cv.summary}
          placeholder="Two to four sentences: who you are, what you build, what you are good at."
          onChange={(v) => onChange({ ...cv, summary: v })}
        />
      </Panel>

      <Panel title="Work experience" count={cv.experience.length}>
        {cv.experience.map((e, i) => (
          <ItemCard key={e.id} {...card("experience", i, [e.role, e.company].filter(Boolean).join(" · "), e.id)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Role" value={e.role} onChange={(v) => setItem("experience", e.id, { role: v })} />
              <TextField label="Company" value={e.company} onChange={(v) => setItem("experience", e.id, { company: v })} />
              <TextField label="Location" value={e.location} onChange={(v) => setItem("experience", e.id, { location: v })} />
              <TextField
                label="Dates"
                value={e.date}
                placeholder="Jan 2024 – Present"
                onChange={(v) => setItem("experience", e.id, { date: v })}
              />
            </div>
            <LinesField
              label="Achievements"
              rows={5}
              value={e.bullets}
              placeholder="Built …&#10;Improved … by …"
              onChange={(v) => setItem("experience", e.id, { bullets: v })}
            />
            <TextField label="Tech stack" value={e.stack} onChange={(v) => setItem("experience", e.id, { stack: v })} />
          </ItemCard>
        ))}
        <AddButton
          onClick={() =>
            addItem("experience", { id: newId("exp"), role: "", company: "", location: "", date: "", bullets: [], stack: "" })
          }
        >
          Add experience
        </AddButton>
      </Panel>

      <Panel title="Projects" count={cv.projects.length}>
        {cv.projects.map((p, i) => (
          <ItemCard key={p.id} {...card("projects", i, p.name, p.id)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
              <TextField label="Project name" value={p.name} onChange={(v) => setItem("projects", p.id, { name: v })} />
              <TextField label="Date" value={p.date} onChange={(v) => setItem("projects", p.id, { date: v })} />
            </div>
            <LinesField
              label="Links"
              rows={2}
              value={p.links}
              placeholder="https://github.com/you/project"
              onChange={(v) => setItem("projects", p.id, { links: v })}
            />
            <LinesField
              label="Highlights"
              rows={4}
              value={p.bullets}
              onChange={(v) => setItem("projects", p.id, { bullets: v })}
            />
            <TextField label="Tech stack" value={p.stack} onChange={(v) => setItem("projects", p.id, { stack: v })} />
          </ItemCard>
        ))}
        <AddButton
          onClick={() => addItem("projects", { id: newId("proj"), name: "", date: "", links: [], bullets: [], stack: "" })}
        >
          Add project
        </AddButton>
      </Panel>

      <Panel title="Skills" count={cv.skills.length}>
        {cv.skills.map((s, i) => (
          <ItemCard key={s.id} {...card("skills", i, s.category, s.id)}>
            <TextField
              label="Category"
              value={s.category}
              placeholder="Frontend"
              onChange={(v) => setItem("skills", s.id, { category: v })}
            />
            <TextArea
              label="Skills"
              rows={2}
              value={s.items}
              placeholder="React, Next.js, TypeScript"
              onChange={(v) => setItem("skills", s.id, { items: v })}
            />
          </ItemCard>
        ))}
        <AddButton onClick={() => addItem("skills", { id: newId("skill"), category: "", items: "" })}>
          Add skill group
        </AddButton>
      </Panel>

      <Panel title="Education" count={cv.education.length}>
        {cv.education.map((ed, i) => (
          <ItemCard key={ed.id} {...card("education", i, ed.degree, ed.id)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Degree" value={ed.degree} onChange={(v) => setItem("education", ed.id, { degree: v })} />
              <TextField label="School" value={ed.school} onChange={(v) => setItem("education", ed.id, { school: v })} />
              <TextField label="Dates" value={ed.date} onChange={(v) => setItem("education", ed.id, { date: v })} />
              <TextField
                label="Details"
                value={ed.details}
                placeholder="City · CGPA"
                onChange={(v) => setItem("education", ed.id, { details: v })}
              />
            </div>
          </ItemCard>
        ))}
        <AddButton
          onClick={() => addItem("education", { id: newId("edu"), degree: "", school: "", date: "", details: "" })}
        >
          Add education
        </AddButton>
      </Panel>

      <Panel title="Certificates" count={cv.certificates.length}>
        {cv.certificates.map((c, i) => (
          <ItemCard key={c.id} {...card("certificates", i, c.name, c.id)}>
            <TextField label="Name" value={c.name} onChange={(v) => setItem("certificates", c.id, { name: v })} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem]">
              <TextField label="Issuer" value={c.issuer} onChange={(v) => setItem("certificates", c.id, { issuer: v })} />
              <TextField label="Year" value={c.year} onChange={(v) => setItem("certificates", c.id, { year: v })} />
            </div>
            <TextField
              label="Link (optional)"
              value={c.url}
              onChange={(v) => setItem("certificates", c.id, { url: v })}
            />
          </ItemCard>
        ))}
        <AddButton
          onClick={() => addItem("certificates", { id: newId("cert"), name: "", issuer: "", year: "", url: "" })}
        >
          Add certificate
        </AddButton>
      </Panel>

      <Panel title="Languages" count={cv.languages.length}>
        {cv.languages.map((l, i) => (
          <ItemCard key={l.id} {...card("languages", i, l.name, l.id)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Language" value={l.name} onChange={(v) => setItem("languages", l.id, { name: v })} />
              <TextField
                label="Level"
                value={l.level}
                placeholder="Native, Fluent…"
                onChange={(v) => setItem("languages", l.id, { level: v })}
              />
            </div>
          </ItemCard>
        ))}
        <AddButton onClick={() => addItem("languages", { id: newId("lang"), name: "", level: "" })}>
          Add language
        </AddButton>
      </Panel>
    </div>
  );
}
