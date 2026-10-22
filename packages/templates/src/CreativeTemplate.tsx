import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import {
  Block,
  Bullets,
  ContactText,
  contacts,
  joinParts,
  ProjectLinks,
  splitItems,
  cvLabels,
  Photo,
  PersonalDetailsList,
  type Translate,
} from "./shared";

/** Creative — a bold colour header and a two-column body. */
export function CreativeTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  const hasSide = cv.skills.length + cv.education.length + cv.languages.length + cv.certificates.length > 0;
  // With no experience or projects (a student CV), the side sections take the full width.
  const hasMain = cv.experience.length + cv.projects.length > 0;
  return (
    <div className="tpl tpl-creative">
      <Block as="header" step="personal" className="cr-head">
        <Photo cv={cv} />
        <div className="cr-name">{p.name || tr("Your Name")}</div>
        {p.headline && <div className="cr-headline">{p.headline}</div>}
        {p.tagline && <div className="cr-tagline">{p.tagline}</div>}
        {info.length > 0 && (
          <div className="cr-contact">
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
        <Block step="summary" className="cr-summary">
          <p>{cv.summary}</p>
        </Block>
      )}

      <div className={hasSide && hasMain ? "cr-body" : "cr-body cr-body--single"}>
        {hasMain && (
          <div className="cr-main">
            {cv.experience.length > 0 && (
              <Section step="experience">
                {cv.experience.map((e, i) => (
                  <div key={e.id} className="cr-entry">
                    <div className="cr-entry-head" data-keep-next="">
                      {i === 0 && <Heading title={tr("Experience")} />}
                      <div className="cr-row">
                        <span className="cr-title">{e.role}</span>
                        {e.date && <span className="cr-date">{e.date}</span>}
                      </div>
                      {(e.company || e.location) && (
                        <div className="cr-org">
                          {e.company && <span className="cr-company">{e.company}</span>}
                          {e.company && e.location && <span className="cr-muted"> · </span>}
                          {e.location && <span className="cr-muted">{e.location}</span>}
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
              <Section step="projects">
                {cv.projects.map((pr, i) => (
                  <div key={pr.id} className="cr-entry">
                    <div className="cr-entry-head" data-keep-next="">
                      {i === 0 && <Heading title={tr("Projects")} />}
                      <div className="cr-row">
                        <span className="cr-title">{pr.name}</span>
                        {pr.date && <span className="cr-date">{pr.date}</span>}
                      </div>
                      {pr.links.some((l) => l.trim()) && (
                        <div className="cr-links">
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
          </div>
        )}

        {hasSide && (
          <aside className="cr-side">
            {cv.skills.length > 0 && (
              <SideSection step="skills" title={tr("Skills")}>
                {cv.skills.map((s) => (
                  <div key={s.id} className="cr-skill" data-keep="">
                    {s.category && <div className="cr-skill-cat">{s.category}</div>}
                    <ul className="cr-chips">
                      {splitItems(s.items).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </SideSection>
            )}
            {cv.education.length > 0 && (
              <SideSection step="education" title={tr("Education")}>
                {cv.education.map((ed) => (
                  <div key={ed.id} className="cr-side-item" data-keep="">
                    <div className="cr-side-title">{ed.degree}</div>
                    {ed.school && <div className="cr-company">{ed.school}</div>}
                    {ed.date && <div className="cr-muted cr-num">{ed.date}</div>}
                    {ed.details && <div className="cr-muted">{ed.details}</div>}
                  </div>
                ))}
              </SideSection>
            )}
            {cv.languages.length > 0 && (
              <SideSection step="extras" title={tr("Languages")}>
                {cv.languages.map((l) => (
                  <div key={l.id} className="cr-lang" data-keep="">
                    <span className="cr-side-title">{l.name}</span>
                    {l.level && <span className="cr-muted">{l.level}</span>}
                  </div>
                ))}
              </SideSection>
            )}
            {cv.certificates.length > 0 && (
              <SideSection step="extras" title={tr("Certificates")}>
                {cv.certificates.map((c) => (
                  <div key={c.id} className="cr-side-item" data-keep="">
                    <div className="cr-side-title">{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</div>
                    {(c.issuer || c.year) && <div className="cr-muted cr-num">{joinParts([c.issuer, c.year])}</div>}
                  </div>
                ))}
              </SideSection>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Heading({ title }: { title: string }) {
  return <h2 data-keep-next="">{title}</h2>;
}

/**
 * A main-column section. Its heading sits inside the first entry's head (see the callers), so the
 * heading can't be left alone at the bottom of a page: Chrome doesn't honour break-after inside grid items.
 */
function Section({ step, children }: { step: StepId; children: ReactNode }) {
  return (
    <Block step={step} className="cr-section">
      {children}
    </Block>
  );
}

/** A side-column section: the heading and its first (short) item are kept together. */
function SideSection({ step, title, children }: { step: StepId; title: string; children: ReactNode[] }) {
  const [first, ...rest] = children;
  return (
    <Block step={step} className="cr-section">
      <div className="cr-keep" data-keep="">
        <Heading title={title} />
        {first}
      </div>
      {rest}
    </Block>
  );
}

function Stack({ value, tr }: { value: string; tr: Translate }) {
  if (!value.trim()) return null;
  return (
    <p className="cr-stack">
      <span className="cr-stack-label">{tr("Stack:")}</span> {value}
    </p>
  );
}
