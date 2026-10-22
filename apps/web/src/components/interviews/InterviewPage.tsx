"use client";

import type { InterviewSessionDto, StarStoryBodyDto, StarStoryDto } from "@cvb/contracts";
import { SENIORITIES, clean, normalizeCV, sessionSummary } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, EmptyState, Icon, IconButton, PageHeader, ProgressBar, ScoreRing, Select, Skeleton, Spinner, Tabs, TextArea, TextField } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { useJobs, useResume, useResumes } from "@/lib/queries";
import { trackerKeys, useInterviewSessions, useQuestionBank, useStories } from "@/lib/tracker";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { Dialog } from "../ui/Dialog";

const TABS = [
  { id: "practice", label: "Mock interview", icon: "mic" },
  { id: "bank", label: "Question bank", icon: "list" },
  { id: "stories", label: "STAR stories", icon: "star" },
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
  const [gate, setGate] = useState<Gate | null>(null);
  const tab = TABS.find((t) => t.id === params.get("tab"))?.id ?? "practice";
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <main className="mx-auto flex max-w-(--layout-md) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
            <PageHeader title="Interview prep" />
            <Tabs label="Interview prep" value={tab} className="-mt-2" items={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon, href: `/interview?tab=${t.id}` }))} />
            <div>
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
      <div className="cvb-card flex flex-wrap gap-3 p-4">
        <Select label="Role" className="min-w-40 flex-1" value={family} onChange={(e) => (setFamily(e.target.value), setCompetency(""))} options={(bank.data?.families ?? Object.keys(FAMILY_LABEL)).map((f) => ({ value: f, label: FAMILY_LABEL[f] ?? f }))} />
        <Select label="Level" className="min-w-32 flex-1" value={seniority} onChange={(e) => setSeniority(e.target.value)} options={SENIORITIES.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))} />
        <Select label="Skill" className="min-w-40 flex-1" value={competency} onChange={(e) => setCompetency(e.target.value)} options={[{ value: "", label: "All" }, ...competencies.map((c) => ({ value: c, label: c }))]} />
      </div>
      {bank.isLoading && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={52} shape="block" />
          ))}
        </div>
      )}
      <ul className="flex flex-col gap-2" aria-label="Questions">
        {questions.map((q) => (
          <li key={q.id} className="cvb-card overflow-hidden">
            <button type="button" aria-expanded={open === q.id} className="flex w-full items-start gap-3 px-5 py-4 text-start hover:bg-surface-2" onClick={() => setOpen(open === q.id ? null : q.id)}>
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{q.question}</span>
              <Badge className="shrink-0">{q.competency}</Badge>
              <Icon name={open === q.id ? "chevron-up" : "chevron-down"} size={16} className="mt-0.5 shrink-0 text-ink-3" />
            </button>
            {open === q.id && (
              <div className="border-t border-line bg-surface-2 px-5 py-4 text-sm leading-relaxed text-ink-2">
                <span className="font-semibold text-ink">A strong answer: </span>
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
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <aside className="flex min-w-0 flex-col gap-3">
        <Button icon="plus" block onClick={() => (setActive(null), setStarting(true))}>
          New mock interview
        </Button>
        <ul className="flex flex-col gap-2" aria-label="Your mock interviews">
          {sessions.data?.map((s) => {
            const sum = sessionSummary(s.answers);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => (setActive(s.id), setStarting(false))}
                  aria-current={active === s.id || undefined}
                  className={`w-full rounded-lg border px-4 py-3 text-start text-sm transition-colors ${active === s.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong"}`}
                >
                  <span className="block truncate font-semibold text-ink">{s.role}</span>
                  <span className="cvb-caption cvb-num block">
                    {new Date(s.createdAt).toLocaleDateString()} · {sum.answered}/{s.questions.length} answered
                    {sum.answered > 0 && ` · ${sum.overall.toFixed(1)}/5`}
                  </span>
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
    <form onSubmit={start} className="cvb-card flex min-w-0 flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="cvb-h2">Practise out loud</h2>
        <p className="text-sm text-ink-3">Answer each question by typing or speaking. You get a score and an improved answer after each one.</p>
      </div>
      <TextField id="m-role" label="Role" required value={role} maxLength={120} placeholder="e.g. Frontend developer" onChange={(e) => setRole(e.target.value)} />
      <div className="cvb-field-row">
        <Select id="m-level" label="Level" value={seniority} onChange={(e) => setSeniority(e.target.value)} options={SENIORITIES.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))} />
        <Select id="m-count" label="Questions" value={count} onChange={(e) => setCount(Number(e.target.value))} options={[3, 6, 10, 15].map((n) => ({ value: String(n), label: String(n) }))} />
      </div>
      <Select id="m-job" label="For a saved job" optional value={jobId} onChange={(e) => setJobId(e.target.value)}>
        <option value="">No specific job</option>
        {jobs.data?.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title}
            {j.company ? ` — ${j.company}` : ""}
          </option>
        ))}
      </Select>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" variant="primary" icon="sparkle" className="self-start" disabled={!role.trim()} loading={busy}>
        {busy ? "Preparing questions…" : "Start interview"}
      </Button>
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
  return <ProgressBar label={name} value={value} max={5} valueLabel={`${value.toFixed(value % 1 ? 1 : 0)}/5`} tone={value >= 4 ? "success" : value >= 2.5 ? "brand" : "warning"} />;
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
    <section className="cvb-card flex min-w-0 flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="cvb-h2">{session.role}</h2>
          <p className="text-sm text-ink-3">
            {session.seniority && `${session.seniority[0]!.toUpperCase()}${session.seniority.slice(1)} level · `}
            <span className="cvb-num">
              {summary.answered} of {session.questions.length}
            </span>{" "}
            answered
          </p>
        </div>
        <IconButton icon="trash" label="Delete interview" onClick={() => window.confirm("Delete this interview?") && remove.mutate()} />
      </div>

      {summary.answered > 0 && (
        <div className="flex flex-wrap items-center gap-5 rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex items-center gap-3">
            <ScoreRing value={(summary.overall / 5) * 100} label={`Overall ${summary.overall.toFixed(1)} out of 5`}>
              <span className="cvb-num">{summary.overall.toFixed(1)}</span>
            </ScoreRing>
            <span className="cvb-overline">Overall</span>
          </div>
          <div className="grid min-w-48 flex-1 gap-2">
            <Score name="Structure" value={summary.structure} />
            <Score name="Relevance" value={summary.relevance} />
            <Score name="Clarity" value={summary.clarity} />
          </div>
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
                className={`cvb-num grid size-8 place-items-center rounded-full border text-xs font-semibold transition-colors focus-visible:shadow-(--focus-ring) focus-visible:outline-none ${i === index ? "border-brand bg-brand text-on-brand" : done ? "border-success bg-success-soft text-success" : "border-line-control bg-surface text-ink-2 hover:border-ink-3"}`}
              >
                {i + 1}
                {done && <span className="sr-only"> (answered)</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2 p-4">
        <div className="flex items-center gap-2">
          <span className="cvb-overline">{q.competency}</span>
          <Button variant="link" size="sm" className="ms-auto" onClick={speak}>
            Read aloud
          </Button>
        </div>
        <p className="cvb-h3 text-ink" data-testid="question">
          {q.question}
        </p>
        {q.tip && (
          <p className="flex gap-1.5 text-sm text-ink-3">
            <Icon name="lightbulb" size={16} className="mt-0.5 shrink-0" /> Tip: {q.tip}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <TextArea id="answer" label="Your answer" rows={7} value={draft} maxLength={6000} onChange={(e) => setDraft(e.target.value)} placeholder="Situation, task, what you did, and the result…" />
        <div className="flex flex-wrap items-center gap-2">
          {dictation.supported && (
            <Button variant={dictation.listening ? "danger" : "secondary"} icon={dictation.listening ? "x-circle" : "mic"} onClick={dictation.toggle} aria-pressed={dictation.listening}>
              {dictation.listening ? "Stop recording" : "Speak your answer"}
            </Button>
          )}
          <Button variant="primary" icon="sparkle" disabled={!draft.trim()} loading={busy} onClick={() => void submit()}>
            {busy ? "Scoring…" : answered ? "Score again" : "Get feedback"}
          </Button>
          {index < session.questions.length - 1 && (
            <Button variant="ghost" iconEnd="arrow-right" className="ms-auto" onClick={() => go(index + 1)}>
              Next question
            </Button>
          )}
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      {answered && (
        <section className="cvb-ai" data-testid="feedback" aria-label="Feedback">
          <div className="cvb-ai-head">
            <Icon name="sparkle" size={18} />
            <span>Feedback</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Score name="Structure" value={answered.scores.structure} />
            <Score name="Relevance" value={answered.scores.relevance} />
            <Score name="Clarity" value={answered.scores.clarity} />
          </div>
          <p className="m-0 text-sm text-ink-2">{answered.feedback}</p>
          <div className="cvb-ai-option flex-col gap-1.5">
            <h3 className="cvb-overline">A stronger version</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{answered.improved}</p>
          </div>
        </section>
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
        <p className="min-w-60 flex-1 text-sm text-ink-3">Turn your best CV achievements into ready-to-tell stories: Situation, Task, Action, Result.</p>
        <Button icon="plus" onClick={() => setEditing({ id: null, body: EMPTY_STORY })}>
          Blank story
        </Button>
        <Button variant="primary" icon="sparkle" onClick={() => setFromBullet(true)}>
          From a CV line
        </Button>
      </div>
      {stories.data?.length === 0 && (
        <Card>
          <EmptyState icon="star" title="No stories yet" />
        </Card>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {stories.data?.map((s) => (
          <li key={s.id}>
            <button type="button" className="cvb-card cvb-card-interactive flex h-full w-full flex-col gap-1 p-5 text-start" onClick={() => setEditing({ id: s.id, body: toBody(s) })}>
              <h3 className="cvb-h3">{s.title}</h3>
              <p className="line-clamp-3 text-sm text-ink-2">{[s.situation, s.action, s.result].filter(Boolean).join(" ")}</p>
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
    <TextArea id={`s-${key}`} label={title} rows={3} placeholder={hint} value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={initial.id ? "Edit story" : "New STAR story"}
      size="lg"
      footer={
        <>
          {initial.id && (
            <Button variant="ghost" icon="trash" className="me-auto text-danger" onClick={() => window.confirm("Delete this story?") && remove.mutate()}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!s.title.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            Save story
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField id="s-title" label="Title" value={s.title} maxLength={160} placeholder="e.g. Halved page load time" onChange={(e) => setS({ ...s, title: e.target.value })} />
        {part("situation", "Situation", "Where and when; what was the challenge?")}
        {part("task", "Task", "What were you responsible for?")}
        {part("action", "Action", "What did you do, step by step?")}
        {part("result", "Result", "What changed? Use numbers where you can.")}
        {save.error && !gateForError(save.error) && <Alert tone="danger">{save.error.message}</Alert>}
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
        <Select aria-label="CV" value={chosen} onChange={(e) => setResumeId(e.target.value)} options={resumes.data?.items.map((r) => ({ value: r.id, label: r.title })) ?? []} />
        {lines === null ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-3">This CV has no experience lines yet.</p>
        ) : (
          <ul className="flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto">
            {lines.map((l) => (
              <li key={`${l.company}-${l.bullet}`}>
                <button type="button" disabled={busy !== null} onClick={() => void draft(l)} className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-start text-sm transition-colors hover:border-brand hover:bg-brand-soft disabled:opacity-60">
                  <span className="text-ink">{l.bullet}</span>
                  <span className="cvb-caption mt-0.5 flex items-center gap-1.5">
                    {busy === l.bullet && <Spinner />}
                    {busy === l.bullet ? "Writing the story…" : [l.role, l.company].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
