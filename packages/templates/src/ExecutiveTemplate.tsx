import { clean, linkHref, visibleDetails, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Bullets, ContactText, contacts, ProjectLinks, splitItems, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Executive — a dark header band, core competencies grouped by area and a strong career history. */
export function ExecutiveTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  const contactRows = [
    info.filter((c) => c.kind === "email" || c.kind === "phone" || c.kind === "location"),
    info.filter((c) => c.kind === "web" || c.kind === "extra"),
  ].filter((row) => row.length > 0);
  // One row per skill category ("Cloud — AWS, Docker, Terraform"), not one bullet per skill.
  const competencies = cv.skills
    .map((s) => ({ id: s.id, area: s.category.trim(), items: splitItems(s.items).join(", ") }))
    .filter((s) => s.items);
  const education = cv.education.length > 0 && (
    <Section step="education" title={tr("Education")}>
      {cv.education.map((ed) => (
        <div key={ed.id} className="ex-small-entry" data-keep>
          <div className="ex-row">
            <h3 className="ex-small-title">{ed.degree}</h3>
            {ed.date && <span className="ex-date">{ed.date}</span>}
          </div>
          {ed.school && <div className="ex-company">{ed.school}</div>}
          {ed.details && <div className="ex-muted">{ed.details}</div>}
        </div>
      ))}
    </Section>
  );
  const credentials = cv.certificates.length > 0 && (
    <Section step="extras" title={tr("Credentials")}>
      {cv.certificates.map((c) => (
        <div key={c.id} className="ex-small-entry" data-keep>
          <div className="ex-row">
            <h3 className="ex-small-title">
              {c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
              {c.issuer && <span className="ex-issuer"> · {c.issuer}</span>}
            </h3>
            {c.year && <span className="ex-date">{c.year}</span>}
          </div>
        </div>
      ))}
    </Section>
  );
  const languageList = cv.languages.map((l, i) => (
    <span key={l.id}>
      {i > 0 && ", "}
      {l.name}
      {l.level && <span className="ex-muted"> ({l.level})</span>}
    </span>
  ));
  // With a competencies table, languages are its last row; otherwise they sit under the shorter column.
  const languagesInTable =
    competencies.length > 0 &&
    cv.languages.length > 0 &&
    // "Languages: JavaScript, Python" is a skill row already; don't add a second "Languages" row.
    !competencies.some((c) => c.area.toLowerCase() === tr("Languages").toLowerCase() || /^languages?$/i.test(c.area));
  const languages = !languagesInTable && cv.languages.length > 0 && (
    <Section step="extras" title={tr("Languages")}>
      <div className="ex-small-entry" data-keep>
        {languageList}
      </div>
    </Section>
  );
  // An education entry is ~3 lines, a credential ~1.
  const languagesLeft = cv.education.length * 3 <= cv.certificates.length * 1.3;
  return (
    <div className="tpl tpl-executive">
      <header data-step="personal" className="ex-head" data-keep>
        <Photo cv={cv} />
        <div className="ex-band">
          <div className="ex-name">{p.name || tr("Your Name")}</div>
          {p.headline && <div className="ex-headline">{p.headline}</div>}
        </div>
        {(contactRows.length > 0 || visibleDetails(cv).length > 0) && (
          <div className="ex-strip">
            {contactRows.map((row, i) => (
              <div key={i} className="ex-contact">
                {row.map((c) => (
                  <span key={c.key}>
                    <ContactText c={c} />
                  </span>
                ))}
              </div>
            ))}
            <PersonalDetailsList cv={cv} tr={tr} />
          </div>
        )}
      </header>

      {(cv.summary.trim() || p.tagline) && (
        <Section step="summary" title={tr("Executive Summary")}>
          {cv.summary.trim() && <p className="ex-lead">{cv.summary}</p>}
          {p.tagline && <p className="ex-tagline">{p.tagline}</p>}
        </Section>
      )}

      {competencies.length > 0 && (
        <Section step="skills" title={tr("Core Competencies")}>
          <div className="ex-comp">
            {competencies.map((c) => (
              <div key={c.id} className={c.area ? "ex-comp-row" : "ex-comp-row ex-comp-row--plain"} data-keep>
                {c.area && <div className="ex-comp-area">{c.area}</div>}
                <div>{c.items}</div>
              </div>
            ))}
            {languagesInTable && (
              <div className="ex-comp-row" data-step="extras" data-keep>
                <div className="ex-comp-area">{tr("Languages")}</div>
                <div>{languageList}</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title={tr("Career History")}>
          {cv.experience.map((e) => (
            <div key={e.id} className="ex-entry">
              <div className="ex-entry-head" data-keep-next>
                <div className="ex-row">
                  <h3 className="ex-role">{e.role}</h3>
                  {e.date && <span className="ex-date">{e.date}</span>}
                </div>
                {(e.company || e.location) && (
                  <div className="ex-org">
                    {e.company && <span className="ex-company">{e.company}</span>}
                    {e.company && e.location && <span className="ex-dot"> · </span>}
                    {e.location && <span className="ex-muted">{e.location}</span>}
                  </div>
                )}
              </div>
              <BulletsAndStack items={e.bullets} stack={e.stack} />
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title={tr("Key Initiatives")}>
          {cv.projects.map((pr) => (
            <div key={pr.id} className="ex-entry">
              <div className="ex-entry-head" data-keep-next>
                <div className="ex-row">
                  <h3 className="ex-role">{pr.name}</h3>
                  {pr.date && <span className="ex-date">{pr.date}</span>}
                </div>
                {pr.links.some((l) => l.trim()) && (
                  <div className="ex-org ex-links">
                    <ProjectLinks links={pr.links} />
                  </div>
                )}
              </div>
              <Bullets items={pr.bullets} />
            </div>
          ))}
        </Section>
      )}

      {(education || credentials || languages) && (
        <div className="ex-split">
          {(education || (languages && languagesLeft)) && (
            <div className="ex-col">
              {education}
              {languagesLeft && languages}
            </div>
          )}
          {(credentials || (languages && !languagesLeft)) && (
            <div className="ex-col">
              {credentials}
              {!languagesLeft && languages}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <section className="ex-section" data-step={step}>
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
  const tail = stack?.trim() ? <div className="ex-stack">{stack}</div> : null;
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
      <div className={list.length > 1 ? "ex-tail" : undefined} data-keep>
        <ul>
          <li>{list.at(-1)}</li>
        </ul>
        {tail}
      </div>
    </>
  );
}

/** Emails, phone numbers and links read left to right, even in an Urdu or Arabic CV. */
