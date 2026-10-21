import type { ReactNode } from "react";
import { clean, linkHref, linkLabel } from "@/lib/cv";
import type { StepId } from "@/lib/steps";
import type { CV } from "@/lib/types";

/**
 * Classic — a Europass-style layout: section labels in a narrow left column,
 * content on the right, one blue accent colour and justified body text.
 */
export function ClassicTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;

  const contactRow1: ReactNode[] = [
    p.phone && <span key="phone">{p.phone}</span>,
    p.email && (
      <span key="email">
        <a href={`mailto:${p.email}`}>{p.email}</a>
      </span>
    ),
    p.location && <span key="loc">{p.location}</span>,
  ].filter(Boolean);

  const contactRow2: ReactNode[] = [
    ...[p.website, p.github, p.linkedin].filter(Boolean).map((v) => (
      <span key={v}>
        <a href={linkHref(v)}>{linkLabel(v)}</a>
      </span>
    )),
    p.extra && <span key="extra">{p.extra}</span>,
  ].filter(Boolean);

  return (
    <div className="tpl-classic">
      <header data-step="personal" className="c-header">
        <div className="c-name">{p.name || "Your Name"}</div>
        {p.headline && <div className="c-headline">{p.headline}</div>}
        {p.tagline && <div className="c-tagline">{p.tagline}</div>}
        {contactRow1.length > 0 && <div className="c-contact">{contactRow1}</div>}
        {contactRow2.length > 0 && <div className="c-contact">{contactRow2}</div>}
      </header>

      {cv.summary.trim() && (
        <Section step="summary" label="About me">
          <p>{cv.summary}</p>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section
          step="experience"
          label={
            <>
              Work
              <br />
              experience
            </>
          }
        >
          {cv.experience.map((e) => (
            <Entry
              key={e.id}
              title={
                <>
                  {e.role}
                  {e.company && (
                    <>
                      {e.role && " — "}
                      <span className="c-org">{e.company}</span>
                    </>
                  )}
                </>
              }
              meta={e.date}
              sub={e.location}
              bullets={e.bullets}
              stack={e.stack}
            />
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" label="Skills">
          <div className="c-skills">
            {cv.skills.map((s) => (
              <div key={s.id} className="c-skill-row">
                <div className="c-skill-cat">{s.category}</div>
                <div>{s.items}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" label="Projects">
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

      {cv.education.length > 0 && (
        <Section
          step="education"
          label={
            <>
              Education
              <br />
              and training
            </>
          }
        >
          {cv.education.map((ed) => (
            <Entry
              key={ed.id}
              title={
                <>
                  {ed.degree}
                  {ed.school && (
                    <>
                      {ed.degree && " — "}
                      <span className="c-org">{ed.school}</span>
                    </>
                  )}
                </>
              }
              meta={ed.date}
              sub={ed.details}
            />
          ))}
        </Section>
      )}

      {cv.certificates.length > 0 && (
        <Section step="extras" label="Certificates">
          <ul className="c-compact">
            {cv.certificates.map((c) => (
              <li key={c.id}>
                {c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
                {(c.issuer || c.year) && ` — ${[c.issuer, c.year].filter(Boolean).join(", ")}`}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {cv.languages.length > 0 && (
        <Section step="extras" label="Languages">
          <p className="c-left">
            {cv.languages.map((l, i) => (
              <span key={l.id}>
                {i > 0 && " · "}
                <b>{l.name}</b>
                {l.level && ` — ${l.level}`}
              </span>
            ))}
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({ step, label, children }: { step: StepId; label: ReactNode; children: ReactNode }) {
  return (
    <section className="c-section" data-step={step}>
      <div className="c-label">{label}</div>
      <div className="c-content">{children}</div>
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
    <div className="c-entry">
      <div className="c-entry-head">
        <div className="c-entry-title">{title}</div>
        {meta && <div className="c-entry-meta">{meta}</div>}
      </div>
      {sub && <div className="c-entry-sub">{sub}</div>}
      {items.length > 0 && (
        <ul>
          {items.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {stack && (
        <div className="c-stack">
          <b>Stack:</b> {stack}
        </div>
      )}
    </div>
  );
}
