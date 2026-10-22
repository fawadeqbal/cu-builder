"use client";

import type { PortfolioContentDto } from "@cvb/contracts";
import { brandCssVariables, clean, isHexColor, linkHref, linkLabel, type CV } from "@cvb/domain";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Alert, Badge, Button, TextArea, TextField } from "@cvb/ui";

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
export function PortfolioView({
  cv,
  ownerName,
  theme,
  accent,
  content,
  showContactForm,
  onContact,
  download,
  hideCredit,
  appUrl,
}: PortfolioViewProps) {
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
    ...content.projects.map((p) => ({
      key: `x-${p.title}`,
      title: p.title,
      description: p.description,
      url: p.url,
      imageUrl: p.imageUrl,
      stack: "",
    })),
    ...cv.projects.map((p) => ({
      key: p.id,
      title: p.name,
      description: clean(p.bullets).join(" "),
      url: p.links[0] ? linkHref(p.links[0]) : "",
      imageUrl: "",
      stack: p.stack,
    })),
  ].filter((p) => p.title);
  // The site's colour is the person's choice (data). It also drives the brand tokens inside the
  // site, so its buttons, links and focus rings use it.
  const style = {
    ...(isHexColor(accent) ? brandCssVariables({ primaryColor: accent, accentColor: "" }) : {}),
    "--site-accent": accent,
  } as CSSProperties;
  const dark = theme === "bold";

  const hero = (
    <header
      className={
        theme === "split"
          ? "flex flex-col gap-4"
          : `flex flex-col items-start gap-5 @2xl:flex-row @2xl:items-center ${theme === "minimal" ? "border-b border-line pb-10" : ""}`
      }
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- user content from the CV
        <img
          src={photo}
          alt=""
          className={`size-24 shrink-0 rounded-full object-cover ring-4 ${dark ? "ring-on-brand/20" : "ring-line"}`}
        />
      )}
      <div className="min-w-0">
        <h1
          className={`font-display text-3xl font-bold tracking-tight text-balance @2xl:text-5xl ${dark ? "text-on-brand" : "text-ink"}`}
        >
          {name}
        </h1>
        {cv.personal.headline && (
          <p
            className={`mt-2 text-lg font-medium @2xl:text-xl ${dark ? "text-on-brand/85" : ""}`}
            style={dark ? undefined : { color: "var(--site-accent)" }}
          >
            {cv.personal.headline}
          </p>
        )}
        {cv.personal.location && (
          <p className={`mt-1 text-sm ${dark ? "text-on-brand/70" : "text-ink-3"}`}>{cv.personal.location}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target={l.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noreferrer noopener"
              className={`rounded-full px-3 py-1 text-sm font-medium ring-1 transition ${dark ? "text-on-brand ring-on-brand/30 hover:bg-on-brand/10" : "text-ink-2 ring-line hover:bg-surface"}`}
            >
              {l.label}
            </a>
          ))}
          {download && (
            <button
              type="button"
              onClick={download.onClick}
              disabled={download.busy}
              className={`rounded-full px-3 py-1 text-sm font-semibold text-on-brand shadow-sm disabled:opacity-60 ${dark ? "bg-on-brand/15" : "bg-brand hover:bg-brand-hover"}`}
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
          <p className="whitespace-pre-line text-base leading-relaxed text-ink-2">{about}</p>
        </Section>
      )}
      {cv.experience.length > 0 && (
        <Section title="Experience">
          <ol className="flex flex-col gap-6">
            {cv.experience.map((e) => (
              <li key={e.id} className="grid gap-1 @2xl:grid-cols-[10rem_1fr] @2xl:gap-6">
                <div className="text-sm text-ink-3">{e.date}</div>
                <div>
                  <h3 className="font-semibold text-ink">
                    {e.role}
                    {e.company && <span className="font-normal text-ink-2"> · {e.company}</span>}
                  </h3>
                  {clean(e.bullets).length > 0 && (
                    <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-sm leading-relaxed text-ink-2 marker:text-ink-disabled">
                      {clean(e.bullets).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {e.stack && <p className="mt-2 text-xs text-ink-3">{e.stack}</p>}
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
              <li key={p.key} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- user content
                  <img src={p.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="font-display font-semibold text-ink">{p.title}</h3>
                  {p.description && <p className="text-sm leading-relaxed text-ink-2">{p.description}</p>}
                  {p.stack && <p className="text-xs text-ink-3">{p.stack}</p>}
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-auto text-sm font-semibold hover:underline"
                      style={{ color: "var(--site-accent)" }}
                    >
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
                <dt className="text-sm font-medium text-ink-3">{s.category}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {s.items
                    .split(/\s*,\s*/)
                    .filter(Boolean)
                    .map((item) => (
                      <Badge key={item} pill>
                        {item}
                      </Badge>
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
                <div className="font-semibold text-ink">{e.degree}</div>
                <div className="text-sm text-ink-2">{[e.school, e.date].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
            {cv.certificates.map((c) => (
              <li key={c.id}>
                <div className="font-semibold text-ink">{c.name}</div>
                <div className="text-sm text-ink-2">{[c.issuer, c.year].filter(Boolean).join(" · ")}</div>
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
        <p className="text-center text-xs text-ink-3">
          Made with{" "}
          <a href={appUrl ?? "https://cvbuilder.app"} className="font-semibold hover:underline">
            CV Builder
          </a>
        </p>
      )}
    </div>
  );

  return (
    // The site is the person's own page with its own look: it stays light (like the CV paper) so
    // their chosen colour reads the same for every visitor.
    <div dir="auto" data-theme="light" className="@container min-h-full bg-surface-2 text-ink" style={style}>
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
      <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-ink-3">
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

  if (state === "sent") return <Alert tone="success">Thanks. Your message was sent.</Alert>;
  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-lg border border-line bg-surface p-5 @2xl:grid-cols-2"
      aria-label="Contact form"
    >
      <TextField
        label="Name"
        required
        maxLength={120}
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <TextField
        label="Email"
        required
        type="email"
        maxLength={200}
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      {/* Honeypot: people never see it; bots fill it in. */}
      <label className="sr-only" aria-hidden>
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
      </label>
      <TextArea
        label="Message"
        className="@2xl:col-span-2"
        required
        minLength={5}
        maxLength={4000}
        rows={5}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
      />
      {state === "error" && (
        <Alert tone="danger" className="@2xl:col-span-2">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3 @2xl:col-span-2">
        <Button type="submit" variant="primary" loading={state === "sending"} disabled={!onSend}>
          {state === "sending" ? "Sending…" : "Send message"}
        </Button>
        {!onSend && <span className="cvb-caption">The form works on your published site.</span>}
      </div>
    </form>
  );
}
