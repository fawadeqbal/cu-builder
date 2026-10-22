"use client";

import type { InterviewSessionDto, StarStoryBodyDto, StarStoryDto } from "@cvb/contracts";
import { SENIORITIES, clean, normalizeCV, sessionSummary } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PlusIcon, TrashIcon } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { useJobs, useResume, useResumes } from "@/lib/queries";
import { trackerKeys, useInterviewSessions, useQuestionBank, useStories } from "@/lib/tracker";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { Dialog } from "../ui/Dialog";
import { btn, card, field, label } from "../ui/styles";

const TABS = [
  { id: "practice", label: "Mock interview" },
  { id: "bank", label: "Question bank" },
  { id: "stories", label: "STAR stories" },
] as const;

const FAMILY_LABEL: Record<string, string> = {
  general: "Any role",
  software: "Software",
  data: "Data",
  design: "Design",
  product: "Product",
  sales: "Sales",
  marketing: "Marketing",
  operations: "Operations",
  finance: "Finance",
};

/** Interview prep: AI mock interviews with feedback, a curated question bank and STAR stories. */
export function InterviewPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [gate, setGate] = useState<Gate | null>(null);
  const tab = TABS.find((t) => t.id === params.get("tab"))?.id ?? "practice";
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-stone-50">
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Interview prep</h1>
            <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-stone-200 text-sm font-medium">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.replace(`/interview?tab=${t.id}`)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${t.id === tab ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="mt-6">
              {tab === "practice" && <Practice onGate={setGate} initialRole={params.get("role") ?? ""} initialJobId={params.get("jobId") ?? ""} />}
              {tab === "bank" && <Bank />}
              {tab === "stories" && <Stories onGate={setGate} />}
            </div>
          </main>
          <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
        </div>
      )}
    </RequireAuth>
  );
}

function Bank() {
  const [family, setFamily] = useState("general");
  const [seniority, setSeniority] = useState("mid");
  const [competency, setCompetency] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const bank = useQuestionBank(family, seniority);
  const questions = (bank.data?.questions ?? []).filter((q) => !competency || q.competency === competency);
  const competencies = [...new Set((bank.data?.questions ?? []).map((q) => q.competency))].sort();
  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} flex flex-wrap gap-3 p-3`}>
        <label className="min-w-40 flex-1 text-xs font-medium text-stone-600">
          Role
          <select className={`${field} mt-1`} value={family} onChange={(e) => (setFamily(e.target.value), setCompetency(""))}>
            {(bank.data?.families ?? Object.keys(FAMILY_LABEL)).map((f) => (
              <option key={f} value={f}>
                {FAMILY_LABEL[f] ?? f}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-32 flex-1 text-xs font-medium text-stone-600">
          Level
          <select className={`${field} mt-1`} value={seniority} onChange={(e) => setSeniority(e.target.value)}>
            {SENIORITIES.map((s) => (
              <option key={s} value={s}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-40 flex-1 text-xs font-medium text-stone-600">
          Skill
          <select className={`${field} mt-1`} value={competency} onChange={(e) => setCompetency(e.target.value)}>
            <option value="">All</option>
            {competencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Questions">
        {questions.map((q) => (
          <li key={q.id} className={`${card} overflow-hidden`}>
            <button type="button" aria-expanded={open === q.id} className="flex w-full items-start gap-3 px-4 py-3 text-left" onClick={() => setOpen(open === q.id ? null : q.id)}>
              <span className="flex-1 text-sm font-medium text-stone-900">{q.question}</span>
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">{q.competency}</span>
            </button>
            {open === q.id && (
              <div className="border-t border-stone-100 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                <span className="font-semibold text-stone-900">A strong answer: </span>
                {q.answer}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Practice({ onGate, initialRole, initialJobId }: { onGate: (g: Gate) => void; initialRole: string; initialJobId: string }) {
  const sessions = useInterviewSessions();
  const [active, setActive] = useState<string | null>(null);
  const [starting, setStarting] = useState(Boolean(initialRole));
  const session = sessions.data?.find((s) => s.id === active);
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="flex flex-col gap-2">
        <button type="button" className={`${btn.primary} w-full`} onClick={() => (setActive(null), setStarting(true))}>
          <PlusIcon className="size-4" /> New mock interview
        </button>
        <ul className="flex flex-col gap-1.5">
          {sessions.data?.map((s) => {
            const sum = sessionSummary(s.answers);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => (setActive(s.id), setStarting(false))}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${active === s.id ? "border-brand/40 bg-brand/[0.04]" : "border-stone-200 bg-white hover:border-stone-300"}`}
                >
                  <div className="truncate font-semibold text-stone-900">{s.role}</div>
                  <div className="text-xs text-stone-500">
                    {new Date(s.createdAt).toLocaleDateString()} · {sum.answered}/{s.questions.length} answered
                    {sum.answered > 0 && ` · ${sum.overall.toFixed(1)}/5`}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      {starting || !session ? (
        <StartForm initialRole={initialRole} initialJobId={initialJobId} onGate={onGate} onStarted={(id) => (setActive(id), setStarting(false))} />
      ) : (
        <SessionView key={session.id} session={session} onGate={onGate} />
      )}
    </div>
  );
}

function StartForm({ initialRole, initialJobId, onGate, onStarted }: { initialRole: string; initialJobId: string; onGate: (g: Gate) => void; onStarted: (id: string) => void }) {
  const qc = useQueryClient();
  const { call } = useAiCall();
  const jobs = useJobs();
  const [role, setRole] = useState(initialRole);
  const [seniority, setSeniority] = useState("mid");
  const [jobId, setJobId] = useState(initialJobId);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const out = await call<{ session: InterviewSessionDto }>("/interviews/sessions", { role: role.trim(), seniority, count, ...(jobId ? { jobId } : {}) });
      qc.setQueryData<InterviewSessionDto[]>(trackerKeys.sessions, (list) => [out.session, ...(list ?? [])]);
      onStarted(out.session.id);
    } catch (err) {
      const gate = gateForError(err);
      if (gate) onGate(gate);
      else setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={start} className={`${card} flex flex-col gap-4 p-5 sm:p-6`}>
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Practise out loud</h2>
        <p className="text-sm text-stone-600">Answer each question by typing or speaking. You get a score and an improved answer after each one.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="m-role">
            Role
          </label>
          <input id="m-role" required className={field} value={role} maxLength={120} placeholder="e.g. Frontend developer" onChange={(e) => setRole(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="m-level">
            Level
          </label>
          <select id="m-level" className={field} value={seniority} onChange={(e) => setSeniority(e.target.value)}>
            {SENIORITIES.map((s) => (
              <option key={s} value={s}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="m-count">
            Questions
          </label>
          <select id="m-count" className={field} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[3, 6, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="m-job">
            For a saved job (optional)
          </label>
          <select id="m-job" className={field} value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">No specific job</option>
            {jobs.data?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
                {j.company ? ` — ${j.company}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className={`${btn.primary} self-start`} disabled={busy || !role.trim()}>
        {busy ? "Preparing questions…" : "✦ Start interview"}
      </button>
    </form>
  );
}

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
};

/** Dictation with the browser's speech recognition, where available (Chrome, Edge, Safari). */
function useDictation(onText: (text: string) => void) {
  const rec = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is only known after mount
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
    return () => rec.current?.stop();
  }, []);
  function toggle() {
    if (listening) return rec.current?.stop();
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i]!.isFinal) onText(e.results[i]![0].transcript.trim());
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }
  return { supported, listening, toggle };
}

function Score({ name, value }: { name: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200">
      <div className="text-[11px] font-medium text-stone-500">{name}</div>
      <div className="text-lg font-semibold tabular-nums text-stone-900">
        {value.toFixed(value % 1 ? 1 : 0)}
        <span className="text-xs font-normal text-stone-400">/5</span>
      </div>
    </div>
  );
}

function SessionView({ session, onGate }: { session: InterviewSessionDto; onGate: (g: Gate) => void }) {
  const qc = useQueryClient();
  const { call } = useAiCall();
  const firstOpen = session.questions.findIndex((_, i) => !session.answers.some((a) => a.index === i));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const answered = session.answers.find((a) => a.index === index);
  const [draft, setDraft] = useState(answered?.answer ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dictation = useDictation((t) => setDraft((d) => (d ? `${d} ${t}` : t)));
  const q = session.questions[index]!;
  const summary = sessionSummary(session.answers);

  const remove = useMutation({
    mutationFn: () => api.delete(`/interviews/sessions/${session.id}`),
    onSuccess: () => qc.setQueryData<InterviewSessionDto[]>(trackerKeys.sessions, (list) => list?.filter((s) => s.id !== session.id)),
  });

  function go(i: number) {
    setIndex(i);
    setDraft(session.answers.find((a) => a.index === i)?.answer ?? "");
    setError("");
  }

  async function submit() {
    if (!draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const out = await call<{ session: InterviewSessionDto }>(`/interviews/sessions/${session.id}/answer`, { index, answer: draft.trim() });
      qc.setQueryData<InterviewSessionDto[]>(trackerKeys.sessions, (list) => list?.map((s) => (s.id === session.id ? out.session : s)));
    } catch (e) {
      const gate = gateForError(e);
      if (gate) onGate(gate);
      else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(q.question));
  };

  return (
    <section className={`${card} flex flex-col gap-5 p-5 sm:p-6`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-stone-900">{session.role}</h2>
          <p className="text-sm text-stone-500">
            {session.seniority && `${session.seniority[0]!.toUpperCase()}${session.seniority.slice(1)} level · `}
            {summary.answered} of {session.questions.length} answered
          </p>
        </div>
        <button type="button" className={btn.ghost} aria-label="Delete interview" onClick={() => window.confirm("Delete this interview?") && remove.mutate()}>
          <TrashIcon className="size-4" />
        </button>
      </div>

      {summary.answered > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Score name="Overall" value={summary.overall} />
          <Score name="Structure" value={summary.structure} />
          <Score name="Relevance" value={summary.relevance} />
          <Score name="Clarity" value={summary.clarity} />
        </div>
      )}

      <ol className="flex flex-wrap gap-1.5" aria-label="Questions">
        {session.questions.map((_, i) => {
          const done = session.answers.some((a) => a.index === i);
          return (
            <li key={i}>
              <button
                type="button"
                aria-current={i === index ? "step" : undefined}
                onClick={() => go(i)}
                className={`size-8 rounded-full text-xs font-semibold ring-1 ${i === index ? "bg-stone-900 text-white ring-stone-900" : done ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-stone-600 ring-stone-200"}`}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {q.competency}
          <button type="button" className="ml-auto normal-case text-brand hover:underline" onClick={speak}>
            Read aloud
          </button>
        </div>
        <p className="text-base font-medium text-stone-900" data-testid="question">
          {q.question}
        </p>
        {q.tip && <p className="mt-1 text-sm text-stone-500">Tip: {q.tip}</p>}
      </div>

      <div>
        <label className={label} htmlFor="answer">
          Your answer
        </label>
        <textarea id="answer" rows={7} className={field} value={draft} maxLength={6000} onChange={(e) => setDraft(e.target.value)} placeholder="Situation, task, what you did, and the result…" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {dictation.supported && (
            <button type="button" className={dictation.listening ? btn.danger : btn.secondary} onClick={dictation.toggle} aria-pressed={dictation.listening}>
              {dictation.listening ? "■ Stop recording" : "● Speak your answer"}
            </button>
          )}
          <button type="button" className={btn.primary} disabled={busy || !draft.trim()} onClick={() => void submit()}>
            {busy ? "Scoring…" : answered ? "✦ Score again" : "✦ Get feedback"}
          </button>
          {index < session.questions.length - 1 && (
            <button type="button" className={`${btn.ghost} ml-auto`} onClick={() => go(index + 1)}>
              Next question →
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {answered && (
        <div className="flex flex-col gap-3 rounded-xl bg-brand/[0.03] p-4 ring-1 ring-brand/15" data-testid="feedback">
          <div className="grid grid-cols-3 gap-2">
            <Score name="Structure" value={answered.scores.structure} />
            <Score name="Relevance" value={answered.scores.relevance} />
            <Score name="Clarity" value={answered.scores.clarity} />
          </div>
          <p className="text-sm text-stone-700">{answered.feedback}</p>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">A stronger version</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-stone-800">{answered.improved}</p>
          </div>
        </div>
      )}
    </section>
  );
}

const EMPTY_STORY: StarStoryBodyDto = { title: "", situation: "", task: "", action: "", result: "", sourceBullet: "", tags: [] };

function Stories({ onGate }: { onGate: (g: Gate) => void }) {
  const stories = useStories();
  const [editing, setEditing] = useState<{ id: string | null; body: StarStoryBodyDto } | null>(null);
  const [fromBullet, setFromBullet] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-stone-600">Turn your best CV achievements into ready-to-tell stories: Situation, Task, Action, Result.</p>
        <button type="button" className={btn.secondary} onClick={() => setEditing({ id: null, body: EMPTY_STORY })}>
          <PlusIcon className="size-4" /> Blank story
        </button>
        <button type="button" className={btn.primary} onClick={() => setFromBullet(true)}>
          ✦ From a CV line
        </button>
      </div>
      {stories.data?.length === 0 && <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">No stories yet.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {stories.data?.map((s) => (
          <li key={s.id}>
            <button type="button" className={`${card} block h-full w-full p-4 text-left hover:border-stone-300`} onClick={() => setEditing({ id: s.id, body: toBody(s) })}>
              <h3 className="font-semibold text-stone-900">{s.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-stone-600">{[s.situation, s.action, s.result].filter(Boolean).join(" ")}</p>
            </button>
          </li>
        ))}
      </ul>
      {editing && <StoryEditor initial={editing} onClose={() => setEditing(null)} onGate={onGate} />}
      {fromBullet && (
        <BulletPicker
          onClose={() => setFromBullet(false)}
          onGate={onGate}
          onDraft={(body) => {
            setFromBullet(false);
            setEditing({ id: null, body });
          }}
        />
      )}
    </div>
  );
}

const toBody = ({ id: _i, createdAt: _c, updatedAt: _u, ...body }: StarStoryDto): StarStoryBodyDto => body;

function StoryEditor({ initial, onClose, onGate }: { initial: { id: string | null; body: StarStoryBodyDto }; onClose: () => void; onGate: (g: Gate) => void }) {
  const qc = useQueryClient();
  const [s, setS] = useState(initial.body);
  const done = () => {
    void qc.invalidateQueries({ queryKey: trackerKeys.stories });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => (initial.id ? api.patch(`/interviews/stories/${initial.id}`, s) : api.post("/interviews/stories", s)),
    onSuccess: done,
    onError: (e) => {
      const gate = gateForError(e);
      if (gate) {
        onClose();
        onGate(gate);
      }
    },
  });
  const remove = useMutation({ mutationFn: () => api.delete(`/interviews/stories/${initial.id}`), onSuccess: done });
  const part = (key: "situation" | "task" | "action" | "result", title: string, hint: string) => (
    <div>
      <label className={label} htmlFor={`s-${key}`}>
        {title}
      </label>
      <textarea id={`s-${key}`} rows={3} className={field} placeholder={hint} value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
    </div>
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={initial.id ? "Edit story" : "New STAR story"}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          {initial.id ? (
            <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline" onClick={() => window.confirm("Delete this story?") && remove.mutate()}>
              <TrashIcon className="size-4" /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className={btn.ghost} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={btn.primary} disabled={!s.title.trim() || save.isPending} onClick={() => save.mutate()}>
              Save story
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className={label} htmlFor="s-title">
            Title
          </label>
          <input id="s-title" className={field} value={s.title} maxLength={160} placeholder="e.g. Halved page load time" onChange={(e) => setS({ ...s, title: e.target.value })} />
        </div>
        {part("situation", "Situation", "Where and when; what was the challenge?")}
        {part("task", "Task", "What were you responsible for?")}
        {part("action", "Action", "What did you do, step by step?")}
        {part("result", "Result", "What changed? Use numbers where you can.")}
        {save.error && !gateForError(save.error) && <p className="text-sm text-red-600">{save.error.message}</p>}
      </div>
    </Dialog>
  );
}

function BulletPicker({ onClose, onGate, onDraft }: { onClose: () => void; onGate: (g: Gate) => void; onDraft: (b: StarStoryBodyDto) => void }) {
  const resumes = useResumes();
  const { call } = useAiCall();
  const [resumeId, setResumeId] = useState("");
  const chosen = resumeId || resumes.data?.items[0]?.id || "";
  const resume = useResume(chosen, Boolean(chosen));
  const lines = useMemo(() => {
    if (!resume.data) return null;
    const cv = normalizeCV(resume.data.data);
    return cv.experience.flatMap((e) => clean(e.bullets).map((b) => ({ bullet: b, role: e.role, company: e.company })));
  }, [resume.data]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function draft(l: { bullet: string; role: string; company: string }) {
    setBusy(l.bullet);
    setError("");
    try {
      const out = await call<{ situation: string; task: string; action: string; result: string }>("/interviews/stories/from-bullet", l);
      onDraft({ ...EMPTY_STORY, title: l.bullet.split(/\s+/).slice(0, 8).join(" ").replace(/[,.;]$/, ""), situation: out.situation, task: out.task, action: out.action, result: out.result, sourceBullet: l.bullet });
    } catch (e) {
      const gate = gateForError(e);
      if (gate) {
        onClose();
        onGate(gate);
      } else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Pick an achievement from your CV" size="lg">
      <div className="flex flex-col gap-3">
        <select aria-label="CV" className={field} value={chosen} onChange={(e) => setResumeId(e.target.value)}>
          {resumes.data?.items.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        {lines === null ? (
          <p className="py-4 text-center text-sm text-stone-500">Loading…</p>
        ) : lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-500">This CV has no experience lines yet.</p>
        ) : (
          <ul className="flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto">
            {lines.map((l) => (
              <li key={`${l.company}-${l.bullet}`}>
                <button type="button" disabled={busy !== null} onClick={() => void draft(l)} className="w-full rounded-lg px-3 py-2 text-left text-sm ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-60">
                  <span className="text-stone-900">{l.bullet}</span>
                  <span className="block text-xs text-stone-500">
                    {busy === l.bullet ? "Writing the story…" : [l.role, l.company].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
