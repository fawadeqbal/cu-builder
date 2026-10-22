import { clean, linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Bullets, ContactText, contacts, joinParts, ProjectLinks, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Elegant — all serif, centred header, letter-spaced headings between fine rules. */
export function ElegantTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  // Two short centred lines (how to reach me · where to look) instead of one that wraps mid-list.
  const contactRows = [
    info.filter((c) => c.kind === "email" || c.kind === "phone" || c.kind === "location"),
    info.filter((c) => c.kind === "web" || c.kind === "extra"),
  ].filter((row) => row.length > 0);
  return (
    <div className="tpl tpl-elegant">
      <header data-step="personal" className="el-head" data-keep>
        <Photo cv={cv} />
        <div className="el-name">{p.name || tr("Your Name")}</div>
        {p.headline && <div className="el-headline">{p.headline}</div>}
        {contactRows.map((row, i) => (
          <div key={i} className="el-contact">
            {row.map((c) => (
              <span key={c.key}>
                <ContactText c={c} />
              </span>
            ))}
          </div>
        ))}
        <PersonalDetailsList cv={cv} tr={tr} />
      </header>

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
              <div className="el-entry-head" data-keep-next>
                <div className="el-row">
                  <h3 className="el-title">
                    {e.role}
                    {e.company && (
                      <>
                        <span className="el-sep">, </span>
                        <span className="el-org">{e.company}</span>
                      </>
                    )}
                  </h3>
                  {e.date && <span className="el-date">{e.date}</span>}
                </div>
                {e.location && <div className="el-meta">{e.location}</div>}
              </div>
              <BulletsAndStack items={e.bullets} stack={e.stack} />
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title={tr("Selected Projects")}>
          {cv.projects.map((pr) => (
            <div key={pr.id} className="el-entry">
              <div className="el-entry-head" data-keep-next>
                <div className="el-row">
                  <h3 className="el-title">{pr.name}</h3>
                  {pr.date && <span className="el-date">{pr.date}</span>}
                </div>
                {pr.links.some((l) => l.trim()) && (
                  <div className="el-meta el-links">
                    <ProjectLinks links={pr.links} />
                  </div>
                )}
              </div>
              <Bullets items={pr.bullets} />
            </div>
          ))}
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title={tr("Education")}>
          {cv.education.map((ed) => (
            <div key={ed.id} className="el-entry" data-keep>
              <div className="el-row">
                <h3 className="el-title">
                  {ed.degree}
                  {ed.school && (
                    <>
                      <span className="el-sep">, </span>
                      <span className="el-org">{ed.school}</span>
                    </>
                  )}
                </h3>
                {ed.date && <span className="el-date">{ed.date}</span>}
              </div>
              {ed.details && <div className="el-meta">{ed.details}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title={tr("Expertise")}>
          <div className="el-defs">
            {cv.skills.map((s) => (
              <div key={s.id} className="el-def" data-keep>
                <div className="el-def-label">{s.category}</div>
                <div>{s.items}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.certificates.length + cv.languages.length > 0 && (
        <Section step="extras" title={tr("Additional")}>
          <div className="el-defs">
            {cv.certificates.length > 0 && (
              <div className="el-def" data-keep>
                <div className="el-def-label">{tr("Certifications")}</div>
                <div>
                  {cv.certificates.map((c) => (
                    <div key={c.id}>
                      {c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
                      {(c.issuer || c.year) && <span className="el-muted"> · {joinParts([c.issuer, c.year], ", ")}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {cv.languages.length > 0 && (
              <div className="el-def" data-keep>
                <div className="el-def-label">{tr("Languages")}</div>
                <div>
                  {cv.languages.map((l, i) => (
                    <span key={l.id}>
                      {i > 0 && <span className="el-muted"> · </span>}
                      {l.name}
                      {l.level && <span className="el-muted"> ({l.level})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <section className="el-section" data-step={step}>
      <h2 data-keep-next>
        <span>{title}</span>
      </h2>
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
  const tail = stack?.trim() ? <div className="el-stack">{stack}</div> : null;
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
      <div className={list.length > 1 ? "el-tail" : undefined} data-keep>
        <ul>
          <li>{list.at(-1)}</li>
        </ul>
        {tail}
      </div>
    </>
  );
}

/** Emails, phone numbers and links read left to right, even in an Urdu or Arabic CV. */
