import { linkHref, type CV, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, ProjectLinks, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Simple — centred name, one column, a ruled heading per section. Safe for any ATS. */
export function SimpleTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  return (
    <div className="tpl tpl-simple">
      <header data-step="personal" className="s-head" data-keep>
        <Photo cv={cv} />
        <div className="s-name">{p.name || tr("Your Name")}</div>
        {p.headline && <div className="s-headline">{p.headline}</div>}
        {p.tagline && <div className="s-tagline">{p.tagline}</div>}
        {/* Two short rows (reach me / find me online) so a wrapped row never starts with a separator. */}
        {[info.filter((c) => c.kind !== "web" && c.kind !== "extra"), info.filter((c) => c.kind === "web" || c.kind === "extra")].map(
          (row, i) =>
            row.length > 0 && (
              <div key={i} className="s-contact">
                {row.map((c) => (
                  <span key={c.key}>
                    {c.kind === "phone" ? (
                      <span className="cv-ltr" dir="ltr">
                        {c.text}
                      </span>
                    ) : (
                      <ContactText c={c} />
                    )}
                  </span>
                ))}
              </div>
            ),
        )}
        <PersonalDetailsList cv={cv} tr={tr} />
      </header>

      {cv.summary.trim() && (
        <Section step="summary" title={tr("Profile")}>
          <p>{cv.summary}</p>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title={tr("Experience")}>
          {cv.experience.map((e) => (
            <div key={e.id} className="s-entry">
              <div className="s-top" data-keep-next>
                <div className="s-row">
                  <h3 className="s-title">
                    {e.role}
                    {e.company && (
                      <span className="s-org">
                        {e.role && ", "}
                        {e.company}
                      </span>
                    )}
                  </h3>
                  {e.date && <span className="s-date">{e.date}</span>}
                </div>
                {e.location && <div className="s-sub">{e.location}</div>}
              </div>
              <Bullets items={e.bullets} />
              {e.stack && <Tools label={tr("Tools:")} text={e.stack} />}
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title={tr("Projects")}>
          {cv.projects.map((pr) => (
            <div key={pr.id} className="s-entry">
              <div className="s-top" data-keep-next>
                <div className="s-row">
                  <h3 className="s-title">{pr.name}</h3>
                  {pr.date && <span className="s-date">{pr.date}</span>}
                </div>
                {pr.links.some((l) => l.trim()) && (
                  <div className="s-sub s-links">
                    <ProjectLinks links={pr.links} />
                  </div>
                )}
              </div>
              <Bullets items={pr.bullets} />
              {pr.stack && <Tools label={tr("Tools:")} text={pr.stack} />}
            </div>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title={tr("Skills")}>
          {cv.skills.map((s) => (
            <p key={s.id} className="s-skill" data-keep>
              {s.category && <b>{s.category}: </b>}
              {s.items}
            </p>
          ))}
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title={tr("Education")}>
          {cv.education.map((ed) => (
            <div key={ed.id} className="s-entry" data-keep>
              <div className="s-row">
                <h3 className="s-title">
                  {ed.degree}
                  {ed.school && (
                    <span className="s-org">
                      {ed.degree && ", "}
                      {ed.school}
                    </span>
                  )}
                </h3>
                {ed.date && <span className="s-date">{ed.date}</span>}
              </div>
              {ed.details && <div className="s-sub">{ed.details}</div>}
            </div>
          ))}
        </Section>
      )}

      {cv.certificates.length > 0 && (
        <Section step="extras" title={tr("Certificates")}>
          {cv.certificates.map((c) => (
            <p key={c.id} className="s-skill" data-keep>
              <b>{c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}</b>
              {(c.issuer || c.year) && ` — ${joinParts([c.issuer, c.year], ", ")}`}
            </p>
          ))}
        </Section>
      )}

      {cv.languages.length > 0 && (
        <Section step="extras" title={tr("Languages")}>
          <p data-keep>
            {cv.languages.map((l, i) => (
              <span key={l.id}>
                {i > 0 && " · "}
                <b>{l.name}</b>
                {l.level && ` (${l.level})`}
              </span>
            ))}
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="s-section">
      <h2 data-keep-next>{title}</h2>
      {children}
    </Block>
  );
}

function Tools({ label, text }: { label: string; text: string }) {
  return (
    <div className="s-tools">
      <span className="s-tools-label">{label}</span> {text}
    </div>
  );
}
