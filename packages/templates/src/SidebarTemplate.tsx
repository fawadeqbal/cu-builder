import { linkHref, showPhoto, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, initials, joinParts, ProjectLinks, splitItems, cvLabels, Photo, PersonalDetailsList } from "./shared";

const LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  location: "Location",
  website: "Website",
  linkedin: "LinkedIn",
  github: "GitHub",
  extra: "Other",
};

/** Sidebar Pro — a coloured sidebar with a monogram, contact, skills and extras. */
export function SidebarTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  return (
    <div className="tpl tpl-sidebar">
      <aside className="sb-side">
        <Block as="div" step="personal" className="sb-id">
          {showPhoto(cv) ? <Photo cv={cv} variant="side" /> : <div className="sb-mono">{initials(p.name)}</div>}
          {info.length > 0 && (
            <dl className="sb-contact">
              {info.map((c) => (
                <div key={c.key}>
                  <dt>{tr(LABELS[c.key] ?? "")}</dt>
                  <dd>
                    <ContactText c={c} />
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
              <div key={s.id} className="sb-skill">
                <div className="sb-skill-cat">{s.category}</div>
                <div className="sb-chips">
                  {splitItems(s.items).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </SideBlock>
        )}

        {cv.education.length > 0 && (
          <SideBlock step="education" title={tr("Education")}>
            {cv.education.map((ed) => (
              <div key={ed.id} className="sb-item">
                <b>{ed.degree}</b>
                <div>{ed.school}</div>
                <div className="sb-dim">{joinParts([ed.date, ed.details])}</div>
              </div>
            ))}
          </SideBlock>
        )}

        {cv.languages.length > 0 && (
          <SideBlock step="extras" title={tr("Languages")}>
            {cv.languages.map((l) => (
              <div key={l.id} className="sb-lang">
                <b>{l.name}</b>
                <span className="sb-dim">{l.level}</span>
              </div>
            ))}
          </SideBlock>
        )}

        {cv.certificates.length > 0 && (
          <SideBlock step="extras" title={tr("Certificates")}>
            {cv.certificates.map((c) => (
              <div key={c.id} className="sb-item">
                <b>{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</b>
                <div className="sb-dim">{joinParts([c.issuer, c.year])}</div>
              </div>
            ))}
          </SideBlock>
        )}
      </aside>

      <div className="sb-main">
        <Block as="header" step="personal" className="sb-head">
          <div className="sb-name">{p.name || tr("Your Name")}</div>
          {p.headline && <div className="sb-headline">{p.headline}</div>}
          {p.tagline && <div className="sb-tagline">{p.tagline}</div>}
        </Block>

        {cv.summary.trim() && (
          <MainBlock step="summary" title={tr("Profile")}>
            <p>{cv.summary}</p>
          </MainBlock>
        )}

        {cv.experience.length > 0 && (
          <MainBlock step="experience" title={tr("Experience")}>
            {cv.experience.map((e) => (
              <div key={e.id} className="sb-entry">
                <div className="sb-row">
                  <b>{e.role}</b>
                  <span className="sb-date">{e.date}</span>
                </div>
                <div className="sb-org">{joinParts([e.company, e.location])}</div>
                <Bullets items={e.bullets} />
                {e.stack && <div className="sb-stack">{e.stack}</div>}
              </div>
            ))}
          </MainBlock>
        )}

        {cv.projects.length > 0 && (
          <MainBlock step="projects" title={tr("Projects")}>
            {cv.projects.map((pr) => (
              <div key={pr.id} className="sb-entry">
                <div className="sb-row">
                  <b>{pr.name}</b>
                  <span className="sb-date">{pr.date}</span>
                </div>
                {pr.links.some((l) => l.trim()) && (
                  <div className="sb-org">
                    <ProjectLinks links={pr.links} />
                  </div>
                )}
                <Bullets items={pr.bullets} />
                {pr.stack && <div className="sb-stack">{pr.stack}</div>}
              </div>
            ))}
          </MainBlock>
        )}
      </div>
    </div>
  );
}

function SideBlock({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} as="div" className="sb-block">
      <h2>{title}</h2>
      {children}
    </Block>
  );
}

function MainBlock({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="sb-section">
      <h2>{title}</h2>
      {children}
    </Block>
  );
}
