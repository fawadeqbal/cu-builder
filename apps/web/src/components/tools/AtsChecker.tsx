"use client";

import { ATS_CHECK_ACCEPT, ATS_CHECK_MAX_BYTES, ATS_CHECK_MAX_TEXT, ATS_CHECKS_PER_HOUR, type AtsCheckDto } from "@cvb/contracts";
import { useRef, useState } from "react";
import { Alert, Button, Card, FileDrop, FileRow, SegmentedControl, TextArea, TextField } from "@cvb/ui";
import { api, isApiError } from "@/lib/api";
import { AtsResults } from "./AtsResults";

type Mode = "file" | "text";

const MB = 1024 * 1024;
const sizeLabel = (bytes: number) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function problemFor(e: unknown): string {
  if (isApiError(e, "RATE_LIMITED")) return `You've run ${ATS_CHECKS_PER_HOUR} checks in the last hour. Please try again a little later, or open your CV in the builder, where the ATS check updates as you type.`;
  if (isApiError(e) && e.status === 413) return "That file is larger than 5 MB. Save a smaller copy (without large images) and try again.";
  if (isApiError(e, "VALIDATION_FAILED")) return e.message;
  if (isApiError(e)) return "Something went wrong while checking your CV. Please try again.";
  return "We couldn't reach the server. Check your connection and try again.";
}

/**
 * The free ATS checker: upload a CV or paste its text, optionally add a job advert, and see the
 * score, every issue with its fix and the job's keywords. Nothing is stored on the server.
 */
export function AtsChecker() {
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [withJob, setWithJob] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AtsCheckDto | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function pick(files: File[]) {
    const f = files[0];
    if (!f) return;
    setError(f.size > ATS_CHECK_MAX_BYTES ? "That file is larger than 5 MB. Save a smaller copy and try again." : "");
    setFile(f.size > ATS_CHECK_MAX_BYTES ? null : f);
  }

  const ready = mode === "file" ? Boolean(file) : text.trim().length >= 80;

  async function check() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    if (mode === "file" && file) form.append("file", file);
    else form.append("text", text);
    if (withJob) {
      form.append("jobTitle", jobTitle);
      form.append("jobDescription", jobDescription);
    }
    try {
      const out = await api.upload<AtsCheckDto>("/public/ats-check", form);
      setResult(out);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(problemFor(e));
    } finally {
      setBusy(false);
    }
  }

  function addJob() {
    setWithJob(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function reset() {
    setResult(null);
    setFile(null);
    setText("");
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="flex flex-col gap-8">
      <div ref={formRef} className="scroll-mt-20">
        <Card>
          <div className="flex flex-col gap-5">
            <SegmentedControl<Mode>
              label="How to add your CV"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError("");
              }}
              options={[
                { value: "file", label: "Upload a file", icon: "upload" },
                { value: "text", label: "Paste text", icon: "edit" },
              ]}
              className="self-start"
            />

            {mode === "file" ? (
              file ? (
                <FileRow name={file.name} size={sizeLabel(file.size)} onRemove={() => setFile(null)} />
              ) : (
                <FileDrop title="Drop your CV here" hint="PDF, Word (.docx), OpenDocument, RTF, HTML or text, up to 5 MB" accept={ATS_CHECK_ACCEPT} onFiles={pick} disabled={busy} />
              )
            ) : (
              <TextArea
                label="Your CV text"
                hint="Copy everything from your CV and paste it here."
                rows={10}
                maxLength={ATS_CHECK_MAX_TEXT}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Your name\nJob title\nemail@example.com · phone · city\n\nSummary\n…\n\nExperience\n…"}
              />
            )}

            {withJob ? (
              <fieldset className="flex flex-col gap-4 rounded-lg border border-line p-4">
                <legend className="px-1 text-sm font-semibold text-ink">Job advert (optional)</legend>
                <TextField label="Job title" value={jobTitle} maxLength={160} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Data Analyst" />
                <TextArea label="Job description" hint="Paste the advert to see which of its keywords your CV has and which it's missing." rows={6} maxLength={20_000} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                <Button variant="ghost" size="sm" icon="x" className="self-start" onClick={() => setWithJob(false)}>
                  Remove the job advert
                </Button>
              </fieldset>
            ) : (
              <Button variant="ghost" size="sm" icon="plus" className="self-start" onClick={() => setWithJob(true)}>
                Compare with a job advert
              </Button>
            )}

            {error && <Alert tone="danger">{error}</Alert>}

            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-ink-3">Free, no sign-up. We read your CV to check it and don&apos;t keep a copy.</p>
              <Button variant="primary" size="lg" icon="target" loading={busy} disabled={!ready} onClick={() => void check()}>
                {busy ? "Checking…" : "Check my CV"}
              </Button>
            </div>
            {mode === "text" && text.trim().length > 0 && !ready && <p className="text-sm text-ink-3">Paste a bit more of your CV to run the check.</p>}
          </div>
        </Card>
      </div>

      <div ref={resultsRef} className="scroll-mt-20" aria-live="polite">
        {result && <AtsResults result={result} onAddJob={withJob ? undefined : addJob} onReset={reset} />}
      </div>
    </div>
  );
}
