"use client";

import type { CreateJobDto, JobDto } from "@cvb/contracts";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { btn, field, label } from "../ui/styles";

/** Add a job by pasting the ad, or (signed in) by its link. */
export function JobForm({ onSaved, allowLink = true, local }: { onSaved: (job: JobDto) => void; allowLink?: boolean; local?: boolean }) {
  const [mode, setMode] = useState<"paste" | "link">("paste");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (local) {
        const now = new Date().toISOString();
        onSaved({ id: "local", title, company, location: "", url: null, description, source: "manual", salary: "", remote: false, createdAt: now, updatedAt: now });
      } else if (mode === "link") {
        onSaved(await api.post<JobDto>("/jobs/import", { url: url.trim() }));
      } else {
        const body: Partial<CreateJobDto> = { title: title.trim(), company: company.trim(), description };
        onSaved(await api.post<JobDto>("/jobs", body));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {allowLink && !local && (
        <div role="tablist" className="grid grid-cols-2 rounded-lg bg-stone-100 p-0.5 text-[13px]">
          {(
            [
              ["paste", "Paste the job ad"],
              ["link", "From a link"],
            ] as const
          ).map(([m, t]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md py-1.5 font-medium ${mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>
              {t}
            </button>
          ))}
        </div>
      )}
      {mode === "link" && !local ? (
        <div>
          <label className={label} htmlFor="job-url">
            Job link
          </label>
          <input id="job-url" type="url" required className={field} placeholder="https://company.com/careers/backend-engineer" value={url} onChange={(e) => setUrl(e.target.value)} />
          <p className="mt-1 text-xs text-stone-500">Works with most company career pages and job boards. If a site blocks reading, paste the ad instead.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="job-title">
                Job title
              </label>
              <input id="job-title" required className={field} placeholder="Backend Engineer" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="job-company">
                Company
              </label>
              <input id="job-company" className={field} placeholder="Acme" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="job-desc">
              Job description
            </label>
            <textarea id="job-desc" required rows={9} className={`${field} leading-relaxed`} placeholder="Paste the whole ad: responsibilities, requirements, nice to haves." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className={`${btn.primary} self-end`} disabled={busy}>
        {busy ? "Reading…" : local ? "Check my match" : "Save and match"}
      </button>
    </form>
  );
}
