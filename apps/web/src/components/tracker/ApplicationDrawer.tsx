"use client";

import type { ApplicationDto, BoardDto, OfferDetailsDto, ReminderDto, UpdateApplicationDto } from "@cvb/contracts";
import { EMPTY_OFFER } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Alert, Button, Checkbox, Drawer, Field as DsField, Icon, IconButton, Select, Spinner, Tabs, TextArea, TextField as DsTextField } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { keys, useLetters, useResumes, useShareLinks } from "@/lib/queries";
import { fromLocalInput, toLocalInput, trackerKeys, useReminders, useUpdateApplication } from "@/lib/tracker";

const TABS = ["Details", "Contacts", "Research", "Offer", "Share"] as const;
type Tab = (typeof TABS)[number];

type Props = { app: ApplicationDto; columns: BoardDto["columns"]; onClose: () => void; onGate: (g: Gate) => void };

/** Everything about one application, in a side panel. Fields save when you leave them. */
export function ApplicationDrawer({ app, columns, onClose, onGate }: Props) {
  const [tab, setTab] = useState<Tab>("Details");
  const update = useUpdateApplication();
  const qc = useQueryClient();
  const save = (patch: UpdateApplicationDto) => update.mutate({ id: app.id, patch });

  const remove = useMutation({
    mutationFn: () => api.delete(`/applications/${app.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: trackerKeys.all });
      onClose();
    },
  });

  const meta = [app.job.company, app.job.location, app.job.salary].filter(Boolean).join(" · ");
  return (
    <Drawer
      open
      onClose={onClose}
      title={app.job.title}
      description={meta || undefined}
      footer={
        <>
          <Button variant="ghost" icon="trash" className="text-danger" onClick={() => window.confirm("Delete this application? The saved job stays in Jobs.") && remove.mutate()}>
            Delete
          </Button>
          <div className="flex items-center gap-3">
            {update.isPending ? (
              <span className="cvb-caption flex items-center gap-1.5" role="status">
                <Spinner /> Saving…
              </span>
            ) : update.isError ? (
              <span className="flex items-center gap-1 text-xs text-danger" role="alert">
                <Icon name="alert-triangle" size={14} /> {update.error.message}
              </span>
            ) : null}
            <Button icon={app.archived ? "undo" : "files"} onClick={() => (save({ archived: !app.archived }), onClose())}>
              {app.archived ? "Restore" : "Archive"}
            </Button>
          </div>
        </>
      }
    >
      <div className="-mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {app.job.url && (
          <Button variant="link" size="sm" href={app.job.url} target="_blank" rel="noreferrer noopener" iconEnd="external-link">
            Posting
          </Button>
        )}
        <Button variant="link" size="sm" icon="mic" href={`/interview?role=${encodeURIComponent(app.job.title)}&jobId=${app.job.id}`}>
          Practise the interview
        </Button>
      </div>
      <Tabs label="Application" className="shrink-0" value={tab} onChange={setTab} items={TABS.map((t) => ({ id: t, label: t }))} />
      {tab === "Details" && <Details app={app} columns={columns} save={save} />}
      {tab === "Contacts" && <Contacts app={app} save={save} />}
      {tab === "Research" && <Research app={app} save={save} onGate={onGate} />}
      {tab === "Offer" && <Offer app={app} save={save} />}
      {tab === "Share" && <Share app={app} onGate={onGate} />}
    </Drawer>
  );
}

type Save = (patch: UpdateApplicationDto) => void;

function Field({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <DsField label={title} htmlFor={id}>
      {children}
    </DsField>
  );
}

/** A text input that saves on blur, only when the value changed. */
function TextField({ id, title, value, onSave, ...rest }: { id: string; title: string; value: string; onSave: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "id" | "title" | "prefix" | "size" | "className">) {
  const [v, setV] = useState(value);
  return <DsTextField id={id} label={title} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} {...rest} />;
}

function Details({ app, columns, save }: { app: ApplicationDto; columns: BoardDto["columns"]; save: Save }) {
  const resumes = useResumes();
  const letters = useLetters();
  const [notes, setNotes] = useState(app.notes);
  const num = (v: string) => (v.trim() ? Math.max(0, Math.round(Number(v))) || null : null);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="d-stage" label="Stage" value={app.status} onChange={(e) => save({ status: e.target.value })} options={columns.map((c) => ({ value: c.key, label: c.label }))} />
        <Select id="d-cv" label="CV sent" value={app.resumeId ?? ""} onChange={(e) => save({ resumeId: e.target.value || null })}>
          <option value="">Not chosen</option>
          {resumes.data?.items.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </Select>
        <Select id="d-letter" label="Cover letter" value={app.coverLetterId ?? ""} onChange={(e) => save({ coverLetterId: e.target.value || null })}>
          <option value="">None</option>
          {letters.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </Select>
        <DsTextField
          id="d-applied"
          label="Applied on"
          type="date"
          defaultValue={app.appliedAt?.slice(0, 10) ?? ""}
          onBlur={(e) => save({ appliedAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
        />
        <DsTextField id="d-interview" label="Interview" type="datetime-local" defaultValue={toLocalInput(app.interviewAt)} onBlur={(e) => save({ interviewAt: fromLocalInput(e.target.value) })} />
        <DsTextField
          id="d-deadline"
          label="Application deadline"
          type="date"
          defaultValue={app.deadlineAt?.slice(0, 10) ?? ""}
          onBlur={(e) => save({ deadlineAt: e.target.value ? new Date(`${e.target.value}T17:00:00`).toISOString() : null })}
        />
        <DsTextField
          id="d-follow"
          label="Follow up after (days)"
          type="number"
          min={1}
          max={60}
          defaultValue={app.followUpDays ?? ""}
          placeholder="7"
          onBlur={(e) => save({ followUpDays: e.target.value ? Math.min(60, Math.max(1, Number(e.target.value))) : null })}
        />
        <div className="grid grid-cols-[1fr_1fr_5.5rem] gap-2 sm:col-span-2">
          <TextField id="d-smin" title="Salary from" inputMode="numeric" value={app.salaryMin?.toString() ?? ""} onSave={(v) => save({ salaryMin: num(v) })} />
          <TextField id="d-smax" title="to" inputMode="numeric" value={app.salaryMax?.toString() ?? ""} onSave={(v) => save({ salaryMax: num(v) })} />
          <TextField id="d-cur" title="Currency" maxLength={10} value={app.currency ?? ""} onSave={(v) => save({ currency: v.trim() || null })} />
        </div>
      </div>
      <TextArea id="d-notes" label="Notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== app.notes && save({ notes })} />
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
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <h3 className="cvb-overline">Reminders</h3>
      <ul className="flex flex-col gap-2">
        {mine.map((r) => (
          <li key={r.id} className="flex items-start gap-3">
            <Checkbox
              className="min-w-0 flex-1"
              checked={Boolean(r.doneAt)}
              onChange={() => toggle.mutate(r)}
              aria-label={`Done: ${r.title}`}
              label={<span className={r.doneAt ? "text-ink-3 line-through" : "text-ink"}>{r.title}</span>}
            />
            <span className="cvb-caption cvb-num mt-0.5 flex shrink-0 items-center gap-1">
              <Icon name="clock" size={14} />
              {new Date(r.dueAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </li>
        ))}
        {mine.length === 0 && <li className="text-sm text-ink-3">Follow-up, interview and deadline reminders appear here from the dates above.</li>}
      </ul>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && due) add.mutate();
        }}
      >
        <DsTextField aria-label="Reminder" className="min-w-40 flex-1" placeholder="Add a reminder" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        <DsTextField aria-label="When" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        <Button type="submit" icon="bell" loading={add.isPending}>
          Add
        </Button>
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
      {list.length === 0 && <p className="text-sm text-ink-3">Keep the recruiter and hiring manager here so you know who to follow up with.</p>}
      {list.map((c, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-2" onBlur={() => commit()}>
          <DsTextField aria-label="Name" icon="user" placeholder="Name" value={c.name} onChange={(e) => set(i, "name", e.target.value)} />
          <DsTextField aria-label="Role" placeholder="Role (recruiter, hiring manager)" value={c.role} onChange={(e) => set(i, "role", e.target.value)} />
          <DsTextField aria-label="Email" icon="mail" type="email" dir="ltr" placeholder="Email" value={c.email} onChange={(e) => set(i, "email", e.target.value)} />
          <div className="flex gap-1">
            <DsTextField aria-label="Phone" icon="phone" dir="ltr" className="min-w-0 flex-1" placeholder="Phone" value={c.phone} onChange={(e) => set(i, "phone", e.target.value)} />
            <IconButton
              icon="trash"
              label="Remove contact"
              onClick={() => {
                const next = list.filter((_, j) => j !== i);
                setList(next);
                commit(next);
              }}
            />
          </div>
        </div>
      ))}
      <Button icon="plus" className="self-start" disabled={list.length >= 20} onClick={() => setList((all) => [...all, { name: "", role: "", email: "", phone: "" }])}>
        Add contact
      </Button>
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
      <div className="cvb-ai flex-row flex-wrap items-center">
        <p className="m-0 min-w-48 flex-1 text-sm text-ink-2">Get questions to ask and themes to research for this company.</p>
        <Button icon="sparkle" loading={busy} onClick={() => void brief()}>
          {busy ? "Thinking…" : "Research brief"}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <TextArea id="r-values" label="Company values and culture" rows={3} value={r.values} onChange={(e) => setR({ ...r, values: e.target.value })} onBlur={() => commit()} />
      <Field id="r-links" title="Links (one per line)">
        <textarea
          id="r-links"
          rows={3}
          dir="ltr"
          className="cvb-input font-mono text-xs"
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
          className="cvb-input"
          value={r.questionsToAsk.join("\n")}
          onChange={(e) => setR({ ...r, questionsToAsk: e.target.value.split("\n").slice(0, 20) })}
          onBlur={() => {
            const next = { ...r, questionsToAsk: r.questionsToAsk.map((l) => l.trim()).filter(Boolean) };
            setR(next);
            commit(next);
          }}
        />
      </Field>
      <TextArea id="r-notes" label="Research notes" rows={6} value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} onBlur={() => commit()} />
    </div>
  );
}

function Offer({ app, save }: { app: ApplicationDto; save: Save }) {
  const [o, setO] = useState<OfferDetailsDto>(app.offer ?? EMPTY_OFFER);
  const commit = (next = o) => save({ offer: next });
  const money = (key: "baseSalary" | "bonus" | "equity", title: string) => (
    <DsTextField
      id={`o-${key}`}
      label={title}
      inputMode="numeric"
      inputClassName="cvb-num"
      value={o[key] ?? ""}
      onChange={(e) => setO({ ...o, [key]: e.target.value === "" ? null : Math.max(0, Number(e.target.value.replace(/[^\d.]/g, ""))) })}
      onBlur={() => commit()}
    />
  );
  if (!app.offer && o === EMPTY_OFFER) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink-2">Got an offer? Record it to compare offers side by side and use the negotiation templates.</p>
        <Button variant="primary" icon="award" onClick={() => setO({ ...EMPTY_OFFER, currency: app.currency ?? "" })}>
          Add offer details
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2" onBlur={() => commit()}>
      {money("baseSalary", "Base salary (yearly)")}
      <DsTextField id="o-cur" label="Currency" maxLength={10} value={o.currency} onChange={(e) => setO({ ...o, currency: e.target.value })} />
      {money("bonus", "Bonus (yearly)")}
      {money("equity", "Equity (yearly value)")}
      <Select
        id="o-remote"
        label="Work arrangement"
        value={o.remote}
        onChange={(e) => setO({ ...o, remote: e.target.value as OfferDetailsDto["remote"] })}
        options={[
          { value: "", label: "Not stated" },
          { value: "onsite", label: "On site" },
          { value: "hybrid", label: "Hybrid" },
          { value: "remote", label: "Remote" },
        ]}
      />
      <Select
        id="o-growth"
        label="Growth potential (1–5)"
        value={o.growth ?? ""}
        onChange={(e) => setO({ ...o, growth: e.target.value ? Number(e.target.value) : null })}
        options={[{ value: "", label: "—" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))]}
      />
      <DsTextField id="o-location" label="Location" value={o.location} maxLength={200} onChange={(e) => setO({ ...o, location: e.target.value })} />
      <DsTextField id="o-deadline" label="Answer by" type="date" value={o.deadline} onChange={(e) => setO({ ...o, deadline: e.target.value })} />
      <TextArea id="o-benefits" label="Benefits" className="sm:col-span-2" rows={3} value={o.benefits} onChange={(e) => setO({ ...o, benefits: e.target.value })} />
      <TextArea id="o-notes" label="Notes" className="sm:col-span-2" rows={3} value={o.notes} onChange={(e) => setO({ ...o, notes: e.target.value })} />
      <Button variant="ghost" size="sm" icon="trash" className="justify-self-start text-danger" onClick={() => (save({ offer: null }), setO(EMPTY_OFFER))}>
        Remove offer details
      </Button>
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
  if (!app.resumeId) return <p className="text-sm text-ink-2">Choose the CV you sent (in Details) to make a link just for this employer.</p>;
  if (!app.shareLinkId) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink-2">Send this employer their own link to your CV. You&apos;ll see when they open it, for how long, and whether they downloaded it.</p>
        <Button variant="primary" icon="link" loading={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Creating…" : "Create a link for this application"}
        </Button>
        {create.error && !gateForError(create.error) && <Alert tone="danger">{create.error.message}</Alert>}
      </div>
    );
  }
  const url = link ? `${window.location.origin}/r/${link.slug}` : "";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <DsTextField readOnly aria-label="Link" icon="link" dir="ltr" className="min-w-0 flex-1" inputClassName="font-mono text-xs" value={url} onFocus={(e) => e.target.select()} />
        <Button icon={copied ? "check" : "copy"} disabled={!url} onClick={() => void navigator.clipboard.writeText(url).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-sm text-ink-2">
        Opened <strong className="cvb-num text-ink">{app.linkViews}</strong> {app.linkViews === 1 ? "time" : "times"}
        {link?.lastViewedAt && <>, last on {new Date(link.lastViewedAt).toLocaleString()}</>}.
      </p>
      <p className="cvb-caption">Full details (time on page, downloads, devices) are in the CV editor, under Share.</p>
    </div>
  );
}
