"use client";

import type { CoverLetterDto, LetterData, UpdateCoverLetterDto } from "@cvb/contracts";
import { CoverLetterDocument, isTemplateId, type LetterSender, type TemplateId } from "@cvb/templates";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CopyIcon, DownloadIcon } from "@cvb/ui";
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
import { btn, field, label } from "../ui/styles";

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
        <Link href="/letters" className="font-semibold text-brand hover:underline">
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

  return (
    <div className="flex h-dvh flex-col bg-stone-100">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-3 sm:px-4">
        <Link href="/letters" className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Back to letters">
          <ArrowLeftIcon className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <input
            aria-label="Letter name"
            value={letter.title}
            onChange={(e) => patch({ title: e.target.value.slice(0, 160) || "Cover letter" })}
            className="w-full truncate rounded px-1 text-sm font-semibold text-stone-900 outline-none hover:bg-stone-50 focus:ring-2 focus:ring-brand"
          />
          <p className="px-1 text-xs text-stone-500">{status === "saving" ? "Saving…" : status === "error" ? "Couldn't save, retrying on your next edit" : "Saved"}</p>
        </div>
        <button type="button" className={btn.secondary} disabled={busy !== null} onClick={() => void download("docx")}>
          Word
        </button>
        <button type="button" className={btn.primary} disabled={busy !== null} onClick={() => void download("pdf")}>
          <DownloadIcon className="size-4" /> {busy === "pdf" ? "Preparing…" : "PDF"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(22rem,30rem)_1fr]">
        <div className="min-h-0 overflow-y-auto border-e border-stone-200 bg-stone-50/70 p-5">
          <div className="flex flex-col gap-5">
            <section className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-stone-600">
                  CV
                  <select className={`${field} mt-1`} value={letter.resumeId ?? ""} onChange={(e) => patch({ resumeId: e.target.value || null }, true)}>
                    <option value="">None</option>
                    {resumes.data?.items.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Job
                  <select className={`${field} mt-1`} value={letter.jobId ?? ""} onChange={(e) => patch({ jobId: e.target.value || null }, true)}>
                    <option value="">None</option>
                    {jobs.data?.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                        {j.company ? ` · ${j.company}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-end gap-2 rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-100">
                <label className="text-xs font-medium text-stone-600">
                  Tone
                  <select className={`${field} mt-1 py-1.5`} value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
                    <option value="formal">Formal</option>
                    <option value="warm">Warm</option>
                    <option value="concise">Concise</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-stone-600">
                  Length
                  <select className={`${field} mt-1 py-1.5`} value={length} onChange={(e) => setLength(e.target.value as typeof length)}>
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>
                <AiButton busy={busy === "draft"} onClick={() => void aiDraft()}>
                  Draft with AI
                </AiButton>
              </div>
            </section>

            <section className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["recipient", "Recipient (optional)", "Ms Sara Khan"],
                    ["company", "Company", "Acme"],
                    ["date", "Date", "22 October 2026"],
                    ["address", "Address (optional)", "City, Country"],
                  ] as const
                ).map(([key, text, ph]) => (
                  <div key={key}>
                    <label className={label} htmlFor={`l-${key}`}>
                      {text}
                    </label>
                    <input id={`l-${key}`} className={field} placeholder={ph} value={letter.data[key]} onChange={(e) => setData({ [key]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div>
                <label className={label} htmlFor="l-subject">
                  Subject line
                </label>
                <input id="l-subject" className={field} placeholder="Application for Backend Engineer" value={letter.data.subject} onChange={(e) => setData({ subject: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="l-greeting">
                  Greeting
                </label>
                <input id="l-greeting" className={field} value={letter.data.greeting} onChange={(e) => setData({ greeting: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="l-body">
                  Letter <span className="font-normal text-stone-400">leave an empty line between paragraphs</span>
                </label>
                <textarea
                  id="l-body"
                  rows={14}
                  className={`${field} leading-relaxed`}
                  value={paragraphsText}
                  onChange={(e) => setData({ paragraphs: e.target.value.split(/\n\s*\n/) })}
                />
                <p className="mt-1 text-xs text-stone-500">{paragraphsText.trim().split(/\s+/).filter(Boolean).length} words · 250–350 reads best</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="l-closing">
                    Closing
                  </label>
                  <input id="l-closing" className={field} value={letter.data.closing} onChange={(e) => setData({ closing: e.target.value })} />
                </div>
                <div>
                  <label className={label} htmlFor="l-sign">
                    Signature
                  </label>
                  <input id="l-sign" className={field} value={letter.data.signature} onChange={(e) => setData({ signature: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4">
              <label className="text-xs font-medium text-stone-600">
                Design (matches your CV template)
                <select className={`${field} mt-1`} value={template} onChange={(e) => patch({ templateId: e.target.value }, true)}>
                  {catalog.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-stone-800">Share link {letter.shareEnabled ? "on" : "off"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={letter.shareEnabled}
                  aria-label="Share link on or off"
                  onClick={() => patch({ shareEnabled: !letter.shareEnabled }, true)}
                  className={`relative h-6 w-11 rounded-full transition ${letter.shareEnabled ? "bg-emerald-500" : "bg-stone-300"}`}
                >
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${letter.shareEnabled ? "start-[22px]" : "start-0.5"}`} />
                </button>
              </div>
              {letter.shareEnabled && shareUrl && (
                <div className="flex gap-2">
                  <input readOnly value={shareUrl} className={`${field} font-mono text-xs`} onFocus={(e) => e.target.select()} />
                  <button type="button" className={btn.secondary} onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => setNotice("Link copied"))}>
                    <CopyIcon className="size-4" />
                  </button>
                </div>
              )}
            </section>
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
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}
