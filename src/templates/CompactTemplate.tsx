import type { ReactNode } from "react";
import { linkHref } from "@/lib/cv";
import type { StepId } from "@/lib/steps";
import type { CV } from "@/lib/types";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks } from "./shared";

/** Compact — dense, small type, name left and contact right; built to fit one page. */
export function CompactTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const info = contacts(p);
  return (
    <div className="tpl tpl-compact">
      <Block as="header" step="personal" className="cp-head">
        <div>
          <div className="cp-name">{p.name || "Your Name"}</div>
          {p.headline && <div className="cp-headline">{p.headline}</div>}
          {p.tagline && <div className="cp-tagline">{p.tagline}</div>}
        </div>
        {info.length > 0 && (
          <div className="cp-contact">
            {info.map((c) => (
              <div key={c.key}>
                <ContactText c={c} />
              </div>
            ))}
          </div>
        )}
      </Block>

      {cv.summary.trim() && (
        <Section step="summary" title="Summary">
          <p>{cv.summary}</p>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title="Experience">
          {cv.experience.map((e) => (
            <div key={e.id} className="cp-entry">
              <div className="cp-row">
                <span>
                  <b>{e.role}</b>
                  {e.company && <span className="cp-org">{e.role ? ", " : ""}{e.company}</span>}
                  {e.location && <span className="cp-muted"> — {e.location}</span>}
                </span>
                <span className="cp-date">{e.date}</span>
              </div>
              <Bullets items={e.bullets} />
              {e.stack && <div className="cp-muted cp-stack">{e.stack}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title="Projects">
          {cv.projects.map((pr) => (
            <div key={pr.id} className="cp-entry">
              <div className="cp-row">
                <span>
                  <b>{pr.name}</b>
                  {pr.links.some((l) => l.trim()) && (
                    <span className="cp-muted">
                      {" — "}
                      <ProjectLinks links={pr.links} />
                    </span>
                  )}
                </span>
                <span className="cp-date">{pr.date}</span>
              </div>
              <Bullets items={pr.bullets} />
              {pr.stack && <div className="cp-muted cp-stack">{pr.stack}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title="Skills">
          <div className="cp-skills">
            {cv.skills.map((s) => (
              <div key={s.id}>
                <b>{s.category}</b>
                <span>{s.items}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title="Education">
          {cv.education.map((ed) => (
            <div key={ed.id} className="cp-row cp-entry">
              <span>
                <b>{ed.degree}</b>
                {ed.school && <span className="cp-org">{ed.degree ? ", " : ""}{ed.school}</span>}
                {ed.details && <span className="cp-muted"> — {ed.details}</span>}
              </span>
              <span className="cp-date">{ed.date}</span>
            </div>
          ))}
        </Section>
      )}

      {cv.certificates.length + cv.languages.length > 0 && (
        <Section step="extras" title="Extras">
          {cv.certificates.length > 0 && (
            <p>
              <b>Certificates: </b>
              {cv.certificates.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && "; "}
                  {c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
                  {(c.issuer || c.year) && ` (${joinParts([c.issuer, c.year], ", ")})`}
                </span>
              ))}
            </p>
          )}
          {cv.languages.length > 0 && (
            <p>
              <b>Languages: </b>
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
    <Block step={step} className="cp-section">
      <h2>{title}</h2>
      <div className="cp-body">{children}</div>
    </Block>
  );
}
