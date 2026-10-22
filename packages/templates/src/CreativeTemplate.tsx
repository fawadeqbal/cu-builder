import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks, splitItems, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Creative — a bold colour header and a two-column body. */
export function CreativeTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  const hasSide = cv.skills.length + cv.education.length + cv.languages.length + cv.certificates.length > 0;
  return (
    <div className="tpl tpl-creative">
      <Block as="header" step="personal" className="cr-head">
        <Photo cv={cv} />
        <div className="cr-name">{p.name || tr("Your Name")}</div>
        {p.headline && <div className="cr-headline">{p.headline}</div>}
        {info.length > 0 && (
          <div className="cr-contact">
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
        <Block step="summary" className="cr-summary">
          {cv.summary.trim() && <p>{cv.summary}</p>}
          {p.tagline && <p className="cr-tagline">{p.tagline}</p>}
        </Block>
      )}

      <div className={hasSide ? "cr-body" : "cr-body cr-body--single"}>
        <div className="cr-main">
          {cv.experience.length > 0 && (
            <Section step="experience" title={tr("Experience")}>
              {cv.experience.map((e) => (
                <div key={e.id} className="cr-entry">
                  <div className="cr-date">{e.date}</div>
                  <div className="cr-title">{e.role}</div>
                  <div className="cr-org">{joinParts([e.company, e.location])}</div>
                  <Bullets items={e.bullets} />
                  {e.stack && <div className="cr-stack">{e.stack}</div>}
                </div>
              ))}
            </Section>
          )}

          {cv.projects.length > 0 && (
            <Section step="projects" title={tr("Projects")}>
              {cv.projects.map((pr) => (
                <div key={pr.id} className="cr-entry">
                  <div className="cr-date">{pr.date}</div>
                  <div className="cr-title">{pr.name}</div>
                  {pr.links.some((l) => l.trim()) && (
                    <div className="cr-org">
                      <ProjectLinks links={pr.links} />
                    </div>
                  )}
                  <Bullets items={pr.bullets} />
                  {pr.stack && <div className="cr-stack">{pr.stack}</div>}
                </div>
              ))}
            </Section>
          )}
        </div>

        {hasSide && (
          <aside className="cr-side">
            {cv.skills.length > 0 && (
              <Section step="skills" title={tr("Skills")}>
                {cv.skills.map((s) => (
                  <div key={s.id} className="cr-skill">
                    <div className="cr-skill-cat">{s.category}</div>
                    <div className="cr-chips">
                      {splitItems(s.items).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </Section>
            )}
            {cv.education.length > 0 && (
              <Section step="education" title={tr("Education")}>
                {cv.education.map((ed) => (
                  <div key={ed.id} className="cr-side-item">
                    <b>{ed.degree}</b>
                    <div>{ed.school}</div>
                    <div className="cr-muted">{joinParts([ed.date, ed.details])}</div>
                  </div>
                ))}
              </Section>
            )}
            {cv.languages.length > 0 && (
              <Section step="extras" title={tr("Languages")}>
                {cv.languages.map((l) => (
                  <div key={l.id} className="cr-lang">
                    <b>{l.name}</b>
                    <span className="cr-muted">{l.level}</span>
                  </div>
                ))}
              </Section>
            )}
            {cv.certificates.length > 0 && (
              <Section step="extras" title={tr("Certificates")}>
                {cv.certificates.map((c) => (
                  <div key={c.id} className="cr-side-item">
                    <b>{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</b>
                    <div className="cr-muted">{joinParts([c.issuer, c.year])}</div>
                  </div>
                ))}
              </Section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="cr-section">
      <h2>{title}</h2>
      {children}
    </Block>
  );
}
