"use client";

import type { ApplicationDto, BoardDto, OfferDetailsDto, ReminderDto, UpdateApplicationDto } from "@cvb/contracts";
import { EMPTY_OFFER } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { CloseIcon, CopyIcon, TrashIcon } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { keys, useLetters, useResumes, useShareLinks } from "@/lib/queries";
import { fromLocalInput, toLocalInput, trackerKeys, useReminders, useUpdateApplication } from "@/lib/tracker";
import { btn, field, label } from "../ui/styles";

const TABS = ["Details", "Contacts", "Research", "Offer", "Share"] as const;
type Tab = (typeof TABS)[number];

type Props = { app: ApplicationDto; columns: BoardDto["columns"]; onClose: () => void; onGate: (g: Gate) => void };

/** Everything about one application, in a side panel. Fields save when you leave them. */
export function ApplicationDrawer({ app, columns, onClose, onGate }: Props) {
  const [tab, setTab] = useState<Tab>("Details");
  const update = useUpdateApplication();
  const qc = useQueryClient();
  const save = (patch: UpdateApplicationDto) => update.mutate({ id: app.id, patch });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const remove = useMutation({
    mutationFn: () => api.delete(`/applications/${app.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: trackerKeys.all });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={`${app.job.title} application`} className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-stone-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-stone-900">{app.job.title}</h2>
            <p className="truncate text-sm text-stone-500">{[app.job.company, app.job.location, app.job.salary].filter(Boolean).join(" · ")}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm font-medium">
              {app.job.url && (
                <a href={app.job.url} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
                  Posting ↗
                </a>
              )}
              <Link href={`/interview?role=${encodeURIComponent(app.job.title)}&jobId=${app.job.id}`} className="text-brand hover:underline">
                Practise the interview
              </Link>
            </div>
          </div>
          <button type="button" className={btn.ghost} aria-label="Close" onClick={onClose}>
            <CloseIcon className="size-4" />
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-stone-100 px-4 text-sm font-medium">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px whitespace-nowrap border-b-2 px-2.5 py-2 ${t === tab ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === "Details" && <Details app={app} columns={columns} save={save} />}
          {tab === "Contacts" && <Contacts app={app} save={save} />}
          {tab === "Research" && <Research app={app} save={save} onGate={onGate} />}
          {tab === "Offer" && <Offer app={app} save={save} />}
          {tab === "Share" && <Share app={app} onGate={onGate} />}
        </div>
        <footer className="flex items-center justify-between border-t border-stone-100 px-5 py-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
            onClick={() => window.confirm("Delete this application? The saved job stays in Jobs.") && remove.mutate()}
          >
            <TrashIcon className="size-4" /> Delete
          </button>
          <div className="flex items-center gap-3">
            {update.isPending ? <span className="text-xs text-stone-400">Saving…</span> : update.isError ? <span className="text-xs text-red-600">{update.error.message}</span> : null}
            <button type="button" className={btn.secondary} onClick={() => (save({ archived: !app.archived }), onClose())}>
              {app.archived ? "Restore" : "Archive"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

type Save = (patch: UpdateApplicationDto) => void;

function Field({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div>
      <label className={label} htmlFor={id}>
        {title}
      </label>
      {children}
    </div>
  );
}

/** A text input that saves on blur, only when the value changed. */
function TextField({ id, title, value, onSave, ...rest }: { id: string; title: string; value: string; onSave: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "id" | "title">) {
  const [v, setV] = useState(value);
  return (
    <Field id={id} title={title}>
      <input id={id} className={field} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} {...rest} />
    </Field>
  );
}

function Details({ app, columns, save }: { app: ApplicationDto; columns: BoardDto["columns"]; save: Save }) {
  const resumes = useResumes();
  const letters = useLetters();
  const [notes, setNotes] = useState(app.notes);
  const num = (v: string) => (v.trim() ? Math.max(0, Math.round(Number(v))) || null : null);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="d-stage" title="Stage">
          <select id="d-stage" className={field} value={app.status} onChange={(e) => save({ status: e.target.value })}>
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="d-cv" title="CV sent">
          <select id="d-cv" className={field} value={app.resumeId ?? ""} onChange={(e) => save({ resumeId: e.target.value || null })}>
            <option value="">Not chosen</option>
            {resumes.data?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <Field id="d-letter" title="Cover letter">
          <select id="d-letter" className={field} value={app.coverLetterId ?? ""} onChange={(e) => save({ coverLetterId: e.target.value || null })}>
            <option value="">None</option>
            {letters.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </Field>
        <Field id="d-applied" title="Applied on">
          <input
            id="d-applied"
            type="date"
            className={field}
            defaultValue={app.appliedAt?.slice(0, 10) ?? ""}
            onBlur={(e) => save({ appliedAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
          />
        </Field>
        <Field id="d-interview" title="Interview">
          <input id="d-interview" type="datetime-local" className={field} defaultValue={toLocalInput(app.interviewAt)} onBlur={(e) => save({ interviewAt: fromLocalInput(e.target.value) })} />
        </Field>
        <Field id="d-deadline" title="Application deadline">
          <input
            id="d-deadline"
            type="date"
            className={field}
            defaultValue={app.deadlineAt?.slice(0, 10) ?? ""}
            onBlur={(e) => save({ deadlineAt: e.target.value ? new Date(`${e.target.value}T17:00:00`).toISOString() : null })}
          />
        </Field>
        <Field id="d-follow" title="Follow up after (days)">
          <input
            id="d-follow"
            type="number"
            min={1}
            max={60}
            className={field}
            defaultValue={app.followUpDays ?? ""}
            placeholder="7"
            onBlur={(e) => save({ followUpDays: e.target.value ? Math.min(60, Math.max(1, Number(e.target.value))) : null })}
          />
        </Field>
        <div className="grid grid-cols-[1fr_1fr_5rem] gap-2 sm:col-span-2">
          <TextField id="d-smin" title="Salary from" inputMode="numeric" value={app.salaryMin?.toString() ?? ""} onSave={(v) => save({ salaryMin: num(v) })} />
          <TextField id="d-smax" title="to" inputMode="numeric" value={app.salaryMax?.toString() ?? ""} onSave={(v) => save({ salaryMax: num(v) })} />
          <TextField id="d-cur" title="Currency" maxLength={10} value={app.currency ?? ""} onSave={(v) => save({ currency: v.trim() || null })} />
        </div>
      </div>
      <Field id="d-notes" title="Notes">
        <textarea id="d-notes" rows={5} className={field} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== app.notes && save({ notes })} />
      </Field>
      <Reminders app={app} />
    </div>
  );
}

function Reminders({ app }: { app: ApplicationDto }) {
  const qc = useQueryClient();
  const [range] = useState(() => ({ from: new Date(Date.now() - 90 * 86_400_000), to: new Date(Date.now() + 365 * 86_400_000) }));
  const all = useReminders(range.from, range.to);
  const mine = (all.data ?? []).filter((r) => r.applicationId === app.id);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["tracker", "reminders"] });
  const toggle = useMutation({ mutationFn: (r: ReminderDto) => api.patch(`/reminders/${r.id}`, { done: !r.doneAt }), onSuccess: refresh });
  const add = useMutation({
    mutationFn: () => api.post("/reminders", { title: title.trim(), dueAt: new Date(due).toISOString(), applicationId: app.id }),
    onSuccess: () => (setTitle(""), setDue(""), refresh()),
  });
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Reminders</h3>
      <ul className="flex flex-col gap-1">
        {mine.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand" checked={Boolean(r.doneAt)} onChange={() => toggle.mutate(r)} aria-label={`Done: ${r.title}`} />
            <span className={`flex-1 ${r.doneAt ? "text-stone-400 line-through" : "text-stone-800"}`}>{r.title}</span>
            <span className="text-xs text-stone-500">{new Date(r.dueAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </li>
        ))}
        {mine.length === 0 && <li className="text-sm text-stone-500">Follow-up, interview and deadline reminders appear here from the dates above.</li>}
      </ul>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && due) add.mutate();
        }}
      >
        <input aria-label="Reminder" className={`${field} min-w-40 flex-1`} placeholder="Add a reminder" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        <input aria-label="When" type="datetime-local" className={`${field} w-auto`} value={due} onChange={(e) => setDue(e.target.value)} />
        <button type="submit" className={btn.secondary} disabled={add.isPending}>
          Add
        </button>
      </form>
    </section>
  );
}

function Contacts({ app, save }: { app: ApplicationDto; save: Save }) {
  const [list, setList] = useState(app.contacts);
  const commit = (next = list) => save({ contacts: next.filter((c) => c.name || c.email || c.phone) });
  const set = (i: number, key: keyof (typeof list)[number], v: string) => setList((all) => all.map((c, j) => (j === i ? { ...c, [key]: v } : c)));
  return (
    <div className="flex flex-col gap-3">
      {list.map((c, i) => (
        <div key={i} className="grid gap-2 rounded-xl p-3 ring-1 ring-stone-200 sm:grid-cols-2" onBlur={() => commit()}>
          <input aria-label="Name" className={field} placeholder="Name" value={c.name} onChange={(e) => set(i, "name", e.target.value)} />
          <input aria-label="Role" className={field} placeholder="Role (recruiter, hiring manager)" value={c.role} onChange={(e) => set(i, "role", e.target.value)} />
          <input aria-label="Email" type="email" className={field} placeholder="Email" value={c.email} onChange={(e) => set(i, "email", e.target.value)} />
          <div className="flex gap-2">
            <input aria-label="Phone" className={field} placeholder="Phone" value={c.phone} onChange={(e) => set(i, "phone", e.target.value)} />
            <button
              type="button"
              className={btn.ghost}
              aria-label="Remove contact"
              onClick={() => {
                const next = list.filter((_, j) => j !== i);
                setList(next);
                commit(next);
              }}
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className={`${btn.secondary} self-start`} disabled={list.length >= 20} onClick={() => setList((all) => [...all, { name: "", role: "", email: "", phone: "" }])}>
        Add contact
      </button>
    </div>
  );
}

function Research({ app, save, onGate }: { app: ApplicationDto; save: Save; onGate: (g: Gate) => void }) {
  const { call } = useAiCall();
  const qc = useQueryClient();
  const [r, setR] = useState(app.research);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const commit = (next = r) => JSON.stringify(next) !== JSON.stringify(app.research) && save({ research: next });

  async function brief() {
    setBusy(true);
    setError("");
    try {
      const updated = await call<ApplicationDto>(`/applications/${app.id}/brief`, {});
      setR(updated.research);
      qc.setQueryData<ApplicationDto[]>(trackerKeys.applications(false), (list) => list?.map((a) => (a.id === updated.id ? { ...a, research: updated.research } : a)));
    } catch (e) {
      const gate = gateForError(e);
      if (gate) onGate(gate);
      else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-brand/[0.04] p-3 ring-1 ring-brand/15">
        <p className="text-sm text-stone-700">Get questions to ask and themes to research for this company.</p>
        <button type="button" className={btn.primary} disabled={busy} onClick={() => void brief()}>
          {busy ? "Thinking…" : "✦ Research brief"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Field id="r-values" title="Company values and culture">
        <textarea id="r-values" rows={3} className={field} value={r.values} onChange={(e) => setR({ ...r, values: e.target.value })} onBlur={() => commit()} />
      </Field>
      <Field id="r-links" title="Links (one per line)">
        <textarea
          id="r-links"
          rows={3}
          className={`${field} font-mono text-xs`}
          value={r.links.join("\n")}
          onChange={(e) => setR({ ...r, links: e.target.value.split("\n").slice(0, 20) })}
          onBlur={() => {
            const next = { ...r, links: r.links.map((l) => l.trim()).filter(Boolean) };
            setR(next);
            commit(next);
          }}
        />
      </Field>
      <Field id="r-questions" title="Questions to ask them (one per line)">
        <textarea
          id="r-questions"
          rows={5}
          className={field}
          value={r.questionsToAsk.join("\n")}
          onChange={(e) => setR({ ...r, questionsToAsk: e.target.value.split("\n").slice(0, 20) })}
          onBlur={() => {
            const next = { ...r, questionsToAsk: r.questionsToAsk.map((l) => l.trim()).filter(Boolean) };
            setR(next);
            commit(next);
          }}
        />
      </Field>
      <Field id="r-notes" title="Research notes">
        <textarea id="r-notes" rows={6} className={field} value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} onBlur={() => commit()} />
      </Field>
    </div>
  );
}

function Offer({ app, save }: { app: ApplicationDto; save: Save }) {
  const [o, setO] = useState<OfferDetailsDto>(app.offer ?? EMPTY_OFFER);
  const commit = (next = o) => save({ offer: next });
  const money = (key: "baseSalary" | "bonus" | "equity", title: string) => (
    <Field id={`o-${key}`} title={title}>
      <input
        id={`o-${key}`}
        inputMode="numeric"
        className={field}
        value={o[key] ?? ""}
        onChange={(e) => setO({ ...o, [key]: e.target.value === "" ? null : Math.max(0, Number(e.target.value.replace(/[^\d.]/g, ""))) })}
        onBlur={() => commit()}
      />
    </Field>
  );
  if (!app.offer && o === EMPTY_OFFER) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-stone-600">Got an offer? Record it to compare offers side by side and use the negotiation templates.</p>
        <button type="button" className={btn.primary} onClick={() => setO({ ...EMPTY_OFFER, currency: app.currency ?? "" })}>
          Add offer details
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2" onBlur={() => commit()}>
      {money("baseSalary", "Base salary (yearly)")}
      <Field id="o-cur" title="Currency">
        <input id="o-cur" className={field} maxLength={10} value={o.currency} onChange={(e) => setO({ ...o, currency: e.target.value })} />
      </Field>
      {money("bonus", "Bonus (yearly)")}
      {money("equity", "Equity (yearly value)")}
      <Field id="o-remote" title="Work arrangement">
        <select id="o-remote" className={field} value={o.remote} onChange={(e) => setO({ ...o, remote: e.target.value as OfferDetailsDto["remote"] })}>
          <option value="">Not stated</option>
          <option value="onsite">On site</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </select>
      </Field>
      <Field id="o-growth" title="Growth potential (1–5)">
        <select id="o-growth" className={field} value={o.growth ?? ""} onChange={(e) => setO({ ...o, growth: e.target.value ? Number(e.target.value) : null })}>
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <Field id="o-location" title="Location">
        <input id="o-location" className={field} value={o.location} maxLength={200} onChange={(e) => setO({ ...o, location: e.target.value })} />
      </Field>
      <Field id="o-deadline" title="Answer by">
        <input id="o-deadline" type="date" className={field} value={o.deadline} onChange={(e) => setO({ ...o, deadline: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="o-benefits" title="Benefits">
          <textarea id="o-benefits" rows={3} className={field} value={o.benefits} onChange={(e) => setO({ ...o, benefits: e.target.value })} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id="o-notes" title="Notes">
          <textarea id="o-notes" rows={3} className={field} value={o.notes} onChange={(e) => setO({ ...o, notes: e.target.value })} />
        </Field>
      </div>
      <button type="button" className="justify-self-start text-sm font-medium text-red-600 hover:underline" onClick={() => (save({ offer: null }), setO(EMPTY_OFFER))}>
        Remove offer details
      </button>
    </div>
  );
}

function Share({ app, onGate }: { app: ApplicationDto; onGate: (g: Gate) => void }) {
  const qc = useQueryClient();
  const links = useShareLinks(app.resumeId ?? "", Boolean(app.resumeId && app.shareLinkId));
  const link = links.data?.find((l) => l.id === app.shareLinkId);
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () => api.post<ApplicationDto>(`/applications/${app.id}/share-link`, {}),
    onSuccess: (updated) => {
      qc.setQueryData<ApplicationDto[]>(trackerKeys.applications(false), (list) => list?.map((a) => (a.id === updated.id ? updated : a)));
      if (app.resumeId) void qc.invalidateQueries({ queryKey: keys.shareLinks(app.resumeId) });
    },
    onError: (e) => {
      const gate = gateForError(e);
      if (gate) onGate(gate.kind === "feature" ? { kind: "feature", feature: "share.link" } : gate);
    },
  });
  if (!app.resumeId) return <p className="text-sm text-stone-600">Choose the CV you sent (in Details) to make a link just for this employer.</p>;
  if (!app.shareLinkId) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-stone-600">Send this employer their own link to your CV. You&apos;ll see when they open it, for how long, and whether they downloaded it.</p>
        <button type="button" className={btn.primary} disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Creating…" : "Create a link for this application"}
        </button>
        {create.error && !gateForError(create.error) && <p className="text-sm text-red-600">{create.error.message}</p>}
      </div>
    );
  }
  const url = link ? `${window.location.origin}/r/${link.slug}` : "";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input readOnly aria-label="Link" value={url} className={`${field} font-mono text-xs`} onFocus={(e) => e.target.select()} />
        <button type="button" className={btn.secondary} disabled={!url} onClick={() => void navigator.clipboard.writeText(url).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
          <CopyIcon className="size-4" /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-sm text-stone-700">
        Opened <strong>{app.linkViews}</strong> {app.linkViews === 1 ? "time" : "times"}
        {link?.lastViewedAt && <>, last on {new Date(link.lastViewedAt).toLocaleString()}</>}.
      </p>
      <p className="text-xs text-stone-500">Full details (time on page, downloads, devices) are in the CV editor → Share.</p>
    </div>
  );
}
