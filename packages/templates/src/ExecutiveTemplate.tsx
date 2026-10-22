import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks, splitItems, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Executive — a dark header band, a core-competencies grid and a strong career summary. */
export function ExecutiveTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  const competencies = cv.skills.flatMap((s) => splitItems(s.items));
  return (
    <div className="tpl tpl-executive">
      <Block as="header" step="personal" className="ex-head">
        <Photo cv={cv} />
        <div className="ex-band">
          <div className="ex-name">{p.name || tr("Your Name")}</div>
          {p.headline && <div className="ex-headline">{p.headline}</div>}
        </div>
        {info.length > 0 && (
          <div className="ex-contact">
            {info.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        )}
        <PersonalDetailsList cv={cv} tr={tr} />
      </Block>

      {(cv.summary.trim() || p.tagline) && (
        <Section step="summary" title={tr("Executive Summary")}>
          {cv.summary.trim() && <p className="ex-lead">{cv.summary}</p>}
          {p.tagline && <p className="ex-muted">{p.tagline}</p>}
        </Section>
      )}

      {competencies.length > 0 && (
        <Section step="skills" title={tr("Core Competencies")}>
          <ul className="ex-grid">
            {competencies.map((c, i) => (
              <li key={`${c}-${i}`}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title={tr("Career History")}>
          {cv.experience.map((e) => (
            <div key={e.id} className="ex-entry">
              <div className="ex-row">
                <span className="ex-role">{e.role}</span>
                <span className="ex-date">{e.date}</span>
              </div>
              <div className="ex-org">{joinParts([e.company, e.location], " | ")}</div>
              <Bullets items={e.bullets} />
              {e.stack && <div className="ex-muted ex-small">{e.stack}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title={tr("Key Initiatives")}>
          {cv.projects.map((pr) => (
            <div key={pr.id} className="ex-entry">
              <div className="ex-row">
                <span className="ex-role">{pr.name}</span>
                <span className="ex-date">{pr.date}</span>
              </div>
              {pr.links.some((l) => l.trim()) && (
                <div className="ex-org">
                  <ProjectLinks links={pr.links} sep=" | " />
                </div>
              )}
              <Bullets items={pr.bullets} />
            </div>
          ))}
        </Section>
      )}

      <div className="ex-split">
        {cv.education.length > 0 && (
          <Section step="education" title={tr("Education")}>
            {cv.education.map((ed) => (
              <div key={ed.id} className="ex-small-entry">
                <b>{ed.degree}</b>
                <div>{joinParts([ed.school, ed.date], " | ")}</div>
                {ed.details && <div className="ex-muted">{ed.details}</div>}
              </div>
            ))}
          </Section>
        )}
        {cv.certificates.length + cv.languages.length > 0 && (
          <Section step="extras" title={tr("Credentials")}>
            {cv.certificates.map((c) => (
              <div key={c.id} className="ex-small-entry">
                <b>{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</b>
                <div className="ex-muted">{joinParts([c.issuer, c.year], " | ")}</div>
              </div>
            ))}
            {cv.languages.length > 0 && (
              <div className="ex-small-entry">
                <b>{tr("Languages")}</b>
                <div>{cv.languages.map((l) => joinParts([l.name, l.level && `(${l.level})`], " ")).join(", ")}</div>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="ex-section">
      <h2>{title}</h2>
      {children}
    </Block>
  );
}
