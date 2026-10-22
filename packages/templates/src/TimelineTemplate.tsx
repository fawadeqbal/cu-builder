import { clean, linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, ProjectLinks, splitItems, cvLabels, Photo, PersonalDetailsList, type Translate } from "./shared";

const filled = (...parts: (string | string[])[]) =>
  parts.some((p) => (Array.isArray(p) ? clean(p).length > 0 : p.trim() !== ""));

/** Timeline — dates in a column on the start side of a vertical line, a dot per entry. */
export function TimelineTemplate({ cv }: { cv: CV }) {
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
    <div className="tpl tpl-timeline">
      <Block as="header" step="personal" className="tl-head">
        <Photo cv={cv} />
        <div className="tl-name">{p.name.trim() || tr("Your Name")}</div>
        {p.headline.trim() && <div className="tl-headline">{p.headline}</div>}
        {p.tagline.trim() && <div className="tl-tagline">{p.tagline}</div>}
        {info.length > 0 && (
          <div className="tl-contact">
            {info.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        )}
        <PersonalDetailsList cv={cv} tr={tr} />
      </Block>

      {cv.summary.trim() && (
        <Block step="summary" className="tl-summary">
          <p>{cv.summary.trim()}</p>
        </Block>
      )}

      {experience.length > 0 && (
        <Section step="experience" title={tr("Experience")}>
          {experience.map((e) => (
            <Item
              key={e.id}
              date={e.date}
              head={
                <>
                  <h3 className="tl-title">{e.role.trim() || e.company}</h3>
                  {((e.role.trim() && e.company.trim()) || e.location.trim()) && (
                    <div className="tl-org">
                      {e.role.trim() && e.company.trim() && <span className="tl-company">{e.company}</span>}
                      {e.role.trim() && e.company.trim() && e.location.trim() && <span className="tl-muted"> · </span>}
                      {e.location.trim() && <span className="tl-muted">{e.location}</span>}
                    </div>
                  )}
                </>
              }
            >
              <Bullets items={e.bullets} />
              <Stack tr={tr} items={e.stack} />
            </Item>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section step="projects" title={tr("Projects")}>
          {projects.map((pr) => (
            <Item
              key={pr.id}
              date={pr.date}
              head={
                <>
                  <h3 className="tl-title">{pr.name}</h3>
                  {pr.links.some((l) => l.trim()) && (
                    <div className="tl-org tl-links">
                      <ProjectLinks links={pr.links} />
                    </div>
                  )}
                </>
              }
            >
              <Bullets items={pr.bullets} />
              <Stack tr={tr} items={pr.stack} />
            </Item>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section step="education" title={tr("Education")}>
          {education.map((ed) => (
            <Item
              key={ed.id}
              date={ed.date}
              keep
              head={
                <>
                  <h3 className="tl-title">{ed.degree.trim() || ed.school}</h3>
                  {ed.degree.trim() && ed.school.trim() && (
                    <div className="tl-org">
                      <span className="tl-company">{ed.school}</span>
                    </div>
                  )}
                </>
              }
            >
              {ed.details.trim() && <div className="tl-muted tl-detail">{ed.details}</div>}
            </Item>
          ))}
        </Section>
      )}

      {skills.length > 0 && (
        <Block step="skills" className="tl-section">
          <h2 data-keep-next>{tr("Skills")}</h2>
          <div className="tl-rows">
            {skills.map((s) => (
              <div key={s.id} className="tl-row" data-keep>
                <div className="tl-label">{s.category}</div>
                <div className="tl-value">{splitItems(s.items).join(", ")}</div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {certificates.length > 0 && (
        <Block step="extras" className="tl-section">
          <h2 data-keep-next>{tr("Certificates")}</h2>
          <div className="tl-rows">
            {certificates.map((c) => (
              <div key={c.id} className="tl-row" data-keep>
                <div className="tl-label tl-num">{c.year}</div>
                <div className="tl-value">
                  <span className="tl-cert">{c.url.trim() ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</span>
                  {c.issuer.trim() && <span className="tl-muted"> · {c.issuer}</span>}
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {languages.length > 0 && (
        <Block step="extras" className="tl-section">
          <h2 data-keep-next>{tr("Languages")}</h2>
          <div className="tl-rows">
            <div className="tl-row" data-keep>
              <div className="tl-label" />
              <div className="tl-value tl-langs">
                {languages.map((l) => (
                  <span key={l.id} className="tl-lang">
                    <span className="tl-lang-name">{l.name}</span>
                    {l.level.trim() && <span className="tl-muted"> ({l.level})</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Block>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="tl-section">
      <h2 data-keep-next>{title}</h2>
      <div className="tl-line">{children}</div>
    </Block>
  );
}

/** "Oct 2025 – Present" → two halves that wrap as units, so a long range breaks after the dash. */
function DateText({ date }: { date: string }) {
  const parts = date.trim().split(/\s+[–—-]\s+|\s*[–—]\s*/);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return <span className="tl-nowrap">{date.trim()}</span>;
  return (
    <>
      <span className="tl-nowrap">{parts[0]} –</span> <span className="tl-nowrap">{parts[1]}</span>
    </>
  );
}

function Item({ date, head, keep, children }: { date: string; head: ReactNode; keep?: boolean; children?: ReactNode }) {
  return (
    <div className="tl-item" data-keep={keep || undefined}>
      <div className="tl-date">{date.trim() && <DateText date={date} />}</div>
      <div className="tl-rail" aria-hidden="true">
        <span className="tl-dot" />
      </div>
      <div className="tl-content">
        <div className="tl-top" data-keep data-keep-next>
          {head}
        </div>
        {children}
      </div>
    </div>
  );
}

function Stack({ tr, items }: { tr: Translate; items: string }) {
  const list = splitItems(items);
  if (!list.length) return null;
  return (
    <div className="tl-stack">
      <span className="tl-stack-label">{tr("Stack:")}</span> {list.join(", ")}
    </div>
  );
}
