import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks, splitItems } from "./shared";

/** Developer — mono accents, skill chips, and projects right after experience. */
export function TechTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const info = contacts(p);
  return (
    <div className="tpl tpl-tech">
      <Block as="header" step="personal" className="tc-head">
        <div className="tc-name">{p.name || "Your Name"}</div>
        {p.headline && <div className="tc-headline">{p.headline}</div>}
        {p.tagline && <div className="tc-tagline">{p.tagline}</div>}
        {info.length > 0 && (
          <div className="tc-contact">
            {info.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        )}
      </Block>

      {cv.summary.trim() && (
        <Section step="summary" title="about">
          <p>{cv.summary}</p>
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title="skills">
          <div className="tc-skills">
            {cv.skills.map((s) => (
              <div key={s.id} className="tc-skill">
                <div className="tc-skill-cat">{s.category}</div>
                <Chips items={s.items} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title="experience">
          {cv.experience.map((e) => (
            <div key={e.id} className="tc-entry">
              <div className="tc-row">
                <span>
                  <b>{e.role}</b>
                  {e.company && <span className="tc-org"> @ {e.company}</span>}
                </span>
                <span className="tc-date">{e.date}</span>
              </div>
              {e.location && <div className="tc-muted">{e.location}</div>}
              <Bullets items={e.bullets} />
              {e.stack && <Chips items={e.stack} small />}
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title="projects">
          <div className="tc-projects">
            {cv.projects.map((pr) => (
              <div key={pr.id} className="tc-entry tc-project">
                <div className="tc-row">
                  <b>{pr.name}</b>
                  <span className="tc-date">{pr.date}</span>
                </div>
                {pr.links.some((l) => l.trim()) && (
                  <div className="tc-link">
                    <ProjectLinks links={pr.links} />
                  </div>
                )}
                <Bullets items={pr.bullets} />
                {pr.stack && <Chips items={pr.stack} small />}
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title="education">
          {cv.education.map((ed) => (
            <div key={ed.id} className="tc-row tc-entry">
              <span>
                <b>{ed.degree}</b>
                {ed.school && <span className="tc-org"> @ {ed.school}</span>}
                {ed.details && <span className="tc-muted"> · {ed.details}</span>}
              </span>
              <span className="tc-date">{ed.date}</span>
            </div>
          ))}
        </Section>
      )}

      {cv.certificates.length + cv.languages.length > 0 && (
        <Section step="extras" title="extras">
          {cv.certificates.map((c) => (
            <p key={c.id}>
              <b>{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</b>
              {(c.issuer || c.year) && <span className="tc-muted"> · {joinParts([c.issuer, c.year])}</span>}
            </p>
          ))}
          {cv.languages.length > 0 && (
            <p>
              <span className="tc-muted">languages: </span>
              {cv.languages.map((l) => joinParts([l.name, l.level && `(${l.level})`], " ")).join(", ")}
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="tc-section">
      <h2>
        <span aria-hidden="true">{"// "}</span>
        {title}
      </h2>
      {children}
    </Block>
  );
}

function Chips({ items, small }: { items: string; small?: boolean }) {
  const list = splitItems(items);
  if (!list.length) return null;
  return (
    <div className={small ? "tc-chips tc-chips-sm" : "tc-chips"}>
      {list.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
