import { clean, linkHref, linkLabel, type CV, type StepId } from "@cvb/domain";
import { Fragment, type ReactNode } from "react";
import { Block, Bullets, ContactText, contacts, joinParts, cvLabels, Photo, PersonalDetailsList } from "./shared";

/** Compact — the densest template: small type, name left and contact right, labels in a narrow column. */
export function CompactTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const tr = cvLabels(cv);
  const info = contacts(p);
  return (
    <div className="tpl tpl-compact">
      <header data-step="personal" className="cp-head" data-keep>
        <Photo cv={cv} />
        <div>
          <div className="cp-name">{p.name || tr("Your Name")}</div>
          {p.headline && <div className="cp-headline">{p.headline}</div>}
          {p.tagline && <div className="cp-tagline">{p.tagline}</div>}
        </div>
        {info.length > 0 && (
          <div className="cp-contact">
            {info.map((c) => (
              <div key={c.key}>
                {c.kind === "phone" ? (
                  <span className="cv-ltr" dir="ltr">
                    {c.text}
                  </span>
                ) : (
                  <ContactText c={c} />
                )}
              </div>
            ))}
          </div>
        )}
        <PersonalDetailsList cv={cv} tr={tr} />
      </header>

      {cv.summary.trim() && (
        <Section step="summary" title={tr("Summary")}>
          <p>{cv.summary}</p>
        </Section>
      )}

      {cv.experience.length > 0 && (
        <Section step="experience" title={tr("Experience")}>
          {cv.experience.map((e) => (
            <div key={e.id} className="cp-entry">
              <div className="cp-row" data-keep-next>
                <h3 className="cp-title">
                  <b>{e.role}</b>
                  {e.company && (
                    <span className="cp-org">
                      {e.role ? ", " : ""}
                      {e.company}
                    </span>
                  )}
                  {e.location && <span className="cp-muted"> · {e.location}</span>}
                </h3>
                {e.date && <span className="cp-date">{e.date}</span>}
              </div>
              <Bullets items={e.bullets} />
              {e.stack && <Stack label={tr("Stack:")} text={e.stack} />}
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section step="projects" title={tr("Projects")}>
          {cv.projects.map((pr) => (
            <div key={pr.id} className="cp-entry">
              <div className="cp-row" data-keep-next>
                <h3 className="cp-title">
                  <b>{pr.name}</b>
                  {/* An en space (not a "·") before the links, so a wrapped line never starts or ends on a separator;
                      each link stays whole. */}
                  {clean(pr.links).map((l, i) => (
                    <Fragment key={l}>
                      {i === 0 ? (pr.name ? "\u2002" : "") : " "}
                      <span className="cp-link">
                        {i > 0 && <span className="cp-muted">· </span>}
                        <a href={linkHref(l)}>{linkLabel(l)}</a>
                      </span>
                    </Fragment>
                  ))}
                </h3>
                {pr.date && <span className="cp-date">{pr.date}</span>}
              </div>
              <Bullets items={pr.bullets} />
              {pr.stack && <Stack label={tr("Stack:")} text={pr.stack} />}
            </div>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section step="skills" title={tr("Skills")}>
          <div className="cp-skills">
            {cv.skills.map((s) => (
              <div key={s.id} className="cp-skill" data-keep>
                {s.category && <b>{s.category}</b>}
                <span>{s.items}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section step="education" title={tr("Education")}>
          {cv.education.map((ed) => (
            <div key={ed.id} className="cp-row cp-entry" data-keep>
              <h3 className="cp-title">
                <b>{ed.degree}</b>
                {ed.school && (
                  <span className="cp-org">
                    {ed.degree ? ", " : ""}
                    {ed.school}
                  </span>
                )}
                {ed.details && <span className="cp-muted"> · {ed.details}</span>}
              </h3>
              {ed.date && <span className="cp-date">{ed.date}</span>}
            </div>
          ))}
        </Section>
      )}

      {cv.certificates.length + cv.languages.length > 0 && (
        <Section step="extras" title={tr("Extras")}>
          {cv.certificates.length > 0 && (
            <p data-keep>
              <b>{tr("Certificates")}: </b>
              {cv.certificates.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && "; "}
                  {c.url ? <a href={linkHref(c.url)}>{c.name}</a> : c.name}
                  {(c.issuer || c.year) && ` (${joinParts([c.issuer, c.year], ", ")})`}
                </span>
              ))}
            </p>
          )}
          {cv.languages.length > 0 && (
            <p data-keep>
              <b>{tr("Languages")}: </b>
              {cv.languages.map((l) => joinParts([l.name, l.level && `(${l.level})`], " ")).join(", ")}
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: StepId; title: string; children: ReactNode }) {
  return (
    <Block step={step} className="cp-section">
      <h2 data-keep-next>{title}</h2>
      <div className="cp-body">{children}</div>
    </Block>
  );
}

function Stack({ label, text }: { label: string; text: string }) {
  return (
    <div className="cp-stack">
      <span className="cp-stack-label">{label}</span> {text}
    </div>
  );
}
