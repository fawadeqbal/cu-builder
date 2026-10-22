import { clean, linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks, splitItems, cvLabels, Photo, PersonalDetailsList, type Translate } from "./shared";

const filled = (...parts: (string | string[])[]) =>
  parts.some((p) => (Array.isArray(p) ? clean(p).length > 0 : p.trim() !== ""));

/** Nordic — light type, wide margins, dates in a quiet start-side column. */
export function NordicTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  const experience = cv.experience.filter((e) => filled(e.role, e.company, e.bullets));
  const projects = cv.projects.filter((pr) => filled(pr.name, pr.bullets));
  const education = cv.education.filter((ed) => filled(ed.degree, ed.school));
  const skills = cv.skills.filter((s) => filled(s.items));
  const certificates = cv.certificates.filter((c) => filled(c.name));
  const languages = cv.languages.filter((l) => filled(l.name));

  return (
    <div className="tpl tpl-nordic">
      <Block as="header" step="personal" className="n-head">
        <Photo cv={cv} />
        <div className="n-name">{p.name.trim() || tr("Your Name")}</div>
        {p.headline.trim() && <div className="n-headline">{p.headline}</div>}
        {info.length > 0 && (
          <div className="n-contact">
            {info.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        )}
        <PersonalDetailsList cv={cv} tr={tr} />
      </Block>

      {(cv.summary.trim() || p.tagline.trim()) && (
        <Block step="summary" className="n-section">
          <h2 data-keep-next>{tr("About")}</h2>
          <div>
            {cv.summary.trim() && <p className="n-lead">{cv.summary.trim()}</p>}
            {p.tagline.trim() && <p className="n-muted n-tagline">{p.tagline}</p>}
          </div>
        </Block>
      )}

      {experience.length > 0 && (
        <Section step="experience" title={tr("Experience")}>
          {experience.map((e) => (
            <Row
              key={e.id}
              date={e.date}
              head={
                <>
                  <h3 className="n-title">
                    {e.role.trim() || e.company}
                    {e.role.trim() && e.company.trim() && (
                      <>
                        <span className="n-dash"> — </span>
                        <span className="n-org">{e.company}</span>
                      </>
                    )}
                  </h3>
                  {e.location.trim() && <div className="n-muted n-meta">{e.location}</div>}
                </>
              }
            >
              <Bullets items={e.bullets} />
              <Stack tr={tr} items={e.stack} />
            </Row>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section step="projects" title={tr("Projects")}>
          {projects.map((pr) => (
            <Row
              key={pr.id}
              date={pr.date}
              head={
                <>
                  <h3 className="n-title">{pr.name}</h3>
                  {pr.links.some((l) => l.trim()) && (
                    <div className="n-muted n-meta n-links">
                      <ProjectLinks links={pr.links} />
                    </div>
                  )}
                </>
              }
            >
              <Bullets items={pr.bullets} />
              <Stack tr={tr} items={pr.stack} />
            </Row>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section step="education" title={tr("Education")}>
          {education.map((ed) => (
            <Row
              key={ed.id}
              date={ed.date}
              keep
              head={
                <>
                  <h3 className="n-title">{ed.degree.trim() || ed.school}</h3>
                  {ed.degree.trim() && ed.school.trim() && <div className="n-school">{ed.school}</div>}
                </>
              }
            >
              {ed.details.trim() && <div className="n-muted n-meta">{ed.details}</div>}
            </Row>
          ))}
        </Section>
      )}

      {skills.length > 0 && (
        <Section step="skills" title={tr("Skills")} dense>
          {skills.map((s) => (
            <Row key={s.id} label={s.category} keep>
              <div>{splitItems(s.items).join(", ")}</div>
            </Row>
          ))}
        </Section>
      )}

      {certificates.length > 0 && (
        <Section step="extras" title={tr("Certificates")} dense>
          {certificates.map((c) => (
            <Row key={c.id} date={c.year} keep>
              <div>
                <span className="n-cert">{c.url.trim() ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</span>
                {c.issuer.trim() && <span className="n-muted"> — {c.issuer}</span>}
              </div>
            </Row>
          ))}
        </Section>
      )}

      {languages.length > 0 && (
        <Section step="extras" title={tr("Languages")}>
          <Row date="" keep>
            <div className="n-langs">
              {languages.map((l) => (
                <span key={l.id}>
                  <span className="n-lang">{l.name}</span>
                  {l.level.trim() && <span className="n-muted"> — {l.level}</span>}
                </span>
              ))}
            </div>
          </Row>
        </Section>
      )}
    </div>
  );
}

function Section({ step, title, dense, children }: { step: StepId; title: string; dense?: boolean; children: ReactNode }) {
  return (
    <Block step={step} className="n-section">
      <h2 data-keep-next>{title}</h2>
      <div className={dense ? "n-rows n-rows--dense" : "n-rows"}>{children}</div>
    </Block>
  );
}

/** "Oct 2025 – Present" → two halves that wrap as units, so a long range breaks after the dash. */
function DateText({ date }: { date: string }) {
  const parts = date.trim().split(/\s+[–—-]\s+|\s*[–—]\s*/);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return <>{date.trim()}</>;
  return (
    <>
      <span className="n-nowrap">{parts[0]} –</span> <span className="n-nowrap">{parts[1]}</span>
    </>
  );
}

/**
 * One entry: a quiet start-side column (a date, or a label such as a skill category) and the body.
 * `head` stays with the first lines of the body across a page break.
 */
function Row({
  date,
  label,
  head,
  keep,
  children,
}: {
  date?: string;
  label?: string;
  head?: ReactNode;
  keep?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="n-row" data-keep={keep || undefined}>
      {label !== undefined ? (
        <div className="n-date n-label">{label}</div>
      ) : (
        <div className="n-date">{date?.trim() && <DateText date={date} />}</div>
      )}
      <div className="n-body">
        {head && (
          <div className="n-top" data-keep data-keep-next>
            {head}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Stack({ tr, items }: { tr: Translate; items: string }) {
  const list = splitItems(items);
  if (!list.length) return null;
  return (
    <div className="n-muted n-stack">
      <span className="n-stack-label">{tr("Stack:")}</span> {joinParts(list, ", ")}
    </div>
  );
}
