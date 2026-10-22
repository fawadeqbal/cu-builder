"use client";

import type { ApplicationDto, BoardDto, MeDto } from "@cvb/contracts";
import { LIMITS, can, columnKey } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { Alert, Badge, ChevronDownIcon, Button, DataTable, EmptyState, IconButton, PageHeader, SearchField, SegmentedControl, Select, Skeleton, StageDot, Switch, TextField, type Column } from "@cvb/ui";
import { gateForError } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { useJobs, useResumes } from "@/lib/queries";
import { trackerKeys, useApplications, useBoard, usePreferences, useUpdateApplication } from "@/lib/tracker";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { Dialog } from "../ui/Dialog";
import { ApplicationDrawer } from "./ApplicationDrawer";
import { CalendarView } from "./CalendarView";
import { OffersView } from "./OffersView";
import { stageOf, stageVar } from "./stage";

const VIEWS = [
  { id: "board", label: "Board", icon: "kanban" },
  { id: "list", label: "List", icon: "list" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "offers", label: "Offers", icon: "award" },
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
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex max-w-(--layout-xl) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
        <PageHeader
          title="Applications"
          description={
            <>
              <span className="cvb-num">{all.length}</span> active
              {limited && ` of ${LIMITS[me.plan].trackedJobs} on the Free plan`}
            </>
          }
          actions={
            <>
              <WeeklyEmailToggle />
              <Button icon="settings" onClick={() => setEditingColumns(true)}>
                Edit columns
              </Button>
              <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
                Add application
              </Button>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl<View>
              label="Views"
              value={view}
              onChange={(v) => go({ view: v === "board" ? null : v })}
              options={VIEWS.map((v) => ({ value: v.id, label: v.label, icon: v.icon }))}
            />
          </div>
          <SearchField label="Search applications" placeholder="Search…" className="ms-auto w-full sm:w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div>
          {board.isLoading || apps.isLoading ? (
            <div className="cvb-board" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="cvb-column">
                  <Skeleton width="40%" height={14} />
                  <Skeleton height={84} shape="block" />
                  <Skeleton height={84} shape="block" />
                </div>
              ))}
            </div>
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
  return (
    <div className="cvb-card">
      <EmptyState
        icon="kanban"
        title="Track every application in one place"
        actions={
          <>
            <Button variant="primary" icon="plus" onClick={onAdd}>
              Add application
            </Button>
            <Button icon="search" href="/jobs?tab=feed">
              Find jobs
            </Button>
          </>
        }
      >
        Add the jobs you&apos;re applying for, drag them from Saved to Offer, keep contacts and notes, and get reminders to follow up.
      </EmptyState>
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
    <span className="me-2 text-sm" title="A Monday email with your progress and the week's interviews and deadlines">
      <Switch label="Weekly email" checked={prefs.data.weeklyDigest} onChange={(on) => save.mutate(on)} />
    </span>
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
    <div className="cvb-board -mx-4 px-4 pb-4 sm:-mx-6 sm:px-6" data-testid="board">
      {columns.map((c) => {
        const list = byColumn.get(c.key) ?? [];
        return (
          <section
            key={c.key}
            aria-label={c.label}
            data-column={c.key}
            data-over={over?.column === c.key ? "" : undefined}
            className="cvb-column"
            style={stageVar(c.key)}
            onDragOver={(e) => {
              e.preventDefault();
              if (over?.column !== c.key) setOver({ column: c.key, index: list.length });
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(c.key, over?.column === c.key ? over.index : list.length);
            }}
          >
            <header className="cvb-column-head">
              <span className="cvb-dot" aria-hidden="true" />
              <h2 className="min-w-0 truncate text-[13px] font-semibold">{c.label}</h2>
              <span className="cvb-column-count">{list.length}</span>
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
                  {over?.column === c.key && over.index === i && dragging && dragging !== a.id && <div className="absolute -top-1.5 start-1 end-1 h-0.5 rounded bg-brand" />}
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
    <div className="cvb-appcard active:cursor-grabbing">
      <button type="button" onClick={onOpen} className="block w-full rounded-sm text-start focus-visible:shadow-(--focus-ring) focus-visible:outline-none">
        <span className="cvb-appcard-title">{app.job.title}</span>
        <span className="cvb-appcard-sub block truncate">{[app.job.company, app.job.location].filter(Boolean).join(" · ") || "No company"}</span>
      </button>
      <div className="cvb-appcard-foot">
        {soon && (
          <Badge tone="info" icon="calendar">
            Interview {shortDate(soon)}
          </Badge>
        )}
        {app.deadlineAt && (
          <Badge tone="warning" icon="clock">
            Due {shortDate(app.deadlineAt)}
          </Badge>
        )}
        {app.shareLinkId && <Badge icon="eye">{app.linkViews} CV views</Badge>}
        {app.offer && (
          <Badge tone="success" icon="award">
            Offer details
          </Badge>
        )}
        <label className="relative ms-auto flex items-center rounded-sm text-ink-3 opacity-80 focus-within:opacity-100 group-hover:opacity-100">
          <span className="sr-only">Move {app.job.title} to</span>
          <select
            className="max-w-28 cursor-pointer appearance-none rounded-sm bg-transparent py-0.5 pe-4 ps-1 text-[11px] text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:shadow-(--focus-ring) focus-visible:outline-none"
            value={app.status}
            onChange={(e) => onMove(e.target.value)}
          >
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute end-0.5 size-3" />
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
  const cols: Column<ApplicationDto>[] = [
    {
      key: "job",
      label: "Job",
      render: (a) => (
        <button type="button" className="text-start" onClick={() => onOpen(a.id)}>
          <span className="block font-semibold text-ink hover:underline">{a.job.title}</span>
          <span className="cvb-caption block font-normal">{a.job.company}</span>
        </button>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      render: (a) =>
        archived ? (
          <span className="inline-flex items-center gap-2 text-ink-2">
            <StageDot stage={stageOf(a.status)} />
            {label(a.status)}
          </span>
        ) : (
          <Select size="sm" aria-label={`Stage of ${a.job.title}`} className="min-w-36" value={a.status} onChange={(e) => update.mutate({ id: a.id, patch: { status: e.target.value } })} options={columns.map((c) => ({ value: c.key, label: c.label }))} />
        ),
    },
    { key: "applied", label: "Applied", render: (a) => shortDate(a.appliedAt) },
    { key: "interview", label: "Interview", render: (a) => shortDate(a.interviewAt) },
    { key: "views", label: "CV views", numeric: true, render: (a) => (a.shareLinkId ? a.linkViews : "—") },
    { key: "updated", label: "Updated", render: (a) => <span className="text-ink-3">{shortDate(a.updatedAt)}</span> },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Switch label="Show archived" checked={archived} onChange={setArchived} />
      </div>
      <div className="[&_table]:min-w-[44rem]">
        <DataTable caption="Applications" columns={cols} rows={rows} rowKey={(a) => a.id} empty="Nothing here." />
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
        <Select id="app-job" label="Job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="new">A new job…</option>
          {jobs.data?.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
              {j.company ? ` — ${j.company}` : ""}
            </option>
          ))}
        </Select>
        {jobId === "new" && (
          <>
            <TextField id="app-title" label="Job title" required value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            <div className="cvb-field-row">
              <TextField id="app-company" label="Company" value={company} maxLength={200} onChange={(e) => setCompany(e.target.value)} />
              <TextField id="app-url" label="Posting link" optional type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
            </div>
          </>
        )}
        <Select id="app-cv" label="CV you're sending" optional value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
          <option value="">Choose later</option>
          {resumes.data?.items.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </Select>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon="plus" loading={create.isPending}>
            {create.isPending ? "Adding…" : "Add"}
          </Button>
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
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={cols.length === 0} loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <ol className="flex flex-col gap-2">
        {cols.map((c, i) => (
          <li key={c.key} className="flex items-center gap-1" style={stageVar(c.key)}>
            <span className="cvb-dot me-1 text-(--stage)" aria-hidden="true" />
            <TextField
              aria-label={`Column ${i + 1} name`}
              className="min-w-0 flex-1"
              value={c.label}
              maxLength={40}
              onChange={(e) => setCols((all) => all.map((x) => (x.key === c.key ? { ...x, label: e.target.value } : x)))}
            />
            <IconButton icon="chevron-up" label="Move up" disabled={i === 0} onClick={() => swap(i, i - 1)} />
            <IconButton icon="chevron-down" label="Move down" disabled={i === cols.length - 1} onClick={() => swap(i, i + 1)} />
            <IconButton icon="trash" label={`Remove ${c.label}`} disabled={cols.length === 1} onClick={() => setCols((all) => all.filter((x) => x.key !== c.key))} />
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || cols.length >= 12) return;
          setCols((all) => [...all, { key: columnKey(name, all.map((x) => x.key)), label: name.trim() }]);
          setName("");
        }}
      >
        <TextField aria-label="New column name" className="min-w-0 flex-1" value={name} maxLength={40} placeholder="New column, e.g. Phone screen" onChange={(e) => setName(e.target.value)} />
        <Button type="submit" icon="plus">
          Add
        </Button>
      </form>
    </Dialog>
  );
}
