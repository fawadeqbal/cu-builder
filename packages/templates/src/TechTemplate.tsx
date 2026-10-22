import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import {
  Block,
  Bullets,
  ContactText,
  contacts,
  ProjectLinks,
  splitItems,
  cvLabels,
  Photo,
  PersonalDetailsList,
  type Translate,
} from "./shared";

/** Developer — mono accents, skill chips, and projects right after experience. */
export function TechTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  return (
    <div className="tpl tpl-tech">
      <Block as="header" step="personal" className="tc-head">
        <Photo cv={cv} />
        <div className="tc-name">{p.name || tr("Your Name")}</div>
        {p.headline && <div className="tc-headline">{p.headline}</div>}
        {p.tagline && <div className="tc-tagline">{p.tagline}</div>}
        {info.length > 0 && (
          <div className="tc-contact">
            {info.map((c) => (
              <span key={c.key}>
                {c.kind === "phone" ? (
                  <span dir="ltr" className="cv-ltr">
                    {c.text}
                  </span>
                ) : (
                  <ContactText c={c} />
                )}
              </span>
            ))}
          </div>
        )}
        <PersonalDetailsList cv={cv} tr={tr} />
      </Block>

      {cv.summary.trim() && (
        <Section step="summary" title={tr("About")}>
          <p>{cv.summary}</p>
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title={tr("Skills")}>
          <div className="tc-skills">
            {cv.skills.map((s) => (
              <div key={s.id} className="tc-skill" data-keep="">
                <div className="tc-skill-cat">{s.category}</div>
                <Chips items={s.items} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title={tr("Experience")}>
          {cv.experience.map((e) => (
            <div key={e.id} className="tc-entry">
              <div className="tc-entry-head" data-keep-next="">
                <div className="tc-row">
                  <span className="tc-title">{e.role}</span>
                  {e.date && <span className="tc-date">{e.date}</span>}
                </div>
                {(e.company || e.location) && (
                  <div className="tc-sub">
                    {e.company && <span className="tc-org">{e.company}</span>}
                    {e.company && e.location && <span className="tc-muted"> · </span>}
                    {e.location && <span className="tc-muted">{e.location}</span>}
                  </div>
                )}
              </div>
              <Bullets items={e.bullets} />
              <Stack value={e.stack} tr={tr} />
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title={tr("Projects")}>
          {cv.projects.map((pr) => (
            <div key={pr.id} className="tc-entry">
              <div className="tc-entry-head" data-keep-next="">
                <div className="tc-row">
                  <span className="tc-title">{pr.name}</span>
                  {pr.date && <span className="tc-date">{pr.date}</span>}
                </div>
                {pr.links.some((l) => l.trim()) && (
                  <div className="tc-link">
                    <ProjectLinks links={pr.links} />
                  </div>
                )}
              </div>
              <Bullets items={pr.bullets} />
              <Stack value={pr.stack} tr={tr} />
            </div>
          ))}
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title={tr("Education")}>
          {cv.education.map((ed) => (
            <div key={ed.id} className="tc-entry tc-edu" data-keep="">
              <div className="tc-row">
                <span className="tc-title">{ed.degree}</span>
                {ed.date && <span className="tc-date">{ed.date}</span>}
              </div>
              {(ed.school || ed.details) && (
                <div className="tc-sub">
                  {ed.school && <span className="tc-org">{ed.school}</span>}
                  {ed.school && ed.details && <span className="tc-muted"> · </span>}
                  {ed.details && <span className="tc-muted">{ed.details}</span>}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {cv.certificates.length + cv.languages.length > 0 && (
        <div className={cv.certificates.length && cv.languages.length ? "tc-pair" : undefined}>
          {cv.certificates.length > 0 && (
            <Section step="extras" title={tr("Certificates")}>
              {cv.certificates.map((c) => (
                <div key={c.id} className="tc-row tc-cert" data-keep="">
                  <span>
                    <span className="tc-cert-name">{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</span>
                    {c.issuer && <span className="tc-muted"> · {c.issuer}</span>}
                  </span>
                  {c.year && <span className="tc-date">{c.year}</span>}
                </div>
              ))}
            </Section>
          )}

          {cv.languages.length > 0 && (
            <Section step="extras" title={tr("Languages")}>
              {cv.languages.map((l) => (
                <div key={l.id} className="tc-lang" data-keep="">
                  <span className="tc-lang-name">{l.name}</span>
                  {l.level && <span className="tc-muted"> · {l.level}</span>}
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="tc-section">
      <h2 data-keep-next="">{title}</h2>
      {children}
    </Block>
  );
}

function Stack({ value, tr }: { value: string; tr: Translate }) {
  const list = splitItems(value);
  if (!list.length) return null;
  return (
    <p className="tc-stack">
      <span className="tc-stack-label">{tr("Stack:")}</span> <span className="tc-stack-items">{list.join(" · ")}</span>
    </p>
  );
}

function Chips({ items }: { items: string }) {
  const list = splitItems(items);
  if (!list.length) return null;
  return (
    <ul className="tc-chips">
      {list.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}
