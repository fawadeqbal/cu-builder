import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Simple — centred name, one column, a ruled heading per section. Safe for any ATS. */
export function SimpleTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  return (
    <div className="tpl tpl-simple">
      <Block as="header" step="personal" className="s-head">
        <Photo cv={cv} />
        <div className="s-name">{p.name || tr("Your Name")}</div>
        {p.headline && <div className="s-headline">{p.headline}</div>}
        {p.tagline && <div className="s-tagline">{p.tagline}</div>}
        {info.length > 0 && (
          <div className="s-contact">
            {info.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        )}
        <PersonalDetailsList cv={cv} tr={tr} />
      </Block>

      {cv.summary.trim() && (
        <Section step="summary" title={tr("Profile")}>
          <p>{cv.summary}</p>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title={tr("Experience")}>
          {cv.experience.map((e) => (
            <div key={e.id} className="s-entry">
              <div className="s-row">
                <b>{joinParts([e.role, e.company], ", ")}</b>
                <span>{e.date}</span>
              </div>
              {e.location && <div className="s-sub">{e.location}</div>}
              <Bullets items={e.bullets} />
              {e.stack && <div className="s-sub">{tr("Tools:")} {e.stack}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title={tr("Projects")}>
          {cv.projects.map((pr) => (
            <div key={pr.id} className="s-entry">
              <div className="s-row">
                <b>{pr.name}</b>
                <span>{pr.date}</span>
              </div>
              {pr.links.some((l) => l.trim()) && (
                <div className="s-sub">
                  <ProjectLinks links={pr.links} />
                </div>
              )}
              <Bullets items={pr.bullets} />
              {pr.stack && <div className="s-sub">{tr("Tools:")} {pr.stack}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title={tr("Skills")}>
          {cv.skills.map((s) => (
            <p key={s.id} className="s-skill">
              {s.category && <b>{s.category}: </b>}
              {s.items}
            </p>
          ))}
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title={tr("Education")}>
          {cv.education.map((ed) => (
            <div key={ed.id} className="s-entry">
              <div className="s-row">
                <b>{joinParts([ed.degree, ed.school], ", ")}</b>
                <span>{ed.date}</span>
              </div>
              {ed.details && <div className="s-sub">{ed.details}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.certificates.length > 0 && (
        <Section step="extras" title={tr("Certificates")}>
          {cv.certificates.map((c) => (
            <p key={c.id} className="s-skill">
              <b>{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</b>
              {(c.issuer || c.year) && ` — ${joinParts([c.issuer, c.year], ", ")}`}
            </p>
          ))}
        </Section>
      )}

      {cv.languages.length > 0 && (
        <Section step="extras" title={tr("Languages")}>
          <p>
            {cv.languages.map((l, i) => (
              <span key={l.id}>
                {i > 0 && " · "}
                <b>{l.name}</b>
                {l.level && ` (${l.level})`}
              </span>
            ))}
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="s-section">
      <h2>{title}</h2>
      {children}
    </Block>
  );
}
