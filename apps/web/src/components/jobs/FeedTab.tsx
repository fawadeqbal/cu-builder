"use client";

import type { ApplicationDto, FeedJobDto, JobPreferencesDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Alert, Button, Checkbox, EmptyState, Field, Icon, MatchScore, RadioGroup, Skeleton, Spinner, TextField } from "@cvb/ui";
import { gateForError } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { keys } from "@/lib/queries";
import { trackerKeys, useFeed, usePreferences, type FeedResult } from "@/lib/tracker";
import { Dialog } from "../ui/Dialog";

const SOURCE_LINK: Record<string, string> = { remotive: "https://remotive.com", jooble: "https://jooble.org", adzuna: "https://www.adzuna.com" };

const ago = (iso: string | null) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString();
};

/** "Find jobs": postings from job boards, scored against your CV, saved to the tracker in one click. */
export function FeedTab({ onGate }: { onGate: (g: Gate) => void }) {
  const [form, setForm] = useState({ q: "", location: "", remote: false });
  const [query, setQuery] = useState(form);
  const [editingPrefs, setEditingPrefs] = useState(false);
  const feed = useFeed(query.q, query.location, query.remote);
  const keywords = feed.data?.keywords ?? "";
  const salary = useQuery({
    queryKey: ["feed", "salary", keywords, query.location],
    queryFn: () => api.get<{ range: { p25: number; median: number; p75: number; samples: number; source: string } | null }>(`/feed/salary?${new URLSearchParams({ title: keywords, location: query.location })}`),
    enabled: Boolean(keywords),
    staleTime: 3600_000,
  });

  function search(e: FormEvent) {
    e.preventDefault();
    setQuery({ ...form, q: form.q.trim(), location: form.location.trim() });
  }

  const range = salary.data?.range;
  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={search} className="cvb-card flex flex-wrap items-end gap-3 p-4" role="search">
        <TextField label="Job title or keywords" className="min-w-48 flex-[2]" icon="search" value={form.q} placeholder={keywords || "e.g. React developer"} onChange={(e) => setForm({ ...form, q: e.target.value })} />
        <TextField label="Location" className="min-w-36 flex-1" icon="map-pin" value={form.location} placeholder="Anywhere" onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <Checkbox label="Remote only" className="pb-2.5" checked={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.checked })} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" icon="search">
            Search
          </Button>
          <Button variant="ghost" icon="sliders" onClick={() => setEditingPrefs(true)}>
            Preferences &amp; alerts
          </Button>
        </div>
      </form>

      {range && (
        <div className="cvb-card flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-sm">
          <span className="font-semibold text-ink">Market salary for “{keywords}”</span>
          <span className="text-ink-2">
            Typical <span className="cvb-num">{range.p25.toLocaleString()}–{range.p75.toLocaleString()}</span> · median <strong className="cvb-num text-ink">{range.median.toLocaleString()}</strong>
          </span>
          <span className="cvb-caption">
            {range.samples.toLocaleString()} postings · {range.source}
          </span>
        </div>
      )}

      {feed.isLoading ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Spinner /> Searching job boards…
          </p>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={148} shape="block" />
          ))}
        </div>
      ) : feed.isError ? (
        <Alert tone="danger">{feed.error.message}</Alert>
      ) : !keywords ? (
        <div className="cvb-card">
          <EmptyState
            icon="search"
            title="Find jobs that fit your CV"
            actions={
              <Button icon="sliders" onClick={() => setEditingPrefs(true)}>
                Preferences &amp; alerts
              </Button>
            }
          >
            Search for a job title, or set the roles you want in Preferences to see jobs here every time.
          </EmptyState>
        </div>
      ) : (
        <Results data={feed.data!} onGate={onGate} />
      )}

      {editingPrefs && <PreferencesDialog onClose={() => setEditingPrefs(false)} />}
    </div>
  );
}

function Results({ data, onGate }: { data: FeedResult; onGate: (g: Gate) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-3">
        <span className="cvb-num">{data.jobs.length}</span> jobs for <strong className="text-ink">{data.keywords}</strong>. Match scores use your most recently edited CV.
      </p>
      {data.jobs.length === 0 && (
        <div className="cvb-card">
          <EmptyState icon="search" title="No jobs found">
            Try a broader title.
          </EmptyState>
        </div>
      )}
      <ul className="flex flex-col gap-3" aria-label="Job results">
        {data.jobs.map((j) => (
          <FeedCard key={j.externalId} job={j} onGate={onGate} />
        ))}
      </ul>
      <p className="cvb-caption">
        Jobs from{" "}
        {data.sources.map((s, i) => (
          <span key={s}>
            {i > 0 && ", "}
            <a className="text-brand-ink underline" href={SOURCE_LINK[s] ?? "#"} target="_blank" rel="noreferrer noopener">
              {s[0]!.toUpperCase() + s.slice(1)}
            </a>
          </span>
        ))}
        . Postings open on the original site.
      </p>
    </div>
  );
}

function FeedCard({ job, onGate }: { job: FeedJobDto; onGate: (g: Gate) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<ApplicationDto | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const { score: _s, saved: _v, ...body } = job;
      return api.post<ApplicationDto>("/feed/save", body);
    },
    onSuccess: (app) => {
      setSaved(app);
      void qc.invalidateQueries({ queryKey: trackerKeys.all });
      void qc.invalidateQueries({ queryKey: keys.jobs });
    },
    onError: (e) => {
      const gate = gateForError(e);
      if (gate) onGate(gate.kind === "feature" ? { kind: "feature", feature: "tracker.unlimited" } : gate);
    },
  });
  const isSaved = job.saved || saved;
  return (
    <li className="cvb-job">
      <div className="cvb-job-head flex-wrap">
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="cvb-job-title break-words">{job.title}</h3>
          <div className="cvb-job-meta mt-1">
            {job.company && (
              <span>
                <Icon name="building" size={14} /> {job.company}
              </span>
            )}
            {job.location && (
              <span>
                <Icon name="map-pin" size={14} /> {job.location}
              </span>
            )}
            {job.salary && <span className="cvb-num">{job.salary}</span>}
          </div>
        </div>
        {job.score !== null && (
          <span title="How well your CV matches this job">
            <MatchScore score={job.score} />
          </span>
        )}
      </div>
      {job.description && <div className={`whitespace-pre-line break-words text-sm leading-relaxed text-ink-2 ${open ? "" : "line-clamp-3"}`}>{job.description}</div>}
      <div className="cvb-job-actions items-center">
        {isSaved ? (
          <>
            <Button icon="check" href={saved ? `/tracker?app=${saved.id}` : "/tracker"}>
              In your tracker
            </Button>
            {saved && (
              <Button variant="ghost" iconEnd="arrow-right" href={`/jobs?tab=saved&job=${saved.job.id}`}>
                Tailor CV or write a letter
              </Button>
            )}
          </>
        ) : (
          <Button variant="primary" icon="plus" loading={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save to tracker"}
          </Button>
        )}
        <Button variant="ghost" href={job.url} target="_blank" rel="noreferrer noopener" iconEnd="external-link">
          View posting
        </Button>
        {job.description.length > 240 && (
          <Button variant="link" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Less" : "More"}
          </Button>
        )}
        <span className="cvb-caption ms-auto">
          {job.source}
          {job.postedAt && ` · ${ago(job.postedAt)}`}
          {job.remote && " · Remote"}
        </span>
      </div>
      {save.error && !gateForError(save.error) && <Alert tone="danger">{save.error.message}</Alert>}
    </li>
  );
}

function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const prefs = usePreferences();
  return (
    <Dialog open onClose={onClose} title="Job preferences" description="Used for your feed and job alerts.">
      {prefs.data ? (
        <PreferencesForm initial={prefs.data} onClose={onClose} />
      ) : (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
    </Dialog>
  );
}

function PreferencesForm({ initial, onClose }: { initial: JobPreferencesDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState(initial);
  const [title, setTitle] = useState("");
  const save = useMutation({
    mutationFn: () => api.put<JobPreferencesDto>("/feed/preferences", p),
    onSuccess: (saved) => {
      qc.setQueryData(trackerKeys.prefs, saved);
      void qc.invalidateQueries({ queryKey: ["feed"] });
      onClose();
    },
  });
  const addTitle = () => {
    const t = title.trim();
    if (t && p.titles.length < 5 && !p.titles.includes(t)) setP({ ...p, titles: [...p.titles, t] });
    setTitle("");
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Roles you want (up to 5)" htmlFor="p-title">
        {p.titles.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {p.titles.map((t) => (
              <span key={t} className="cvb-chip-wrap">
                <span className="cvb-chip">{t}</span>
                <button type="button" className="cvb-chip-remove" aria-label={`Remove ${t}`} onClick={() => setP({ ...p, titles: p.titles.filter((x) => x !== t) })}>
                  <Icon name="x" size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <TextField
            id="p-title"
            className="min-w-0 flex-1"
            value={title}
            maxLength={80}
            placeholder="e.g. Frontend developer"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTitle();
              }
            }}
          />
          <Button icon="plus" onClick={addTitle} disabled={p.titles.length >= 5}>
            Add
          </Button>
        </div>
      </Field>
      <div className="cvb-field-row">
        <TextField id="p-location" label="Location" value={p.location} maxLength={120} placeholder="Anywhere" onChange={(e) => setP({ ...p, location: e.target.value })} />
        <TextField
          id="p-salary"
          label="Minimum yearly salary"
          hint="Hides jobs that state lower pay; jobs without a salary stay."
          inputMode="numeric"
          value={p.salaryMin ?? ""}
          placeholder="Any"
          onChange={(e) => setP({ ...p, salaryMin: e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null })}
        />
      </div>
      <Checkbox label="Remote jobs only" checked={p.remote} onChange={(e) => setP({ ...p, remote: e.target.checked })} />
      <div className="flex flex-col gap-1.5">
        <RadioGroup
          legend="Email me new jobs"
          name="alerts"
          orientation="horizontal"
          value={p.alerts}
          onChange={(a) => setP({ ...p, alerts: a })}
          options={(["off", "daily", "weekly"] as const).map((a) => ({ value: a, label: a === "off" ? "Never" : a === "daily" ? "Daily" : "Weekly" }))}
        />
        {p.alerts !== "off" && p.titles.length === 0 && (
          <p className="flex items-center gap-1 text-xs text-warning">
            <Icon name="alert-triangle" size={14} /> Add at least one role so alerts know what to look for.
          </p>
        )}
      </div>
      <Checkbox label="Monday email with my application progress" checked={p.weeklyDigest} onChange={(e) => setP({ ...p, weeklyDigest: e.target.checked })} />
      {save.error && <Alert tone="danger">{save.error.message}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
