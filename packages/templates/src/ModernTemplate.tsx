import { clean, linkHref, linkLabel, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";

/**
 * Modern — serif name, contact block on the right, and a two-column body:
 * experience and projects in the main column, skills and the rest in a side panel.
 */
export function ModernTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;

  const contact: ReactNode[] = [
    p.email && (
      <a key="email" href={`mailto:${p.email}`}>
        {p.email}
      </a>
    ),
    p.phone && <span key="phone">{p.phone}</span>,
    p.location && <span key="loc">{p.location}</span>,
    ...[p.website, p.github, p.linkedin].filter(Boolean).map((v) => (
      <a key={v} href={linkHref(v)}>
        {linkLabel(v)}
      </a>
    )),
    p.extra && <span key="extra">{p.extra}</span>,
  ].filter(Boolean);

  const hasSide =
    cv.skills.length + cv.education.length + cv.certificates.length + cv.languages.length > 0;

  return (
    <div className="tpl-modern">
      <header data-step="personal" className="m-header">
        <div>
          <div className="m-name">{p.name || "Your Name"}</div>
          {p.headline && <div className="m-headline">{p.headline}</div>}
          {p.tagline && <div className="m-tagline">{p.tagline}</div>}
        </div>
        {contact.length > 0 && (
          <div className="m-contact">
            {contact.map((c, i) => (
              <div key={i}>{c}</div>
            ))}
          </div>
        )}
      </header>

      {cv.summary.trim() && <p className="m-summary" data-step="summary">{cv.summary}</p>}

      <div className={hasSide ? "m-body" : "m-body m-body--single"}>
        <div className="m-main">
          {cv.experience.length > 0 && (
            <Section step="experience" title="Experience">
              {cv.experience.map((e) => (
                <Entry
                  key={e.id}
                  title={e.role}
                  meta={e.date}
                  sub={[e.company, e.location].filter(Boolean).join(" · ")}
                  bullets={e.bullets}
                  stack={e.stack}
                />
              ))}
            </Section>
          )}

          {cv.projects.length > 0 && (
            <Section step="projects" title="Projects">
              {cv.projects.map((pr) => {
                const links = clean(pr.links);
                return (
                  <Entry
                    key={pr.id}
                    title={pr.name}
                    meta={pr.date}
                    sub={
                      links.length > 0
                        ? links.map((l, i) => (
                            <span key={l}>
                              {i > 0 && " · "}
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
        </div>

        {hasSide && (
          <aside className="m-side">
            {cv.skills.length > 0 && (
              <Section step="skills" title="Skills">
                {cv.skills.map((s) => (
                  <div key={s.id} className="m-side-item">
                    <div className="m-side-title">{s.category}</div>
                    <div className="m-side-text">{s.items}</div>
                  </div>
                ))}
              </Section>
            )}

            {cv.education.length > 0 && (
              <Section step="education" title="Education">
                {cv.education.map((ed) => (
                  <div key={ed.id} className="m-side-item">
                    <div className="m-side-title">{ed.degree}</div>
                    <div className="m-side-text">{ed.school}</div>
                    {(ed.date || ed.details) && (
                      <div className="m-side-muted">
                        {[ed.date, ed.details].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {cv.certificates.length > 0 && (
              <Section step="extras" title="Certificates">
                {cv.certificates.map((c) => (
                  <div key={c.id} className="m-side-item">
                    <div className="m-side-title">
                      {c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
                    </div>
                    {(c.issuer || c.year) && (
                      <div className="m-side-muted">
                        {[c.issuer, c.year].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {cv.languages.length > 0 && (
              <Section step="extras" title="Languages">
                {cv.languages.map((l) => (
                  <div key={l.id} className="m-lang">
                    <span className="m-side-title">{l.name}</span>
                    {l.level && <span className="m-side-muted">{l.level}</span>}
                  </div>
                ))}
              </Section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <section className="m-section" data-step={step}>
      <h2 className="m-title">{title}</h2>
      {children}
    </section>
  );
}

function Entry({
  title,
  meta,
  sub,
  bullets = [],
  stack,
}: {
  title: ReactNode;
  meta?: string;
  sub?: ReactNode;
  bullets?: string[];
  stack?: string;
}) {
  const items = clean(bullets);
  return (
    <div className="m-entry">
      <div className="m-entry-head">
        <div className="m-entry-title">{title}</div>
        {meta && <div className="m-entry-meta">{meta}</div>}
      </div>
      {sub && <div className="m-entry-sub">{sub}</div>}
      {items.length > 0 && (
        <ul>
          {items.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {stack && <div className="m-stack">{stack}</div>}
    </div>
  );
}
