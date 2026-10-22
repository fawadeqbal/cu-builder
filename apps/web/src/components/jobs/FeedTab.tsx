"use client";

import type { ApplicationDto, FeedJobDto, JobPreferencesDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { gateForError } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { keys } from "@/lib/queries";
import { trackerKeys, useFeed, usePreferences, type FeedResult } from "@/lib/tracker";
import { Dialog } from "../ui/Dialog";
import { btn, card, field, label } from "../ui/styles";

const SOURCE_LINK: Record<string, string> = { remotive: "https://remotive.com", jooble: "https://jooble.org", adzuna: "https://www.adzuna.com" };

const ago = (iso: string | null) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString();
};

const scoreTone = (s: number) => (s >= 70 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : s >= 45 ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-stone-100 text-stone-600 ring-stone-200");

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
      <form onSubmit={search} className={`${card} flex flex-wrap items-end gap-2 p-3`}>
        <label className="min-w-48 flex-[2] text-xs font-medium text-stone-600">
          Job title or keywords
          <input className={`${field} mt-1`} value={form.q} placeholder={keywords || "e.g. React developer"} onChange={(e) => setForm({ ...form, q: e.target.value })} />
        </label>
        <label className="min-w-36 flex-1 text-xs font-medium text-stone-600">
          Location
          <input className={`${field} mt-1`} value={form.location} placeholder="Anywhere" onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 px-1 pb-2 text-sm text-stone-700">
          <input type="checkbox" className="size-4 accent-brand" checked={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.checked })} /> Remote only
        </label>
        <button type="submit" className={btn.primary}>
          Search
        </button>
        <button type="button" className={btn.secondary} onClick={() => setEditingPrefs(true)}>
          Preferences &amp; alerts
        </button>
      </form>

      {range && (
        <div className={`${card} flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm`}>
          <span className="font-semibold text-stone-900">Market salary for “{keywords}”</span>
          <span className="text-stone-600">
            Typical {range.p25.toLocaleString()}–{range.p75.toLocaleString()} · median <strong>{range.median.toLocaleString()}</strong>
          </span>
          <span className="text-xs text-stone-500">
            {range.samples.toLocaleString()} postings · {range.source}
          </span>
        </div>
      )}

      {feed.isLoading ? (
        <p className="py-10 text-center text-sm text-stone-500">Searching job boards…</p>
      ) : feed.isError ? (
        <p className="py-10 text-center text-sm text-red-600">{feed.error.message}</p>
      ) : !keywords ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">
          Search for a job title, or set the roles you want in Preferences to see jobs here every time.
        </p>
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
      <p className="text-sm text-stone-500">
        {data.jobs.length} jobs for <strong className="text-stone-800">{data.keywords}</strong>. Match scores use your most recently edited CV.
      </p>
      {data.jobs.length === 0 && <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-stone-500 ring-1 ring-stone-200">No jobs found. Try a broader title.</p>}
      <ul className="flex flex-col gap-3" aria-label="Job results">
        {data.jobs.map((j) => (
          <FeedCard key={j.externalId} job={j} onGate={onGate} />
        ))}
      </ul>
      <p className="text-xs text-stone-500">
        Jobs from{" "}
        {data.sources.map((s, i) => (
          <span key={s}>
            {i > 0 && ", "}
            <a className="underline" href={SOURCE_LINK[s] ?? "#"} target="_blank" rel="noreferrer noopener">
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
    <li className={`${card} p-4`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-stone-900">{job.title}</h3>
          <p className="text-sm text-stone-600">{[job.company, job.location, job.salary].filter(Boolean).join(" · ")}</p>
          <p className="mt-0.5 text-xs text-stone-500">
            {job.source}
            {job.postedAt && ` · ${ago(job.postedAt)}`}
            {job.remote && " · Remote"}
          </p>
        </div>
        {job.score !== null && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${scoreTone(job.score)}`} title="How well your CV matches this job">
            {job.score}% match
          </span>
        )}
      </div>
      {job.description && (
        <div className={`mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600 ${open ? "" : "line-clamp-3"}`}>{job.description}</div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isSaved ? (
          <>
            <Link href={saved ? `/tracker?app=${saved.id}` : "/tracker"} className={btn.secondary}>
              ✓ In your tracker
            </Link>
            {saved && (
              <Link href={`/jobs?tab=saved&job=${saved.job.id}`} className={btn.ghost}>
                Tailor CV or write a letter →
              </Link>
            )}
          </>
        ) : (
          <button type="button" className={btn.primary} disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save to tracker"}
          </button>
        )}
        <a href={job.url} target="_blank" rel="noreferrer noopener" className={btn.ghost}>
          View posting ↗
        </a>
        {job.description.length > 240 && (
          <button type="button" className="ms-auto text-sm font-medium text-brand hover:underline" onClick={() => setOpen((v) => !v)}>
            {open ? "Less" : "More"}
          </button>
        )}
      </div>
      {save.error && !gateForError(save.error) && <p className="mt-2 text-sm text-red-600">{save.error.message}</p>}
    </li>
  );
}

function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const prefs = usePreferences();
  return (
    <Dialog open onClose={onClose} title="Job preferences" description="Used for your feed and job alerts.">
      {prefs.data ? <PreferencesForm initial={prefs.data} onClose={onClose} /> : <p className="py-6 text-center text-sm text-stone-500">Loading…</p>}
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
      <div>
        <label className={label} htmlFor="p-title">
          Roles you want (up to 5)
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {p.titles.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-800">
              {t}
              <button type="button" aria-label={`Remove ${t}`} className="text-stone-500 hover:text-stone-900" onClick={() => setP({ ...p, titles: p.titles.filter((x) => x !== t) })}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            id="p-title"
            className={field}
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
          <button type="button" className={btn.secondary} onClick={addTitle} disabled={p.titles.length >= 5}>
            Add
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="p-location">
            Location
          </label>
          <input id="p-location" className={field} value={p.location} maxLength={120} placeholder="Anywhere" onChange={(e) => setP({ ...p, location: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="p-salary">
            Minimum yearly salary
          </label>
          <input
            id="p-salary"
            inputMode="numeric"
            className={field}
            value={p.salaryMin ?? ""}
            placeholder="Any"
            onChange={(e) => setP({ ...p, salaryMin: e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null })}
          />
          <p className="mt-1 text-xs text-stone-500">Hides jobs that state lower pay; jobs without a salary stay.</p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" className="size-4 accent-brand" checked={p.remote} onChange={(e) => setP({ ...p, remote: e.target.checked })} /> Remote jobs only
      </label>
      <fieldset>
        <legend className={label}>Email me new jobs</legend>
        <div className="flex gap-4 text-sm text-stone-700">
          {(["off", "daily", "weekly"] as const).map((a) => (
            <label key={a} className="flex items-center gap-1.5">
              <input type="radio" name="alerts" className="accent-brand" checked={p.alerts === a} onChange={() => setP({ ...p, alerts: a })} />
              {a === "off" ? "Never" : a === "daily" ? "Daily" : "Weekly"}
            </label>
          ))}
        </div>
        {p.alerts !== "off" && p.titles.length === 0 && <p className="mt-1 text-xs text-amber-700">Add at least one role so alerts know what to look for.</p>}
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" className="size-4 accent-brand" checked={p.weeklyDigest} onChange={(e) => setP({ ...p, weeklyDigest: e.target.checked })} /> Monday email with my
        application progress
      </label>
      {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btn.ghost} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className={btn.primary} disabled={save.isPending}>
          Save
        </button>
      </div>
    </form>
  );
}
