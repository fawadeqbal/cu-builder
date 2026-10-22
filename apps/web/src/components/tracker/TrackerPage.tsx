"use client";

import type { ApplicationDto, BoardDto, MeDto } from "@cvb/contracts";
import { LIMITS, can, columnKey } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { PlusIcon, TrashIcon } from "@cvb/ui";
import { gateForError } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { useJobs, useResumes } from "@/lib/queries";
import { trackerKeys, useApplications, useBoard, usePreferences, useUpdateApplication } from "@/lib/tracker";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { Dialog } from "../ui/Dialog";
import { btn, card, field, label } from "../ui/styles";
import { ApplicationDrawer } from "./ApplicationDrawer";
import { CalendarView } from "./CalendarView";
import { OffersView } from "./OffersView";

const VIEWS = [
  { id: "board", label: "Board" },
  { id: "list", label: "List" },
  { id: "calendar", label: "Calendar" },
  { id: "offers", label: "Offers" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

/** The application tracker: a board you drag cards across, a list, a calendar and offer comparison. */
export function TrackerPage() {
  return <RequireAuth>{(me) => <Tracker me={me} />}</RequireAuth>;
}

function Tracker({ me }: { me: MeDto }) {
  const params = useSearchParams();
  const router = useRouter();
  const view = (VIEWS.find((v) => v.id === params.get("view"))?.id ?? "board") as View;
  const openId = params.get("app");
  const board = useBoard();
  const apps = useApplications();
  const [gate, setGate] = useState<Gate | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingColumns, setEditingColumns] = useState(false);
  const [search, setSearch] = useState("");
  const columns = board.data?.columns ?? [];
  const all = apps.data ?? [];
  const needle = search.trim().toLowerCase();
  const list = needle
    ? all.filter((a) => [a.job.title, a.job.company, a.job.location, a.notes, ...a.contacts.map((c) => c.name)].join(" ").toLowerCase().includes(needle))
    : all;
  const open = all.find((a) => a.id === openId) ?? null;
  const limited = !can(me.plan, "tracker.unlimited");

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`/tracker${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="mx-auto max-w-[90rem] px-4 pb-20 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Applications</h1>
            <p className="text-sm text-stone-500">
              {all.length} active
              {limited && ` of ${LIMITS[me.plan].trackedJobs} on the Free plan`}
            </p>
          </div>
          <input type="search" aria-label="Search applications" placeholder="Search…" className={`${field} w-44`} value={search} onChange={(e) => setSearch(e.target.value)} />
          <WeeklyEmailToggle />
          <button type="button" className={btn.secondary} onClick={() => setEditingColumns(true)}>
            Edit columns
          </button>
          <button type="button" className={btn.primary} onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" /> Add application
          </button>
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-stone-200 text-sm font-medium" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-current={v.id === view ? "page" : undefined}
              onClick={() => go({ view: v.id === "board" ? null : v.id })}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${v.id === view ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
            >
              {v.label}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {board.isLoading || apps.isLoading ? (
            <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
          ) : all.length === 0 && view !== "calendar" ? (
            <Empty onAdd={() => setAdding(true)} />
          ) : view === "board" ? (
            <BoardView columns={columns} apps={list} onOpen={(id) => go({ app: id })} />
          ) : view === "list" ? (
            <ListView columns={columns} apps={list} onOpen={(id) => go({ app: id })} />
          ) : view === "calendar" ? (
            <CalendarView apps={list} onOpen={(id) => go({ app: id })} />
          ) : (
            <OffersView apps={list} me={me} onOpen={(id) => go({ app: id })} />
          )}
        </div>
      </main>

      <AddApplication open={adding} onClose={() => setAdding(false)} onGate={setGate} onCreated={(id) => go({ app: id })} firstColumn={columns[0]?.key} />
      {board.data && editingColumns && <ColumnsEditor open onClose={() => setEditingColumns(false)} board={board.data} />}
      {open && <ApplicationDrawer key={open.id} app={open} columns={columns} onClose={() => go({ app: null })} onGate={setGate} />}
      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
    </div>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  const router = useRouter();
  return (
    <div className={`${card} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
      <h2 className="text-lg font-semibold text-stone-900">Track every application in one place</h2>
      <p className="max-w-md text-sm text-stone-600">
        Add the jobs you&apos;re applying for, drag them from Saved to Offer, keep contacts and notes, and get reminders to follow up.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={btn.primary} onClick={onAdd}>
          <PlusIcon className="size-4" /> Add application
        </button>
        <button type="button" className={btn.secondary} onClick={() => router.push("/jobs?tab=feed")}>
          Find jobs
        </button>
      </div>
    </div>
  );
}

function WeeklyEmailToggle() {
  const qc = useQueryClient();
  const prefs = usePreferences();
  const save = useMutation({
    mutationFn: (weeklyDigest: boolean) => api.put("/feed/preferences", { ...prefs.data, weeklyDigest }),
    onSuccess: () => qc.invalidateQueries({ queryKey: trackerKeys.prefs }),
  });
  if (!prefs.data) return null;
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600" title="A Monday email with your progress and the week's interviews and deadlines">
      <input type="checkbox" className="size-4 accent-brand" checked={prefs.data.weeklyDigest} onChange={(e) => save.mutate(e.target.checked)} />
      Weekly email
    </label>
  );
}

/** Moves a card, optimistically; the server places it between the given neighbours. */
function useMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: { id: string; status: string; beforeId: string | null; afterId: string | null }) =>
      api.post<ApplicationDto>(`/applications/${m.id}/move`, { status: m.status, beforeId: m.beforeId, afterId: m.afterId }),
    onMutate: (m) => {
      const key = trackerKeys.applications(false);
      const previous = qc.getQueryData<ApplicationDto[]>(key);
      qc.setQueryData<ApplicationDto[]>(key, (list) => {
        if (!list) return list;
        const pos = (id: string | null) => list.find((a) => a.id === id)?.position ?? null;
        const before = pos(m.beforeId);
        const after = pos(m.afterId);
        const position = before !== null && after !== null ? (before + after) / 2 : before !== null ? before + 1000 : after !== null ? after - 1000 : Date.now();
        return list.map((a) => (a.id === m.id ? { ...a, status: m.status, position } : a));
      });
      return { previous };
    },
    onError: (_e, _m, ctx) => ctx?.previous && qc.setQueryData(trackerKeys.applications(false), ctx.previous),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: trackerKeys.applications(false) });
      void qc.invalidateQueries({ queryKey: ["tracker", "reminders"] });
    },
  });
}

function BoardView({ columns, apps, onOpen }: { columns: BoardDto["columns"]; apps: ApplicationDto[]; onOpen: (id: string) => void }) {
  const move = useMove();
  const [now] = useState(() => Date.now());
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ column: string; index: number } | null>(null);
  const byColumn = useMemo(() => {
    const map = new Map<string, ApplicationDto[]>(columns.map((c) => [c.key, []]));
    for (const a of apps) (map.get(a.status) ?? map.get(columns[0]!.key))!.push(a);
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [apps, columns]);

  function drop(column: string, index: number) {
    if (!dragging) return;
    const list = (byColumn.get(column) ?? []).filter((a) => a.id !== dragging);
    move.mutate({ id: dragging, status: column, beforeId: list[index - 1]?.id ?? null, afterId: list[index]?.id ?? null });
    setDragging(null);
    setOver(null);
  }

  function moveTo(app: ApplicationDto, column: string) {
    const list = (byColumn.get(column) ?? []).filter((a) => a.id !== app.id);
    move.mutate({ id: app.id, status: column, beforeId: list.at(-1)?.id ?? null, afterId: null });
  }

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6" data-testid="board">
      {columns.map((c) => {
        const list = byColumn.get(c.key) ?? [];
        return (
          <section
            key={c.key}
            aria-label={c.label}
            data-column={c.key}
            className={`flex w-72 shrink-0 flex-col rounded-2xl bg-stone-100/80 p-2 ring-1 transition ${over?.column === c.key ? "ring-brand/50" : "ring-stone-200"}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (over?.column !== c.key) setOver({ column: c.key, index: list.length });
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(c.key, over?.column === c.key ? over.index : list.length);
            }}
          >
            <header className="flex items-center justify-between px-2 py-1.5">
              <h2 className="text-sm font-semibold text-stone-800">{c.label}</h2>
              <span className="rounded-full bg-white px-2 text-xs font-semibold tabular-nums text-stone-500 ring-1 ring-stone-200">{list.length}</span>
            </header>
            <ol className="flex min-h-16 flex-col gap-2">
              {list.map((a, i) => (
                <li
                  key={a.id}
                  draggable
                  onDragStart={(e: DragEvent) => {
                    setDragging(a.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", a.id);
                  }}
                  onDragEnd={() => (setDragging(null), setOver(null))}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    const index = e.clientY < r.top + r.height / 2 ? i : i + 1;
                    if (over?.column !== c.key || over.index !== index) setOver({ column: c.key, index });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(c.key, over?.column === c.key ? over.index : i);
                  }}
                  className={`group relative ${dragging === a.id ? "opacity-40" : ""}`}
                >
                  {over?.column === c.key && over.index === i && dragging && dragging !== a.id && <div className="absolute -top-1.5 left-1 right-1 h-0.5 rounded bg-brand" />}
                  <Card app={a} now={now} columns={columns} onOpen={() => onOpen(a.id)} onMove={(col) => moveTo(a, col)} />
                </li>
              ))}
              {over?.column === c.key && over.index === list.length && dragging && <li aria-hidden className="mx-1 h-0.5 rounded bg-brand" />}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function Card({ app, now, columns, onOpen, onMove }: { app: ApplicationDto; now: number; columns: BoardDto["columns"]; onOpen: () => void; onMove: (column: string) => void }) {
  const soon = app.interviewAt && new Date(app.interviewAt).getTime() > now ? app.interviewAt : null;
  return (
    <div className="cursor-grab rounded-xl bg-white p-3 shadow-xs ring-1 ring-stone-200 transition hover:ring-stone-300 active:cursor-grabbing">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="line-clamp-2 text-sm font-semibold text-stone-900">{app.job.title}</div>
        <div className="truncate text-xs text-stone-500">{[app.job.company, app.job.location].filter(Boolean).join(" · ") || "No company"}</div>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
        {soon && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 ring-1 ring-violet-200">Interview {shortDate(soon)}</span>}
        {app.deadlineAt && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">Due {shortDate(app.deadlineAt)}</span>}
        {app.shareLinkId && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{app.linkViews} CV views</span>}
        {app.offer && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">Offer details</span>}
        <label className="ml-auto opacity-70 focus-within:opacity-100 group-hover:opacity-100">
          <span className="sr-only">Move {app.job.title} to</span>
          <select className="max-w-24 rounded-md bg-transparent py-0.5 text-[11px] text-stone-500 hover:bg-stone-100" value={app.status} onChange={(e) => onMove(e.target.value)}>
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function ListView({ columns, apps, onOpen }: { columns: BoardDto["columns"]; apps: ApplicationDto[]; onOpen: (id: string) => void }) {
  const update = useUpdateApplication();
  const [archived, setArchived] = useState(false);
  const old = useApplications(true);
  const rows = archived ? (old.data ?? []) : apps;
  const label = (key: string) => columns.find((c) => c.key === key)?.label ?? key;
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-end border-b border-stone-100 px-4 py-2">
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" className="size-4 accent-brand" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2.5">Job</th>
              <th className="px-4 py-2.5">Stage</th>
              <th className="px-4 py-2.5">Applied</th>
              <th className="px-4 py-2.5">Interview</th>
              <th className="px-4 py-2.5">CV views</th>
              <th className="px-4 py-2.5">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-stone-50/60">
                <td className="px-4 py-2.5">
                  <button type="button" className="text-left" onClick={() => onOpen(a.id)}>
                    <div className="font-medium text-stone-900 hover:underline">{a.job.title}</div>
                    <div className="text-xs text-stone-500">{a.job.company}</div>
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  {archived ? (
                    <span className="text-stone-600">{label(a.status)}</span>
                  ) : (
                    <select aria-label={`Stage of ${a.job.title}`} className={`${field} py-1`} value={a.status} onChange={(e) => update.mutate({ id: a.id, patch: { status: e.target.value } })}>
                      {columns.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-2.5 text-stone-600">{shortDate(a.appliedAt)}</td>
                <td className="px-4 py-2.5 text-stone-600">{shortDate(a.interviewAt)}</td>
                <td className="px-4 py-2.5 tabular-nums text-stone-600">{a.shareLinkId ? a.linkViews : "—"}</td>
                <td className="px-4 py-2.5 text-stone-500">{shortDate(a.updatedAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddApplication({
  open,
  onClose,
  onGate,
  onCreated,
  firstColumn,
}: {
  open: boolean;
  onClose: () => void;
  onGate: (g: Gate) => void;
  onCreated: (id: string) => void;
  firstColumn?: string;
}) {
  const qc = useQueryClient();
  const jobs = useJobs(open);
  const resumes = useResumes(open);
  const [jobId, setJobId] = useState("new");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post<ApplicationDto>("/applications", {
        ...(jobId === "new" ? { job: { title: title.trim(), company: company.trim(), ...(url.trim() ? { url: url.trim() } : {}) } } : { jobId }),
        ...(resumeId ? { resumeId } : {}),
        ...(firstColumn ? { status: firstColumn } : {}),
      }),
    onSuccess: (app) => {
      void qc.invalidateQueries({ queryKey: trackerKeys.all });
      setTitle("");
      setCompany("");
      setUrl("");
      onClose();
      onCreated(app.id);
    },
    onError: (e) => {
      const gate = gateForError(e);
      if (gate) {
        onClose();
        onGate(gate.kind === "feature" ? { kind: "feature", feature: "tracker.unlimited" } : gate);
      } else setError(e.message);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    create.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add an application" size="md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={label} htmlFor="app-job">
            Job
          </label>
          <select id="app-job" className={field} value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="new">A new job…</option>
            {jobs.data?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
                {j.company ? ` — ${j.company}` : ""}
              </option>
            ))}
          </select>
        </div>
        {jobId === "new" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="app-title">
                Job title
              </label>
              <input id="app-title" required className={field} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="app-company">
                Company
              </label>
              <input id="app-company" className={field} value={company} maxLength={200} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="app-url">
                Posting link (optional)
              </label>
              <input id="app-url" type="url" className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
            </div>
          </div>
        )}
        <div>
          <label className={label} htmlFor="app-cv">
            CV you&apos;re sending (optional)
          </label>
          <select id="app-cv" className={field} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
            <option value="">Choose later</option>
            {resumes.data?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ColumnsEditor({ open, onClose, board }: { open: boolean; onClose: () => void; board: BoardDto }) {
  const qc = useQueryClient();
  const [cols, setCols] = useState(board.columns);
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: () => api.put<BoardDto>("/tracker/board", { columns: cols }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: trackerKeys.all });
      onClose();
    },
  });
  const swap = (i: number, j: number) =>
    setCols((c) => {
      if (j < 0 || j >= c.length) return c;
      const next = [...c];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Board columns"
      description="Rename, reorder, add or remove stages. Cards in a removed column move to the first one."
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={save.isPending || cols.length === 0} onClick={() => save.mutate()}>
            Save
          </button>
        </div>
      }
    >
      <ol className="flex flex-col gap-2">
        {cols.map((c, i) => (
          <li key={c.key} className="flex items-center gap-2">
            <input
              aria-label={`Column ${i + 1} name`}
              className={field}
              value={c.label}
              maxLength={40}
              onChange={(e) => setCols((all) => all.map((x) => (x.key === c.key ? { ...x, label: e.target.value } : x)))}
            />
            <button type="button" className={btn.ghost} aria-label="Move up" onClick={() => swap(i, i - 1)}>
              ↑
            </button>
            <button type="button" className={btn.ghost} aria-label="Move down" onClick={() => swap(i, i + 1)}>
              ↓
            </button>
            <button type="button" className={btn.ghost} aria-label={`Remove ${c.label}`} disabled={cols.length === 1} onClick={() => setCols((all) => all.filter((x) => x.key !== c.key))}>
              <TrashIcon className="size-4" />
            </button>
          </li>
        ))}
      </ol>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || cols.length >= 12) return;
          setCols((all) => [...all, { key: columnKey(name, all.map((x) => x.key)), label: name.trim() }]);
          setName("");
        }}
      >
        <input aria-label="New column name" className={field} value={name} maxLength={40} placeholder="New column, e.g. Phone screen" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className={btn.secondary}>
          Add
        </button>
      </form>
    </Dialog>
  );
}
