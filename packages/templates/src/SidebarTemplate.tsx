import { linkHref, showPhoto, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import {
  Block,
  Bullets,
  ContactText,
  contacts,
  initials,
  joinParts,
  ProjectLinks,
  splitItems,
  cvLabels,
  Photo,
  PersonalDetailsList,
  type Translate,
} from "./shared";

const LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  location: "Location",
  website: "Website",
  linkedin: "LinkedIn",
  github: "GitHub",
  extra: "Other",
};

/**
 * Sidebar Pro — a coloured side panel with a monogram, contact, skills and extras.
 * The DOM reads name → side panel → main column (for applicant tracking systems); the grid
 * places the panel on the inline-start side, spanning the full height.
 */
export function SidebarTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  // A CV without experience or projects (a student) shows education in the main column instead.
  const eduInMain = cv.experience.length + cv.projects.length === 0;
  return (
    <div className="tpl tpl-sidebar">
      <Block as="header" step="personal" className="sb-head">
        <div className="sb-name">{p.name || tr("Your Name")}</div>
        {p.headline && <div className="sb-headline">{p.headline}</div>}
        {p.tagline && <div className="sb-tagline">{p.tagline}</div>}
      </Block>

      <aside className="sb-side">
        <Block as="div" step="personal" className="sb-id">
          {showPhoto(cv) ? (
            <Photo cv={cv} variant="side" />
          ) : (
            <div className="sb-mono" aria-hidden="true">
              {initials(p.name)}
            </div>
          )}
          {info.length > 0 && (
            <dl className="sb-contact">
              {info.map((c) => (
                <div key={c.key} data-keep="">
                  <dt>{tr(LABELS[c.key] ?? "")}</dt>
                  <dd>
                    {c.kind === "phone" ? (
                      <span dir="ltr" className="cv-ltr">
                        {c.text}
                      </span>
                    ) : (
                      <ContactText c={c} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <PersonalDetailsList cv={cv} tr={tr} />
        </Block>

        {cv.skills.length > 0 && (
          <SideBlock step="skills" title={tr("Skills")}>
            {cv.skills.map((s) => (
              <div key={s.id} className="sb-skill" data-keep="">
                {s.category && <div className="sb-skill-cat">{s.category}</div>}
                <ul className="sb-chips">
                  {splitItems(s.items).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </SideBlock>
        )}

        {cv.education.length > 0 && !eduInMain && (
          <SideBlock step="education" title={tr("Education")}>
            {cv.education.map((ed) => (
              <div key={ed.id} className="sb-item" data-keep="">
                <div className="sb-item-title">{ed.degree}</div>
                {ed.school && <div>{ed.school}</div>}
                {ed.date && <div className="sb-dim sb-num">{ed.date}</div>}
                {ed.details && <div className="sb-dim">{ed.details}</div>}
              </div>
            ))}
          </SideBlock>
        )}

        {cv.languages.length > 0 && (
          <SideBlock step="extras" title={tr("Languages")}>
            {cv.languages.map((l) => (
              <div key={l.id} className="sb-lang" data-keep="">
                <span className="sb-item-title">{l.name}</span>
                {l.level && <span className="sb-dim">{l.level}</span>}
              </div>
            ))}
          </SideBlock>
        )}

        {cv.certificates.length > 0 && (
          <SideBlock step="extras" title={tr("Certificates")}>
            {cv.certificates.map((c) => (
              <div key={c.id} className="sb-item" data-keep="">
                <div className="sb-item-title">{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</div>
                {(c.issuer || c.year) && <div className="sb-dim sb-num">{joinParts([c.issuer, c.year])}</div>}
              </div>
            ))}
          </SideBlock>
        )}
      </aside>

      <div className="sb-main">
        {cv.summary.trim() && (
          <MainBlock step="summary">
            <Heading title={tr("Profile")} />
            <p className="sb-summary">{cv.summary}</p>
          </MainBlock>
        )}

        {cv.experience.length > 0 && (
          <MainBlock step="experience">
            {cv.experience.map((e, i) => (
              <div key={e.id} className="sb-entry">
                <div className="sb-entry-head" data-keep-next="">
                  {i === 0 && <Heading title={tr("Experience")} />}
                  <div className="sb-row">
                    <span className="sb-title">{e.role}</span>
                    {e.date && <span className="sb-date">{e.date}</span>}
                  </div>
                  {(e.company || e.location) && (
                    <div className="sb-org">
                      {e.company && <span className="sb-company">{e.company}</span>}
                      {e.company && e.location && <span className="sb-sep"> · </span>}
                      {e.location && <span className="sb-loc">{e.location}</span>}
                    </div>
                  )}
                </div>
                <Bullets items={e.bullets} />
                <Stack value={e.stack} tr={tr} />
              </div>
            ))}
          </MainBlock>
        )}

        {cv.projects.length > 0 && (
          <MainBlock step="projects">
            {cv.projects.map((pr, i) => (
              <div key={pr.id} className="sb-entry">
                <div className="sb-entry-head" data-keep-next="">
                  {i === 0 && <Heading title={tr("Projects")} />}
                  <div className="sb-row">
                    <span className="sb-title">{pr.name}</span>
                    {pr.date && <span className="sb-date">{pr.date}</span>}
                  </div>
                  {pr.links.some((l) => l.trim()) && (
                    <div className="sb-links">
                      <ProjectLinks links={pr.links} />
                    </div>
                  )}
                </div>
                <Bullets items={pr.bullets} />
                <Stack value={pr.stack} tr={tr} />
              </div>
            ))}
          </MainBlock>
        )}

        {cv.education.length > 0 && eduInMain && (
          <MainBlock step="education">
            {cv.education.map((ed, i) => (
              <div key={ed.id} className="sb-entry" data-keep="">
                {i === 0 && <Heading title={tr("Education")} />}
                <div className="sb-row">
                  <span className="sb-title">{ed.degree}</span>
                  {ed.date && <span className="sb-date">{ed.date}</span>}
                </div>
                {(ed.school || ed.details) && (
                  <div className="sb-org">
                    {ed.school && <span className="sb-company">{ed.school}</span>}
                    {ed.school && ed.details && <span className="sb-sep"> · </span>}
                    {ed.details && <span className="sb-loc">{ed.details}</span>}
                  </div>
                )}
              </div>
            ))}
          </MainBlock>
        )}
      </div>
    </div>
  );
}

function Stack({ value, tr }: { value: string; tr: Translate }) {
  if (!value.trim()) return null;
  return (
    <p className="sb-stack">
      <span className="sb-stack-label">{tr("Stack:")}</span> {value}
    </p>
  );
}

function Heading({ title }: { title: string }) {
  return <h2 data-keep-next="">{title}</h2>;
}

/** A side-panel section: the heading and its first (short) item are kept together. */
function SideBlock({ step, title, children }: { step: StepId; title: string; children: ReactNode[] }) {
  const [first, ...rest] = children;
  return (
    <Block step={step} as="div" className="sb-block">
      <div className="sb-keep" data-keep="">
        <Heading title={title} />
        {first}
      </div>
      {rest}
    </Block>
  );
}

/**
 * A main-column section. Callers put its heading inside the first entry's head, so it can't be left
 * alone at the bottom of a page (Chrome doesn't honour break-after: avoid inside grid items).
 */
function MainBlock({ step, children }: { step: StepId; children: ReactNode }) {
  return (
    <Block step={step} className="sb-section">
      {children}
    </Block>
  );
}
