import { clean, linkHref, linkLabel } from "@/lib/cv";
import type { CV } from "@/lib/types";

/**
 * ATS — plain single column with standard headings, no colour blocks, icons or columns,
 * so applicant tracking systems read every line in the right order.
 */
export function AtsTemplate({ cv }: { cv: CV }) {
  const p = cv.personal;
  const contact = [p.email, p.phone, p.location, p.website, p.linkedin, p.github, p.extra].filter((v) => v.trim());

  return (
    <div className="tpl-ats">
      <header className="a-header">
        <h1 className="a-name">{p.name || "Your Name"}</h1>
        {p.headline && <div className="a-headline">{p.headline}</div>}
        {contact.length > 0 && (
          <div className="a-contact">
            {contact.map((c, i) => (
              <span key={c}>
                {i > 0 && " | "}
                {c === p.email ? <a href={`mailto:${c}`}>{c}</a> : /\.\w{2,}/.test(c) && !/\s/.test(c) ? <a href={linkHref(c)}>{linkLabel(c)}</a> : c}
              </span>
            ))}
          </div>
        )}
      </header>

      {cv.summary.trim() && (
        <section>
          <h2 className="a-title">Summary</h2>
          <p>{cv.summary}</p>
        </section>
      )}

      {cv.skills.length > 0 && (
        <section>
          <h2 className="a-title">Skills</h2>
          {cv.skills.map((s) => (
            <p key={s.id} className="a-skill">
              {s.category && <b>{s.category}: </b>}
              {s.items}
            </p>
          ))}
        </section>
      )}

      {cv.experience.length > 0 && (
        <section>
          <h2 className="a-title">Experience</h2>
          {cv.experience.map((e) => (
            <div key={e.id} className="a-entry">
              <div className="a-entry-head">
                <span className="a-entry-title">
                  {[e.role, e.company].filter(Boolean).join(", ")}
                  {e.location && <span className="a-muted">, {e.location}</span>}
                </span>
                {e.date && <span className="a-date">{e.date}</span>}
              </div>
              <Bullets items={e.bullets} />
              {e.stack && <p className="a-muted">Technologies: {e.stack}</p>}
            </div>
          ))}
        </section>
      )}

      {cv.projects.length > 0 && (
        <section>
          <h2 className="a-title">Projects</h2>
          {cv.projects.map((pr) => (
            <div key={pr.id} className="a-entry">
              <div className="a-entry-head">
                <span className="a-entry-title">{pr.name}</span>
                {pr.date && <span className="a-date">{pr.date}</span>}
              </div>
              {clean(pr.links).length > 0 && (
                <p className="a-muted">
                  {clean(pr.links).map((l, i) => (
                    <span key={l}>
                      {i > 0 && " | "}
                      <a href={linkHref(l)}>{linkLabel(l)}</a>
                    </span>
                  ))}
                </p>
              )}
              <Bullets items={pr.bullets} />
              {pr.stack && <p className="a-muted">Technologies: {pr.stack}</p>}
            </div>
          ))}
        </section>
      )}

      {cv.education.length > 0 && (
        <section>
          <h2 className="a-title">Education</h2>
          {cv.education.map((ed) => (
            <div key={ed.id} className="a-entry">
              <div className="a-entry-head">
                <span className="a-entry-title">{[ed.degree, ed.school].filter(Boolean).join(", ")}</span>
                {ed.date && <span className="a-date">{ed.date}</span>}
              </div>
              {ed.details && <p className="a-muted">{ed.details}</p>}
            </div>
          ))}
        </section>
      )}

      {cv.certificates.length > 0 && (
        <section>
          <h2 className="a-title">Certifications</h2>
          <ul>
            {cv.certificates.map((c) => (
              <li key={c.id}>
                {c.name}
                {(c.issuer || c.year) && `, ${[c.issuer, c.year].filter(Boolean).join(", ")}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {cv.languages.length > 0 && (
        <section>
          <h2 className="a-title">Languages</h2>
          <p>{cv.languages.map((l) => [l.name, l.level].filter(Boolean).join(" (") + (l.level ? ")" : "")).join(", ")}</p>
        </section>
      )}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  const list = clean(items);
  if (!list.length) return null;
  return (
    <ul>
      {list.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}
