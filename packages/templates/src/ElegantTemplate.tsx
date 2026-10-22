import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Elegant — all serif, centred, small-caps headings between fine rules. */
export function ElegantTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  return (
    <div className="tpl tpl-elegant">
      <Block as="header" step="personal" className="el-head">
        <Photo cv={cv} />
        <div className="el-name">{p.name || tr("Your Name")}</div>
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
        <PersonalDetailsList cv={cv} tr={tr} />
      </Block>

      {(cv.summary.trim() || p.tagline) && (
        <Section step="summary" title={tr("Profile")}>
          {cv.summary.trim() && <p className="el-lead">{cv.summary}</p>}
          {p.tagline && <p className="el-tagline">{p.tagline}</p>}
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title={tr("Professional Experience")}>
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
        <Section step="projects" title={tr("Selected Projects")}>
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
        <Section step="education" title={tr("Education")}>
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
        <Section step="skills" title={tr("Expertise")}>
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
        <Section step="extras" title={tr("Additional")}>
          {cv.certificates.length > 0 && (
            <p>
              <b>{tr("Certifications")}. </b>
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
              <b>{tr("Languages")}. </b>
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
