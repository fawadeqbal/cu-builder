import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks } from "./shared";

/** Boardroom — the name set large in a side column, gold rules, a serif summary. */
export function BoardroomTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const info = contacts(p);
  const [first, ...rest] = (p.name || "Your Name").trim().split(/\s+/);
  return (
    <div className="tpl tpl-boardroom">
      <div className="bd-side">
        <Block as="header" step="personal" className="bd-id">
          <div className="bd-name">
            <span>{first}</span>
            {rest.length > 0 && <span>{rest.join(" ")}</span>}
          </div>
          {p.headline && <div className="bd-headline">{p.headline}</div>}
          <div className="bd-rule" aria-hidden="true" />
          {info.length > 0 && (
            <div className="bd-contact">
              {info.map((c) => (
                <div key={c.key}>
                  <ContactText c={c} />
                </div>
              ))}
            </div>
          )}
        </Block>

        {cv.education.length > 0 && (
          <SideSection step="education" title="Education">
            {cv.education.map((ed) => (
              <div key={ed.id} className="bd-side-item">
                <b>{ed.degree}</b>
                <div>{ed.school}</div>
                <div className="bd-muted">{joinParts([ed.date, ed.details])}</div>
              </div>
            ))}
          </SideSection>
        )}

        {cv.skills.length > 0 && (
          <SideSection step="skills" title="Expertise">
            {cv.skills.map((s) => (
              <div key={s.id} className="bd-side-item">
                <b>{s.category}</b>
                <div>{s.items}</div>
              </div>
            ))}
          </SideSection>
        )}

        {cv.languages.length > 0 && (
          <SideSection step="extras" title="Languages">
            {cv.languages.map((l) => (
              <div key={l.id} className="bd-side-item">
                <b>{l.name}</b>
                {l.level && <div className="bd-muted">{l.level}</div>}
              </div>
            ))}
          </SideSection>
        )}

        {cv.certificates.length > 0 && (
          <SideSection step="extras" title="Credentials">
            {cv.certificates.map((c) => (
              <div key={c.id} className="bd-side-item">
                <b>{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</b>
                <div className="bd-muted">{joinParts([c.issuer, c.year])}</div>
              </div>
            ))}
          </SideSection>
        )}
      </div>

      <div className="bd-main">
        {(cv.summary.trim() || p.tagline) && (
          <Block step="summary" className="bd-summary">
            {cv.summary.trim() && <p>{cv.summary}</p>}
            {p.tagline && <p className="bd-muted bd-tagline">{p.tagline}</p>}
          </Block>
        )}

        {cv.experience.length > 0 && (
          <Section step="experience" title="Experience">
            {cv.experience.map((e) => (
              <div key={e.id} className="bd-entry">
                <div className="bd-date">{e.date}</div>
                <div className="bd-role">{e.role}</div>
                <div className="bd-org">{joinParts([e.company, e.location])}</div>
                <Bullets items={e.bullets} />
                {e.stack && <div className="bd-muted bd-small">{e.stack}</div>}
              </div>
            ))}
          </Section>
        )}

        {cv.projects.length > 0 && (
          <Section step="projects" title="Selected Work">
            {cv.projects.map((pr) => (
              <div key={pr.id} className="bd-entry">
                <div className="bd-date">{pr.date}</div>
                <div className="bd-role">{pr.name}</div>
                {pr.links.some((l) => l.trim()) && (
                  <div className="bd-org">
                    <ProjectLinks links={pr.links} />
                  </div>
                )}
                <Bullets items={pr.bullets} />
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="bd-section">
      <h2>{title}</h2>
      {children}
    </Block>
  );
}

function SideSection({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} as="div" className="bd-side-section">
      <h2>{title}</h2>
      {children}
    </Block>
  );
}
