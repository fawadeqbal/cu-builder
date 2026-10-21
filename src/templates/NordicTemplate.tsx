import type { ReactNode } from "react";
import { linkHref } from "@/lib/cv";
import type { StepId } from "@/lib/steps";
import type { CV } from "@/lib/types";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks } from "./shared";

/** Nordic — light type, wide margins, dates in a quiet left column. */
export function NordicTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const info = contacts(p);
  return (
    <div className="tpl tpl-nordic">
      <Block as="header" step="personal" className="n-head">
        <div className="n-name">{p.name || "Your Name"}</div>
        {p.headline && <div className="n-headline">{p.headline}</div>}
        {info.length > 0 && (
          <div className="n-contact">
            {info.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        )}
      </Block>

      {(cv.summary.trim() || p.tagline) && (
        <Block step="summary" className="n-section">
          <h2>About</h2>
          <div>
            {cv.summary.trim() && <p className="n-lead">{cv.summary}</p>}
            {p.tagline && <p className="n-muted n-tagline">{p.tagline}</p>}
          </div>
        </Block>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title="Experience">
          {cv.experience.map((e) => (
            <Row key={e.id} date={e.date}>
              <div className="n-title">
                {e.role}
                {e.company && <span className="n-org"> — {e.company}</span>}
              </div>
              {e.location && <div className="n-muted">{e.location}</div>}
              <Bullets items={e.bullets} />
              {e.stack && <div className="n-muted n-stack">{e.stack}</div>}
            </Row>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title="Projects">
          {cv.projects.map((pr) => (
            <Row key={pr.id} date={pr.date}>
              <div className="n-title">{pr.name}</div>
              {pr.links.some((l) => l.trim()) && (
                <div className="n-muted">
                  <ProjectLinks links={pr.links} />
                </div>
              )}
              <Bullets items={pr.bullets} />
              {pr.stack && <div className="n-muted n-stack">{pr.stack}</div>}
            </Row>
          ))}
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title="Education">
          {cv.education.map((ed) => (
            <Row key={ed.id} date={ed.date}>
              <div className="n-title">{ed.degree}</div>
              <div className="n-muted">{joinParts([ed.school, ed.details])}</div>
            </Row>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title="Skills">
          {cv.skills.map((s) => (
            <Row key={s.id} date={s.category}>
              <div>{s.items}</div>
            </Row>
          ))}
        </Section>
      )}

      {cv.certificates.length > 0 && (
        <Section step="extras" title="Certificates">
          {cv.certificates.map((c) => (
            <Row key={c.id} date={c.year}>
              <div>
                {c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
                {c.issuer && <span className="n-muted"> — {c.issuer}</span>}
              </div>
            </Row>
          ))}
        </Section>
      )}

      {cv.languages.length > 0 && (
        <Section step="extras" title="Languages">
          {cv.languages.map((l) => (
            <Row key={l.id} date={l.name}>
              <div className="n-muted">{l.level}</div>
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="n-section">
      <h2>{title}</h2>
      <div className="n-rows">{children}</div>
    </Block>
  );
}

function Row({ date, children }: { date: string; children: ReactNode }) {
  return (
    <div className="n-row">
      <div className="n-date">{date}</div>
      <div className="n-body">{children}</div>
    </div>
  );
}
