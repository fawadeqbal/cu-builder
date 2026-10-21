import type { ReactNode } from "react";
import { linkHref } from "@/lib/cv";
import type { StepId } from "@/lib/steps";
import type { CV } from "@/lib/types";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks } from "./shared";

/** Elegant — all serif, centred, small-caps headings between fine rules. */
export function ElegantTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const info = contacts(p);
  return (
    <div className="tpl tpl-elegant">
      <Block as="header" step="personal" className="el-head">
        <div className="el-name">{p.name || "Your Name"}</div>
        {p.headline && <div className="el-headline">{p.headline}</div>}
        {info.length > 0 && (
          <div className="el-contact">
            {info.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        )}
      </Block>

      {(cv.summary.trim() || p.tagline) && (
        <Section step="summary" title="Profile">
          {cv.summary.trim() && <p className="el-lead">{cv.summary}</p>}
          {p.tagline && <p className="el-tagline">{p.tagline}</p>}
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title="Professional Experience">
          {cv.experience.map((e) => (
            <div key={e.id} className="el-entry">
              <div className="el-row">
                <span>
                  <b>{e.role}</b>
                  {e.company && <i>, {e.company}</i>}
                </span>
                <span className="el-date">{e.date}</span>
              </div>
              {e.location && <div className="el-muted">{e.location}</div>}
              <Bullets items={e.bullets} />
              {e.stack && <div className="el-muted el-small">{e.stack}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title="Selected Projects">
          {cv.projects.map((pr) => (
            <div key={pr.id} className="el-entry">
              <div className="el-row">
                <b>{pr.name}</b>
                <span className="el-date">{pr.date}</span>
              </div>
              {pr.links.some((l) => l.trim()) && (
                <div className="el-muted el-small">
                  <ProjectLinks links={pr.links} />
                </div>
              )}
              <Bullets items={pr.bullets} />
            </div>
          ))}
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title="Education">
          {cv.education.map((ed) => (
            <div key={ed.id} className="el-entry">
              <div className="el-row">
                <span>
                  <b>{ed.degree}</b>
                  {ed.school && <i>, {ed.school}</i>}
                </span>
                <span className="el-date">{ed.date}</span>
              </div>
              {ed.details && <div className="el-muted">{ed.details}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title="Expertise">
          <div className="el-skills">
            {cv.skills.map((s) => (
              <p key={s.id}>
                <b>{s.category}</b>
                <span>{s.items}</span>
              </p>
            ))}
          </div>
        </Section>
      )}

      {cv.certificates.length + cv.languages.length > 0 && (
        <Section step="extras" title="Additional">
          {cv.certificates.length > 0 && (
            <p>
              <b>Certifications. </b>
              {cv.certificates.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && "; "}
                  {c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
                  {(c.issuer || c.year) && <i> ({joinParts([c.issuer, c.year], ", ")})</i>}
                </span>
              ))}
            </p>
          )}
          {cv.languages.length > 0 && (
            <p>
              <b>Languages. </b>
              {cv.languages.map((l) => joinParts([l.name, l.level && `(${l.level})`], " ")).join("; ")}
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="el-section">
      <h2>
        <span>{title}</span>
      </h2>
      {children}
    </Block>
  );
}
