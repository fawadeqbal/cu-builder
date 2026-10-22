"use client";

import type { PortfolioContentDto } from "@cvb/contracts";
import { clean, linkHref, linkLabel, type CV } from "@cvb/domain";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

export type PortfolioTheme = "minimal" | "bold" | "split";

export type PortfolioViewProps = {
  cv: CV;
  ownerName: string;
  theme: PortfolioTheme;
  accent: string;
  content: PortfolioContentDto;
  showContactForm: boolean;
  /** Sends the contact form; absent in the editor preview. */
  onContact?: (form: { name: string; email: string; message: string; website: string }) => Promise<void>;
  /** The "Download CV" action, when available. */
  download?: { busy: boolean; onClick: () => void };
  hideCredit?: boolean;
  /** Where "Made with CV Builder" links (the app's own address). */
  appUrl?: string;
};

const photoOf = (cv: CV) => {
  const p = (cv.personal as { photo?: unknown }).photo;
  return typeof p === "string" && /^(https:|data:image\/)/.test(p) ? p : "";
};

/**
 * A personal website rendered from a CV. Uses container queries, so it lays out the same in the
 * editor's preview pane as in a full browser window.
 */
export function PortfolioView({ cv, ownerName, theme, accent, content, showContactForm, onContact, download, hideCredit, appUrl }: PortfolioViewProps) {
  const name = cv.personal.name || ownerName;
  const about = content.about.trim() || cv.summary.trim();
  const photo = photoOf(cv);
  const links = [
    cv.personal.email && { label: cv.personal.email, href: `mailto:${cv.personal.email}` },
    cv.personal.website && { label: linkLabel(cv.personal.website), href: linkHref(cv.personal.website) },
    cv.personal.linkedin && { label: "LinkedIn", href: linkHref(cv.personal.linkedin) },
    cv.personal.github && { label: "GitHub", href: linkHref(cv.personal.github) },
  ].filter((l): l is { label: string; href: string } => Boolean(l));
  const projects = [
    ...content.projects.map((p) => ({ key: `x-${p.title}`, title: p.title, description: p.description, url: p.url, imageUrl: p.imageUrl, stack: "" })),
    ...cv.projects.map((p) => ({ key: p.id, title: p.name, description: clean(p.bullets).join(" "), url: p.links[0] ? linkHref(p.links[0]) : "", imageUrl: "", stack: p.stack })),
  ].filter((p) => p.title);
  const style = { "--site-accent": accent } as CSSProperties;
  const dark = theme === "bold";

  const hero = (
    <header className={theme === "split" ? "flex flex-col gap-4" : `flex flex-col items-start gap-5 @2xl:flex-row @2xl:items-center ${theme === "minimal" ? "border-b border-stone-200 pb-10" : ""}`}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- user content from the CV
        <img src={photo} alt="" className={`size-24 shrink-0 rounded-full object-cover ring-4 ${dark ? "ring-white/20" : "ring-stone-100"}`} />
      )}
      <div className="min-w-0">
        <h1 className={`text-3xl font-bold tracking-tight @2xl:text-5xl ${dark ? "text-white" : "text-stone-900"}`}>{name}</h1>
        {cv.personal.headline && (
          <p className="mt-2 text-lg font-medium @2xl:text-xl" style={{ color: dark ? "rgba(255,255,255,.85)" : "var(--site-accent)" }}>
            {cv.personal.headline}
          </p>
        )}
        {cv.personal.location && <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-stone-500"}`}>{cv.personal.location}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target={l.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noreferrer noopener"
              className={`rounded-full px-3 py-1 text-sm font-medium ring-1 transition ${dark ? "text-white ring-white/30 hover:bg-white/10" : "text-stone-700 ring-stone-200 hover:bg-stone-50"}`}
            >
              {l.label}
            </a>
          ))}
          {download && (
            <button
              type="button"
              onClick={download.onClick}
              disabled={download.busy}
              className="rounded-full px-3 py-1 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              style={{ background: dark ? "rgba(255,255,255,.15)" : "var(--site-accent)" }}
            >
              {download.busy ? "Preparing…" : "Download CV"}
            </button>
          )}
        </div>
      </div>
    </header>
  );

  const body = (
    <div className="flex flex-col gap-12">
      {about && (
        <Section title="About">
          <p className="whitespace-pre-line text-base leading-relaxed text-stone-700">{about}</p>
        </Section>
      )}
      {cv.experience.length > 0 && (
        <Section title="Experience">
          <ol className="flex flex-col gap-6">
            {cv.experience.map((e) => (
              <li key={e.id} className="grid gap-1 @2xl:grid-cols-[10rem_1fr] @2xl:gap-6">
                <div className="text-sm text-stone-500">{e.date}</div>
                <div>
                  <h3 className="font-semibold text-stone-900">
                    {e.role}
                    {e.company && <span className="font-normal text-stone-600"> · {e.company}</span>}
                  </h3>
                  {clean(e.bullets).length > 0 && (
                    <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-sm leading-relaxed text-stone-700 marker:text-stone-300">
                      {clean(e.bullets).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {e.stack && <p className="mt-2 text-xs text-stone-500">{e.stack}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}
      {projects.length > 0 && (
        <Section title="Projects">
          <ul className="grid gap-4 @2xl:grid-cols-2">
            {projects.map((p) => (
              <li key={p.key} className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- user content
                  <img src={p.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="font-semibold text-stone-900">{p.title}</h3>
                  {p.description && <p className="text-sm leading-relaxed text-stone-600">{p.description}</p>}
                  {p.stack && <p className="text-xs text-stone-500">{p.stack}</p>}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer noopener" className="mt-auto text-sm font-semibold hover:underline" style={{ color: "var(--site-accent)" }}>
                      Visit ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {cv.skills.length > 0 && (
        <Section title="Skills">
          <dl className="flex flex-col gap-3">
            {cv.skills.map((s) => (
              <div key={s.id} className="grid gap-1 @2xl:grid-cols-[10rem_1fr] @2xl:gap-6">
                <dt className="text-sm font-medium text-stone-500">{s.category}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {s.items
                    .split(/\s*,\s*/)
                    .filter(Boolean)
                    .map((item) => (
                      <span key={item} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-sm text-stone-700">
                        {item}
                      </span>
                    ))}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      {(cv.education.length > 0 || cv.certificates.length > 0) && (
        <Section title="Education">
          <ul className="flex flex-col gap-3">
            {cv.education.map((e) => (
              <li key={e.id}>
                <div className="font-semibold text-stone-900">{e.degree}</div>
                <div className="text-sm text-stone-600">{[e.school, e.date].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
            {cv.certificates.map((c) => (
              <li key={c.id}>
                <div className="font-semibold text-stone-900">{c.name}</div>
                <div className="text-sm text-stone-600">{[c.issuer, c.year].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {showContactForm && (
        <Section title="Get in touch">
          <ContactForm onSend={onContact} />
        </Section>
      )}
      {!hideCredit && (
        <p className="text-center text-xs text-stone-400">
          Made with{" "}
          <a href={appUrl ?? "https://cvbuilder.app"} className="font-semibold hover:underline">
            CV Builder
          </a>
        </p>
      )}
    </div>
  );

  return (
    <div dir="auto" className="@container min-h-full bg-stone-50 text-stone-900" style={style}>
      {theme === "split" ? (
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 @4xl:grid-cols-[20rem_1fr] @4xl:py-16">
          <aside className="@4xl:sticky @4xl:top-10 @4xl:self-start">
            <div className="h-1.5 w-16 rounded-full" style={{ background: "var(--site-accent)" }} />
            <div className="mt-6">{hero}</div>
          </aside>
          <main>{body}</main>
        </div>
      ) : theme === "bold" ? (
        <>
          <div className="px-5 py-14 @2xl:py-20" style={{ background: "var(--site-accent)" }}>
            <div className="mx-auto max-w-4xl">{hero}</div>
          </div>
          <main className="mx-auto max-w-4xl px-5 py-12">{body}</main>
        </>
      ) : (
        <main className="mx-auto max-w-3xl px-5 py-12 @2xl:py-20">
          {hero}
          <div className="mt-12">{body}</div>
        </main>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
        <span className="h-px w-6" style={{ background: "var(--site-accent)" }} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ContactForm({ onSend }: { onSend?: PortfolioViewProps["onContact"] }) {
  const [form, setForm] = useState({ name: "", email: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!onSend) return;
    setState("sending");
    setError("");
    try {
      await onSend(form);
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your message");
      setState("error");
    }
  }

  if (state === "sent") return <p className="rounded-2xl bg-white p-5 text-sm text-stone-700 ring-1 ring-stone-200">Thanks! Your message was sent.</p>;
  const input = "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-inset ring-stone-200 focus:outline-none focus:ring-2 focus:ring-[var(--site-accent)]";
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-stone-200 @2xl:grid-cols-2" aria-label="Contact form">
      <label className="text-sm font-medium text-stone-700">
        Name
        <input required maxLength={120} className={`${input} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="text-sm font-medium text-stone-700">
        Email
        <input required type="email" maxLength={200} className={`${input} mt-1`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      {/* Honeypot: people never see it; bots fill it in. */}
      <label className="absolute -start-[9999px] size-px overflow-hidden" aria-hidden>
        Website
        <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
      </label>
      <label className="text-sm font-medium text-stone-700 @2xl:col-span-2">
        Message
        <textarea required minLength={5} maxLength={4000} rows={5} className={`${input} mt-1`} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </label>
      {state === "error" && <p className="text-sm text-red-600 @2xl:col-span-2">{error}</p>}
      <div className="@2xl:col-span-2">
        <button
          type="submit"
          disabled={!onSend || state === "sending"}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          style={{ background: "var(--site-accent)" }}
        >
          {state === "sending" ? "Sending…" : "Send message"}
        </button>
        {!onSend && <span className="ms-3 text-xs text-stone-500">The form works on your published site.</span>}
      </div>
    </form>
  );
}
