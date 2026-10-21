import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks, splitItems } from "./shared";

/** Timeline — dates on the left of a vertical line, a dot per entry. */
export function TimelineTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const info = contacts(p);
  return (
    <div className="tpl tpl-timeline">
      <Block as="header" step="personal" className="tl-head">
        <div className="tl-name">{p.name || "Your Name"}</div>
        {p.headline && <div className="tl-headline">{p.headline}</div>}
        {p.tagline && <div className="tl-tagline">{p.tagline}</div>}
        {info.length > 0 && (
          <div className="tl-contact">
            {info.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        )}
      </Block>

      {cv.summary.trim() && (
        <Block step="summary" className="tl-summary">
          <p>{cv.summary}</p>
        </Block>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title="Experience">
          {cv.experience.map((e) => (
            <Item key={e.id} date={e.date}>
              <div className="tl-title">{e.role}</div>
              <div className="tl-org">{joinParts([e.company, e.location])}</div>
              <Bullets items={e.bullets} />
              {e.stack && <Tags items={e.stack} />}
            </Item>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title="Projects">
          {cv.projects.map((pr) => (
            <Item key={pr.id} date={pr.date}>
              <div className="tl-title">{pr.name}</div>
              {pr.links.some((l) => l.trim()) && (
                <div className="tl-org">
                  <ProjectLinks links={pr.links} />
                </div>
              )}
              <Bullets items={pr.bullets} />
              {pr.stack && <Tags items={pr.stack} />}
            </Item>
          ))}
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title="Education">
          {cv.education.map((ed) => (
            <Item key={ed.id} date={ed.date}>
              <div className="tl-title">{ed.degree}</div>
              <div className="tl-org">{joinParts([ed.school, ed.details])}</div>
            </Item>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Block step="skills" className="tl-section">
          <h2>Skills</h2>
          <div className="tl-skills">
            {cv.skills.map((s) => (
              <div key={s.id} className="tl-skill">
                <div className="tl-skill-cat">{s.category}</div>
                <Tags items={s.items} />
              </div>
            ))}
          </div>
        </Block>
      )}

      {cv.certificates.length + cv.languages.length > 0 && (
        <Block step="extras" className="tl-section tl-extras">
          {cv.certificates.length > 0 && (
            <div>
              <h2>Certificates</h2>
              {cv.certificates.map((c) => (
                <p key={c.id}>
                  <b>{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</b>
                  {(c.issuer || c.year) && <span className="tl-muted"> · {joinParts([c.issuer, c.year])}</span>}
                </p>
              ))}
            </div>
          )}
          {cv.languages.length > 0 && (
            <div>
              <h2>Languages</h2>
              {cv.languages.map((l) => (
                <p key={l.id}>
                  <b>{l.name}</b>
                  {l.level && <span className="tl-muted"> · {l.level}</span>}
                </p>
              ))}
            </div>
          )}
        </Block>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="tl-section">
      <h2>{title}</h2>
      <div className="tl-line">{children}</div>
    </Block>
  );
}

function Item({ date, children }: { date: string; children: ReactNode }) {
  return (
    <div className="tl-item">
      <div className="tl-date">{date}</div>
      <div className="tl-dot" aria-hidden="true" />
      <div className="tl-content">{children}</div>
    </div>
  );
}

function Tags({ items }: { items: string }) {
  const list = splitItems(items);
  if (!list.length) return null;
  return (
    <div className="tl-tags">
      {list.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
