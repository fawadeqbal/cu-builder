import { clean, linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Bullets, ContactText, contacts, joinParts, ProjectLinks, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Boardroom — the name set large in a narrow start column, fine accent rules, a serif summary. */
export function BoardroomTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  const [first, ...rest] = (p.name || tr("Your Name")).trim().split(/\s+/);
  // Without experience or projects the main column would be almost empty: education and skills move there.
  const lean = cv.experience.length + cv.projects.length === 0;

  const education = cv.education.length > 0 && (
    <Section step="education" title={tr("Education")} side={!lean}>
      {cv.education.map((ed) =>
        lean ? (
          <div key={ed.id} className="bd-entry" data-keep>
            <div className="bd-row">
              <h3 className="bd-role">{ed.degree}</h3>
              {ed.date && <span className="bd-date">{ed.date}</span>}
            </div>
            {ed.school && <div className="bd-org">{ed.school}</div>}
            {ed.details && <div className="bd-muted">{ed.details}</div>}
          </div>
        ) : (
          <div key={ed.id} className="bd-side-item" data-keep>
            <h3 className="bd-side-title">{ed.degree}</h3>
            {ed.school && <div>{ed.school}</div>}
            {ed.date && <div className="bd-muted">{ed.date}</div>}
            {ed.details && <div className="bd-muted">{ed.details}</div>}
          </div>
        ),
      )}
    </Section>
  );

  const skills = cv.skills.length > 0 && (
    <Section step="skills" title={tr("Expertise")} side={!lean}>
      {cv.skills.map((s) =>
        lean ? (
          <div key={s.id} className="bd-def" data-keep>
            <div className="bd-def-label">{s.category}</div>
            <div>{s.items}</div>
          </div>
        ) : (
          <div key={s.id} className="bd-side-item" data-keep>
            {s.category && <h3 className="bd-side-title">{s.category}</h3>}
            <div>{s.items}</div>
          </div>
        ),
      )}
    </Section>
  );

  return (
    <div className="tpl tpl-boardroom">
      <div className="bd-side">
        <header data-step="personal" className="bd-id" data-keep>
          <Photo cv={cv} variant="side" />
          <div className="bd-name">
            <span>{first}</span>
            {rest.length > 0 && <span>{rest.join(" ")}</span>}
          </div>
          {p.headline && <div className="bd-headline">{p.headline}</div>}
          <div className="bd-rule" aria-hidden="true" />
          {info.length > 0 && (
            <div className="bd-contact">
              {info.map((c) => (
                <div key={c.key}>
                  <span>
                    <ContactText c={c} />
                  </span>
                </div>
              ))}
            </div>
          )}
          <PersonalDetailsList cv={cv} tr={tr} />
        </header>

        {!lean && education}
        {!lean && skills}

        {cv.languages.length > 0 && (
          <Section step="extras" title={tr("Languages")} side>
            {cv.languages.map((l) => (
              <div key={l.id} className="bd-side-item" data-keep>
                <h3 className="bd-side-title">{l.name}</h3>
                {l.level && <div className="bd-muted">{l.level}</div>}
              </div>
            ))}
          </Section>
        )}

        {cv.certificates.length > 0 && (
          <Section step="extras" title={tr("Credentials")} side>
            {cv.certificates.map((c) => (
              <div key={c.id} className="bd-side-item" data-keep>
                <h3 className="bd-side-title">{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</h3>
                {(c.issuer || c.year) && <div className="bd-muted">{joinParts([c.issuer, c.year])}</div>}
              </div>
            ))}
          </Section>
        )}
      </div>

      <div className="bd-main">
        {(cv.summary.trim() || p.tagline) && (
          <section data-step="summary" className="bd-summary">
            {cv.summary.trim() && <p>{cv.summary}</p>}
            {p.tagline && <p className="bd-tagline">{p.tagline}</p>}
          </section>
        )}

        {cv.experience.length > 0 && (
          <Section step="experience" title={tr("Experience")}>
            {cv.experience.map((e) => (
              <div key={e.id} className="bd-entry">
                <div className="bd-entry-head" data-keep-next>
                  <div className="bd-row">
                    <h3 className="bd-role">{e.role}</h3>
                    {e.date && <span className="bd-date">{e.date}</span>}
                  </div>
                  {(e.company || e.location) && (
                    <div className="bd-org">
                      {e.company && <span className="bd-company">{e.company}</span>}
                      {e.company && e.location && " · "}
                      {e.location}
                    </div>
                  )}
                </div>
                <BulletsAndStack items={e.bullets} stack={e.stack} />
              </div>
            ))}
          </Section>
        )}

        {cv.projects.length > 0 && (
          <Section step="projects" title={tr("Selected Work")}>
            {cv.projects.map((pr) => (
              <div key={pr.id} className="bd-entry">
                <div className="bd-entry-head" data-keep-next>
                  <div className="bd-row">
                    <h3 className="bd-role">{pr.name}</h3>
                    {pr.date && <span className="bd-date">{pr.date}</span>}
                  </div>
                  {pr.links.some((l) => l.trim()) && (
                    <div className="bd-org bd-links">
                      <ProjectLinks links={pr.links} />
                    </div>
                  )}
                </div>
                <Bullets items={pr.bullets} />
              </div>
            ))}
          </Section>
        )}

        {lean && education}
        {lean && skills}
      </div>
    </div>
  );
}

function Section({ step, title, side, children }: { step: StepId; title: string; side?: boolean; children: ReactNode }) {
  return (
    <section data-step={step} className={side ? "bd-side-section" : "bd-section"}>
      <h2 data-keep-next>{title}</h2>
      {children}
    </section>
  );
}

/**
 * The bullets, then the tools line. The last bullet and the tools line stay together, so a page
 * never starts with the tools line alone.
 */
function BulletsAndStack({ items, stack }: { items: string[]; stack?: string }) {
  const list = clean(items);
  const tail = stack?.trim() ? <div className="bd-stack">{stack}</div> : null;
  if (!tail) return <Bullets items={list} />;
  if (!list.length) return tail;
  return (
    <>
      {list.length > 1 && (
        <ul>
          {list.slice(0, -1).map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      <div className={list.length > 1 ? "bd-tail" : undefined} data-keep>
        <ul>
          <li>{list.at(-1)}</li>
        </ul>
        {tail}
      </div>
    </>
  );
}

/** Emails, phone numbers and links read left to right, even in an Urdu or Arabic CV. */
