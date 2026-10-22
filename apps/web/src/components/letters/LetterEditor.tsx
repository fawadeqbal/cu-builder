"use client";

import type { CoverLetterDto, LetterData, UpdateCoverLetterDto } from "@cvb/contracts";
import { CoverLetterDocument, isTemplateId, type LetterSender, type TemplateId } from "@cvb/templates";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Icon, IconButton, Select, Switch, TextArea, TextField, Toast, buttonClass } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { api, isApiError } from "@/lib/api";
import { useCatalog } from "@/lib/catalog";
import { downloadBlob } from "@/lib/download";
import { paperSizeAttr } from "@/lib/page";
import { downloadCvPdf } from "@/lib/pdf";
import type { Gate } from "@/lib/plans";
import { keys, useJobs, useLetter, useMe, useResume, useResumes } from "@/lib/queries";
import { AiButton, Suggestion } from "../ai/AiButton";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { Dialog } from "../ui/Dialog";
import { FullPageMessage } from "../ui/FullPageMessage";

type Draft = { greeting: string; paragraphs: string[]; closing: string };

export default function LetterEditor({ id }: { id: string }) {
  return <RequireAuth>{() => <Loaded id={id} />}</RequireAuth>;
}

function Loaded({ id }: { id: string }) {
  const letter = useLetter(id);
  if (letter.isLoading) return <FullPageMessage>Opening your letter…</FullPageMessage>;
  if (!letter.data)
    return (
      <FullPageMessage>
        <Link href="/letters" className="font-semibold text-brand-ink hover:underline">
          This letter doesn&apos;t exist. Back to letters
        </Link>
      </FullPageMessage>
    );
  return <Editor initial={letter.data} />;
}

const slug = (s: string) => (s.trim() || "cover-letter").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Cover letter editor: fields on the left, the letter (styled like the CV) on the right. */
function Editor({ initial }: { initial: CoverLetterDto }) {
  const qc = useQueryClient();
  const me = useMe();
  const resumes = useResumes();
  const jobs = useJobs();
  const catalog = useCatalog();
  const { call } = useAiCall();
  const [letter, setLetter] = useState(initial);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [gate, setGate] = useState<Gate | null>(null);
  const [tone, setTone] = useState<"formal" | "warm" | "concise">("formal");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef<UpdateCoverLetterDto>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resume = useResume(letter.resumeId ?? "", Boolean(letter.resumeId));

  const template: TemplateId = isTemplateId(letter.templateId) ? letter.templateId : "classic";
  const p = resume.data?.data.personal;
  const sender: LetterSender = {
    name: p?.name || letter.data.signature || me.data?.name || "",
    headline: p?.headline ?? "",
    email: p?.email || me.data?.email || "",
    phone: p?.phone ?? "",
    location: p?.location ?? "",
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function flush() {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setStatus("saving");
    try {
      const saved = await api.patch<CoverLetterDto>(`/cover-letters/${letter.id}`, patch);
      qc.setQueryData(keys.letter(letter.id), saved);
      void qc.invalidateQueries({ queryKey: keys.letters });
      setLetter((l) => ({ ...l, shareSlug: saved.shareSlug, shareEnabled: saved.shareEnabled }));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  function patch(p: UpdateCoverLetterDto, now = false) {
    setLetter((l) => ({ ...l, ...p, data: p.data ?? l.data }) as CoverLetterDto);
    pending.current = { ...pending.current, ...p };
    setStatus("saving");
    clearTimeout(timer.current);
    if (now) void flush();
    else timer.current = setTimeout(() => void flush(), 700);
  }

  const setData = (d: Partial<LetterData>) => patch({ data: { ...letter.data, ...d } });

  async function aiDraft() {
    if (!letter.resumeId || !letter.jobId) return setNotice("Choose the CV and the job first");
    setBusy("draft");
    try {
      setDraft(await call<Draft>("/cover-letters/draft", { resumeId: letter.resumeId, jobId: letter.jobId, tone, length }));
    } catch (e) {
      const g = gateForError(e);
      if (g) setGate(g);
      else setNotice(e instanceof Error ? e.message : "Couldn't draft");
    } finally {
      setBusy(null);
    }
  }

  function applyDraft(d: Draft) {
    setData({ greeting: d.greeting, paragraphs: d.paragraphs, closing: d.closing });
    setDraft(null);
    setNotice("Draft added. Edit it so it sounds like you.");
  }

  async function download(kind: "pdf" | "docx") {
    setBusy(kind);
    try {
      const name = `${slug(sender.name)}-cover-letter`;
      if (kind === "pdf") {
        const sheet = document.querySelector<HTMLElement>(".print-only .paper");
        if (sheet) await downloadCvPdf(sheet, { fileName: `${name}.pdf`, title: letter.title, author: sender.name, pageSize: letter.pageSize });
      } else {
        const { buildLetterDocx } = await import("@/lib/docx");
        const accent = letter.accent ?? catalog.meta(template).accent;
        downloadBlob(await buildLetterDocx({ sender, letter: letter.data }, { accent, pageSize: letter.pageSize }), `${name}.docx`);
      }
    } catch (e) {
      if (isApiError(e)) setNotice(e.message);
    } finally {
      setBusy(null);
    }
  }

  const shareUrl = letter.shareSlug && typeof window !== "undefined" ? `${window.location.origin}/l/${letter.shareSlug}` : "";
  const paragraphsText = letter.data.paragraphs.join("\n\n");

  const words = paragraphsText.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4">
        <Link href="/letters" className={buttonClass({ variant: "ghost", icon: true })} aria-label="Back to letters">
          <Icon name="arrow-left" size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <input
            aria-label="Letter name"
            value={letter.title}
            onChange={(e) => patch({ title: e.target.value.slice(0, 160) || "Cover letter" })}
            className="w-full truncate rounded-sm bg-transparent px-1 font-display text-[17px] font-semibold text-ink outline-none hover:bg-surface-2 focus-visible:shadow-(--focus-ring)"
          />
          <p className={`flex items-center gap-1 px-1 text-xs ${status === "error" ? "text-danger" : "text-ink-3"}`} role="status">
            {status === "error" && <Icon name="alert-triangle" size={14} />}
            {status === "saved" && <Icon name="check" size={14} />}
            {status === "saving" ? "Saving…" : status === "error" ? "Couldn't save, retrying on your next edit" : "Saved"}
          </p>
        </div>
        <Button icon="file" disabled={busy !== null} loading={busy === "docx"} onClick={() => void download("docx")}>
          Word
        </Button>
        <Button variant="primary" icon="download" disabled={busy !== null} loading={busy === "pdf"} onClick={() => void download("pdf")}>
          {busy === "pdf" ? "Preparing…" : "PDF"}
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(22rem,30rem)_1fr]">
        <div className="min-h-0 overflow-y-auto border-e border-line p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <Card>
              <div className="cvb-field-row">
                <Select label="CV" value={letter.resumeId ?? ""} onChange={(e) => patch({ resumeId: e.target.value || null }, true)}>
                  <option value="">None</option>
                  {resumes.data?.items.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </Select>
                <Select label="Job" value={letter.jobId ?? ""} onChange={(e) => patch({ jobId: e.target.value || null }, true)}>
                  <option value="">None</option>
                  {jobs.data?.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                      {j.company ? ` · ${j.company}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="cvb-ai flex-row flex-wrap items-end gap-2 p-3">
                <Select
                  label="Tone"
                  size="sm"
                  className="min-w-28 flex-1"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as typeof tone)}
                  options={[
                    { value: "formal", label: "Formal" },
                    { value: "warm", label: "Warm" },
                    { value: "concise", label: "Concise" },
                  ]}
                />
                <Select
                  label="Length"
                  size="sm"
                  className="min-w-28 flex-1"
                  value={length}
                  onChange={(e) => setLength(e.target.value as typeof length)}
                  options={[
                    { value: "short", label: "Short" },
                    { value: "medium", label: "Medium" },
                    { value: "long", label: "Long" },
                  ]}
                />
                <AiButton busy={busy === "draft"} onClick={() => void aiDraft()}>
                  Draft with AI
                </AiButton>
              </div>
            </Card>

            <Card>
              <div className="cvb-field-row">
                {(
                  [
                    ["recipient", "Recipient", "Ms Sara Khan", true],
                    ["company", "Company", "Acme", false],
                    ["date", "Date", "22 October 2026", false],
                    ["address", "Address", "City, Country", true],
                  ] as const
                ).map(([key, text, ph, optional]) => (
                  <TextField key={key} id={`l-${key}`} label={text} optional={optional} placeholder={ph} value={letter.data[key]} onChange={(e) => setData({ [key]: e.target.value })} />
                ))}
              </div>
              <TextField id="l-subject" label="Subject line" placeholder="Application for Backend Engineer" value={letter.data.subject} onChange={(e) => setData({ subject: e.target.value })} />
              <TextField id="l-greeting" label="Greeting" value={letter.data.greeting} onChange={(e) => setData({ greeting: e.target.value })} />
              <TextArea
                id="l-body"
                rows={14}
                label={
                  <>
                    Letter <span className="font-normal text-ink-3">leave an empty line between paragraphs</span>
                  </>
                }
                hint={
                  <>
                    <span className="cvb-num">{words}</span> words · 250–350 reads best
                  </>
                }
                value={paragraphsText}
                onChange={(e) => setData({ paragraphs: e.target.value.split(/\n\s*\n/) })}
              />
              <div className="cvb-field-row">
                <TextField id="l-closing" label="Closing" value={letter.data.closing} onChange={(e) => setData({ closing: e.target.value })} />
                <TextField id="l-sign" label="Signature" value={letter.data.signature} onChange={(e) => setData({ signature: e.target.value })} />
              </div>
            </Card>

            <Card>
              <Select
                label="Design (matches your CV template)"
                value={template}
                onChange={(e) => patch({ templateId: e.target.value }, true)}
                options={catalog.templates.map((t) => ({ value: t.id, label: t.name }))}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink">Share link {letter.shareEnabled ? "on" : "off"}</span>
                <Switch aria-label="Share link on or off" checked={letter.shareEnabled} onChange={() => patch({ shareEnabled: !letter.shareEnabled }, true)} />
              </div>
              {letter.shareEnabled && shareUrl && (
                <div className="flex gap-2">
                  <TextField readOnly aria-label="Share link" icon="link" dir="ltr" className="min-w-0 flex-1" inputClassName="font-mono text-xs" value={shareUrl} onFocus={(e) => e.target.select()} />
                  <IconButton icon="copy" variant="secondary" label="Copy link" onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => setNotice("Link copied"))} />
                </div>
              )}
            </Card>
          </div>
        </div>

        <div className="preview-canvas hidden min-h-0 overflow-auto p-6 lg:block">
          <div className="mx-auto w-fit origin-top scale-[0.85] xl:scale-100">
            <div className="paper" data-size={paperSizeAttr(letter.pageSize)}>
              <CoverLetterDocument letter={letter.data} sender={sender} template={template} accent={letter.accent} />
            </div>
          </div>
        </div>
      </div>

      <div className="print-only">
        <div className="paper" data-size={paperSizeAttr(letter.pageSize)}>
          <CoverLetterDocument letter={letter.data} sender={sender} template={template} accent={letter.accent} />
        </div>
      </div>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title="Your AI draft" description="It uses only your CV and the job ad. Read it, then make it sound like you." size="lg">
        {draft && <Suggestion text={[draft.greeting, ...draft.paragraphs, draft.closing].join("\n\n")} onUse={() => applyDraft(draft)} />}
      </Dialog>
      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto">
            <Toast>{notice}</Toast>
          </div>
        </div>
      )}
    </div>
  );
}
