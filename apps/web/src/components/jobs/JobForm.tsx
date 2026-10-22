"use client";

import type { CreateJobDto, JobDto } from "@cvb/contracts";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Alert, Button, Tabs, TextArea, TextField } from "@cvb/ui";

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
        <Tabs
          label="How to add the job"
          value={mode}
          onChange={setMode}
          items={[
            { id: "paste", label: "Paste the job ad", icon: "file" },
            { id: "link", label: "From a link", icon: "link" },
          ]}
        />
      )}
      {mode === "link" && !local ? (
        <TextField
          id="job-url"
          type="url"
          required
          label="Job link"
          hint="Works with most company career pages and job boards. If a site blocks reading, paste the ad instead."
          placeholder="https://company.com/careers/backend-engineer"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      ) : (
        <>
          <div className="cvb-field-row">
            <TextField id="job-title" required label="Job title" placeholder="Backend Engineer" value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField id="job-company" label="Company" placeholder="Acme" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <TextArea id="job-desc" required rows={9} label="Job description" placeholder="Paste the whole ad: responsibilities, requirements, nice to haves." value={description} onChange={(e) => setDescription(e.target.value)} />
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" variant="primary" className="self-end" loading={busy}>
        {busy ? "Reading…" : local ? "Check my match" : "Save and match"}
      </Button>
    </form>
  );
}
