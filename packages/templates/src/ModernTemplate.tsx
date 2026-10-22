import { clean, linkHref, linkLabel, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { cvLabels, Photo, PersonalDetailsList, splitItems, type Translate } from "./shared";

const filled = (...parts: (string | string[])[]) =>
  parts.some((p) => (Array.isArray(p) ? clean(p).length > 0 : p.trim() !== ""));

/** Rough height of a text in lines at a given number of characters per line. */
const lines = (text: string, perLine: number) => (text.trim() ? Math.ceil(text.trim().length / perLine) : 0);

/**
 * Modern — serif name, contact block on the inline-end side, and a two-column body:
 * experience and projects in the main column, skills and the rest in a side panel.
 *
 * The side panel floats at the inline-end edge, so once it ends the main column takes the full
 * width (no tall empty column on page 2). Each main entry is its own formatting context, so an
 * entry is either wholly beside the panel or wholly below it.
 */
export function ModernTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);

  const contact: ReactNode[] = [
    p.email.trim() && (
      <a key="email" href={`mailto:${p.email.trim()}`}>
        {p.email.trim()}
      </a>
    ),
    p.phone.trim() && (
      <span key="phone" className="cv-ltr" dir="ltr">
        {p.phone.trim()}
      </span>
    ),
    p.location.trim() && <span key="loc">{p.location.trim()}</span>,
    ...[p.website, p.linkedin, p.github]
      .filter((v) => v.trim())
      .map((v) => (
        <a key={v} href={linkHref(v)}>
          {linkLabel(v)}
        </a>
      )),
    p.extra.trim() && <span key="extra">{p.extra.trim()}</span>,
  ].filter(Boolean);

  const experience = cv.experience.filter((e) => filled(e.role, e.company, e.bullets));
  const projects = cv.projects.filter((pr) => filled(pr.name, pr.bullets));
  const skills = cv.skills.filter((s) => filled(s.items));
  const education = cv.education.filter((ed) => filled(ed.degree, ed.school));
  const certificates = cv.certificates.filter((c) => filled(c.name));
  const languages = cv.languages.filter((l) => filled(l.name));

  // Estimated heights in body lines, to keep the two columns in proportion: when the side panel
  // would run far past the main column, skills move into the main column as label/value rows.
  const mainLines =
    [...experience, ...projects].reduce(
      (n, e) => n + 2.6 + clean(e.bullets).reduce((m, b) => m + lines(b, 78), 0) + lines(e.stack, 90),
      0,
    ) + (experience.length > 0 ? 2.5 : 0) + (projects.length > 0 ? 2.5 : 0);
  const skillLines = skills.reduce((n, s) => n + 1.6 + lines(splitItems(s.items).join(", "), 34), 0) + 2.5;
  const restLines =
    education.reduce((n, ed) => n + 1.6 + lines(ed.degree, 34) + lines(ed.school, 34) + lines([ed.date, ed.details].join(" · "), 34), 0) +
    certificates.reduce((n, c) => n + 1.4 + lines(c.name, 34) + 1, 0) +
    languages.length * 1.2 +
    (education.length > 0 ? 2.5 : 0) +
    (certificates.length > 0 ? 2.5 : 0) +
    (languages.length > 0 ? 2.5 : 0);

  const hasMain = experience.length + projects.length > 0;
  const skillsInMain = hasMain && skills.length > 0 && skillLines + restLines > mainLines * 1.2 + 8;
  const sideSkills = skillsInMain ? [] : skills;
  const hasSide = sideSkills.length + education.length + certificates.length + languages.length > 0;
  const layout = !hasSide ? "m-body--main-only" : !hasMain ? "m-body--side-only" : "";

  return (
    <div className="tpl-modern">
      <header data-step="personal" className="m-header" data-keep>
        <Photo cv={cv} />
        <div className="m-ident">
          <div className="m-name">{p.name.trim() || tr("Your Name")}</div>
          {p.headline.trim() && <div className="m-headline">{p.headline}</div>}
          {p.tagline.trim() && <div className="m-tagline">{p.tagline}</div>}
        </div>
        {contact.length > 0 && (
          <div className="m-contact">
            {contact.map((c, i) => (
              <div key={i}>{c}</div>
            ))}
          </div>
        )}
        <PersonalDetailsList cv={cv} tr={tr} className="m-details" />
      </header>

      {cv.summary.trim() && (
        <p className="m-summary" data-step="summary">
          {cv.summary.trim()}
        </p>
      )}

      {(hasMain || hasSide) && (
        <div className={`m-body ${layout}`.trim()}>
          {hasSide && (
            <aside className="m-side">
              {sideSkills.length > 0 && (
                <Section step="skills" title={tr("Skills")}>
                  {sideSkills.map((s) => (
                    <div key={s.id} className="m-side-item m-skill" data-keep>
                      {s.category.trim() && <div className="m-side-title">{s.category}</div>}
                      <div className="m-side-text">{splitItems(s.items).join(", ")}</div>
                    </div>
                  ))}
                </Section>
              )}

              {education.length > 0 && (
                <Section step="education" title={tr("Education")}>
                  {education.map((ed) => (
                    <div key={ed.id} className="m-side-item" data-keep>
                      <div className="m-side-title">{ed.degree}</div>
                      {ed.school.trim() && <div className="m-side-text">{ed.school}</div>}
                      {ed.date.trim() && <div className="m-side-muted m-num">{ed.date}</div>}
                      {ed.details.trim() && <div className="m-side-muted">{ed.details}</div>}
                    </div>
                  ))}
                </Section>
              )}

              {certificates.length > 0 && (
                <Section step="extras" title={tr("Certificates")}>
                  {certificates.map((c) => (
                    <div key={c.id} className="m-side-item" data-keep>
                      <div className="m-side-title">
                        {c.url.trim() ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
                      </div>
                      {(c.issuer.trim() || c.year.trim()) && (
                        <div className="m-side-muted m-num">{[c.issuer.trim(), c.year.trim()].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {languages.length > 0 && (
                <Section step="extras" title={tr("Languages")}>
                  {languages.map((l) => (
                    <div key={l.id} className="m-lang" data-keep>
                      <span className="m-side-title">{l.name}</span>
                      {l.level.trim() && <span className="m-side-muted">{l.level}</span>}
                    </div>
                  ))}
                </Section>
              )}
            </aside>
          )}

          {hasMain && (
            <div className="m-main">
              {experience.length > 0 && (
                <Section step="experience" title={tr("Experience")}>
                  {experience.map((e) => (
                    <Entry
                      key={e.id}
                      tr={tr}
                      title={e.role.trim() || e.company}
                      meta={e.date}
                      sub={
                        (e.role.trim() && e.company.trim()) || e.location.trim() ? (
                          <>
                            {e.role.trim() && e.company.trim() && <span className="m-org">{e.company}</span>}
                            {e.role.trim() && e.company.trim() && e.location.trim() && <span className="m-sep"> · </span>}
                            {e.location.trim() && <span className="m-loc">{e.location}</span>}
                          </>
                        ) : null
                      }
                      bullets={e.bullets}
                      stack={e.stack}
                    />
                  ))}
                </Section>
              )}

              {projects.length > 0 && (
                <Section step="projects" title={tr("Projects")}>
                  {projects.map((pr) => {
                    const links = clean(pr.links);
                    return (
                      <Entry
                        key={pr.id}
                        tr={tr}
                        title={pr.name}
                        meta={pr.date}
                        sub={
                          links.length > 0
                            ? links.map((l, i) => (
                                <span key={l}>
                                  {i > 0 && <span className="m-sep"> · </span>}
                                  <a href={linkHref(l)}>{linkLabel(l)}</a>
                                </span>
                              ))
                            : null
                        }
                        bullets={pr.bullets}
                        stack={pr.stack}
                      />
                    );
                  })}
                </Section>
              )}

              {skillsInMain && (
                <Section step="skills" title={tr("Skills")}>
                  <div className="m-skill-rows">
                    {skills.map((s) => (
                      <div key={s.id} className="m-side-item m-skill-row" data-keep>
                        <div className="m-side-title">{s.category}</div>
                        <div className="m-side-text">{splitItems(s.items).join(", ")}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <section className="m-section" data-step={step}>
      <h2 className="m-title" data-keep-next>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Entry({
  tr,
  title,
  meta,
  sub,
  bullets = [],
  stack,
}: {
  tr: Translate;
  title: ReactNode;
  meta?: string;
  sub?: ReactNode;
  bullets?: string[];
  stack?: string;
}) {
  const items = clean(bullets);
  const tools = stack ? splitItems(stack) : [];
  return (
    <div className="m-entry">
      <div className="m-entry-top" data-keep data-keep-next>
        <div className="m-entry-head">
          <h3 className="m-entry-title">{title}</h3>
          {meta?.trim() && <div className="m-entry-meta">{meta}</div>}
        </div>
        {sub && <div className="m-entry-sub">{sub}</div>}
      </div>
      {items.length > 0 && (
        <ul>
          {items.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {tools.length > 0 && (
        <div className="m-stack">
          <span className="m-stack-label">{tr("Stack:")}</span> {tools.join(", ")}
        </div>
      )}
    </div>
  );
}
