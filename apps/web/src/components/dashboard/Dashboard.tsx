"use client";

import type { MeDto, ResumeDto, ResumeImportDto, ResumeSummary } from "@cvb/contracts";
import { IMPORT_MAX_BYTES } from "@cvb/contracts";
import { normalizeCV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { isTemplateId } from "@cvb/templates/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CopyIcon, MoreIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from "@cvb/ui";
import { track } from "@/lib/analytics";
import { api, isApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useCatalog } from "@/lib/catalog";
import { migrateGuestCv, discardGuestCv } from "@/lib/guest-migration";
import { paperSizeAttr } from "@/lib/page";
import { PLAN_LABEL, type Gate } from "@/lib/plans";
import { keys, useImports, useResume, useResumes, useTrash } from "@/lib/queries";
import { UpgradeDialog } from "../UpgradeDialog";
import { btn, card } from "../ui/styles";

/** "My CVs": every CV in the account, imports in progress, and the trash. */
export function Dashboard({ me }: { me: MeDto }) {
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const resumes = useResumes();
  const imports = useImports();
  const [gate, setGate] = useState<Gate | null>(null);
  const [notice, setNotice] = useState("");
  const [migration, setMigration] = useState<"idle" | "blocked">("idle");
  const [showTrash, setShowTrash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [openedAt] = useState(Date.now);

  const refresh = () => qc.invalidateQueries({ queryKey: keys.resumes });
  const list = resumes.data?.items ?? [];
  const limit = me.limits.resumes;
  const atLimit = limit !== null && list.length >= limit;

  // Bring along the CV built in this browser before signing in.
  useEffect(() => {
    void migrateGuestCv()
      .then((r) => {
        if (r.kind === "moved") {
          setNotice("The CV from this browser is now saved in your account.");
          void refresh();
        } else if (r.kind === "blocked") setMigration("blocked");
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const onPlanError = (e: Error) => {
    if (isApiError(e, "PLAN_REQUIRED")) setGate({ kind: "feature", feature: "resume.multiple" });
    else setNotice(e.message);
  };

  const create = useMutation({
    mutationFn: () => api.post<ResumeDto>("/resumes", { title: "Untitled CV" }),
    onSuccess: (r) => {
      track("cv_started", { source: "dashboard" });
      router.push(`/edit/${r.id}`);
    },
    onError: onPlanError,
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<ResumeImportDto>("/imports", form);
    },
    onSuccess: () => {
      track("import_started");
      void qc.invalidateQueries({ queryKey: keys.imports });
    },
    onError: onPlanError,
  });

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) return setNotice("That file is larger than 5 MB.");
    if (atLimit) return setGate({ kind: "feature", feature: "resume.multiple" });
    upload.mutate(file);
  }

  const recentImports = (imports.data ?? []).filter((i) => openedAt - new Date(i.createdAt).getTime() < 24 * 3600 * 1000).slice(0, 4);
  const wantsImport = params.get("import") === "1";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      {!me.emailVerified && <VerifyBanner email={me.email} />}
      {migration === "blocked" && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <span className="flex-1">
            You have a CV in this browser too, but the {PLAN_LABEL[me.plan]} plan keeps one CV. Upgrade to keep both, or discard the browser copy.
          </span>
          <Link href="/pricing?plan=standard" className="font-semibold hover:underline">
            Upgrade
          </Link>
          <button
            type="button"
            className="font-semibold hover:underline"
            onClick={() => {
              discardGuestCv();
              setMigration("idle");
            }}
          >
            Discard browser copy
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">My CVs</h1>
          <p className="mt-1 text-sm text-stone-600">
            {list.length} {list.length === 1 ? "CV" : "CVs"}
            {limit !== null && <> · your {PLAN_LABEL[me.plan]} plan keeps {limit}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btn.secondary} disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            <UploadIcon className="size-4" /> {upload.isPending ? "Uploading…" : "Upload PDF or Word"}
          </button>
          <button
            type="button"
            className={btn.primary}
            disabled={create.isPending}
            onClick={() => (atLimit ? setGate({ kind: "feature", feature: "resume.multiple" }) : create.mutate())}
          >
            <PlusIcon className="size-4" /> New CV
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {recentImports.length > 0 && (
        <section className="mt-6 flex flex-col gap-2">
          {recentImports.map((i) => (
            <ImportRow key={i.id} item={i} />
          ))}
        </section>
      )}

      {resumes.isLoading ? (
        <p className="py-16 text-center text-sm text-stone-500">Loading your CVs…</p>
      ) : list.length === 0 ? (
        <EmptyState onCreate={() => create.mutate()} onUpload={() => fileRef.current?.click()} highlightUpload={wantsImport} onDrop={pickFile} />
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list
            .filter((r) => !r.baseResumeId || !list.some((b) => b.id === r.baseResumeId))
            .map((r) => (
              <ResumeCard
                key={r.id}
                resume={r}
                copies={list.filter((c) => c.baseResumeId === r.id)}
                onChanged={refresh}
                onError={onPlanError}
                onNotice={setNotice}
              />
            ))}
          {wantsImport && <DropZone onFile={pickFile} />}
        </ul>
      )}

      <section className="mt-12">
        <button type="button" className="text-sm font-medium text-stone-500 hover:text-stone-800" onClick={() => setShowTrash((v) => !v)}>
          {showTrash ? "Hide" : "Show"} trash
        </button>
        {showTrash && <Trash onRestored={refresh} onError={onPlanError} />}
      </section>

      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}
    </main>
  );
}

function VerifyBanner({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
      <span className="flex-1">Please confirm your email address, {email}, so you can recover your account.</span>
      <button
        type="button"
        disabled={sent}
        className="font-semibold hover:underline disabled:opacity-60"
        onClick={() => void authClient.sendVerificationEmail({ email, callbackURL: "/app" }).then(() => setSent(true))}
      >
        {sent ? "Email sent" : "Resend email"}
      </button>
    </div>
  );
}

function ResumeCard({
  resume,
  copies = [],
  onChanged,
  onError,
  onNotice,
}: {
  resume: ResumeSummary;
  /** Tailored copies made from this CV, shown under it. */
  copies?: ResumeSummary[];
  onChanged: () => void;
  onError: (e: Error) => void;
  onNotice: (s: string) => void;
}) {
  const full = useResume(resume.id);
  const catalog = useCatalog();
  const menu = useRef<HTMLDetailsElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(resume.title);
  const template = isTemplateId(resume.templateId) ? resume.templateId : "classic";
  const meta = catalog.meta(template);

  const rename = useMutation({
    mutationFn: (t: string) => api.patch<ResumeDto>(`/resumes/${resume.id}`, { title: t }),
    onSuccess: onChanged,
    onError,
  });
  const duplicate = useMutation({
    mutationFn: () => api.post<ResumeDto>(`/resumes/${resume.id}/duplicate`),
    onSuccess: () => {
      onNotice("CV duplicated");
      onChanged();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/resumes/${resume.id}`),
    onSuccess: () => {
      onNotice("Moved to trash. You can restore it for 30 days.");
      onChanged();
    },
    onError,
  });

  const close = () => menu.current?.removeAttribute("open");
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100";

  return (
    <li className={`${card} group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg`}>
      <Link href={`/edit/${resume.id}`} className="relative block h-56 overflow-hidden border-b border-stone-100 bg-stone-100" aria-label={`Open ${resume.title}`}>
        <div className="absolute left-1/2 top-4 w-[210mm] origin-top -translate-x-1/2 scale-[0.3] shadow-md">
          {full.data && (
            <div className="paper" data-size={paperSizeAttr(resume.pageSize)}>
              <CVDocument cv={normalizeCV(full.data.data)} template={template} accent={resume.accent} />
            </div>
          )}
        </div>
      </Link>
      <div className="flex items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setRenaming(false);
                if (title.trim() && title.trim() !== resume.title) rename.mutate(title.trim());
              }}
            >
              <input
                autoFocus
                aria-label="CV name"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                className="w-full rounded px-1 text-[15px] font-semibold outline-none ring-2 ring-brand"
              />
            </form>
          ) : (
            <Link href={`/edit/${resume.id}`} className="block truncate text-[15px] font-semibold text-stone-900 hover:text-brand">
              {resume.title}
            </Link>
          )}
          <p className="mt-0.5 truncate text-xs text-stone-500">
            {meta.name} · {resume.pageSize === "LETTER" ? "Letter" : "A4"} · edited {timeAgo(resume.updatedAt)}
          </p>
        </div>
        <details ref={menu} className="relative [&_summary::-webkit-details-marker]:hidden">
          <summary aria-label="CV actions" className="grid size-8 cursor-pointer list-none place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <MoreIcon className="size-5" />
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
            <button type="button" className={item} onClick={() => { close(); setTitle(resume.title); setRenaming(true); }}>
              <PencilIcon className="size-4" /> Rename
            </button>
            <button type="button" className={item} onClick={() => { close(); duplicate.mutate(); }}>
              <CopyIcon className="size-4" /> Duplicate
            </button>
            <button type="button" className={`${item} !text-red-600`} onClick={() => { close(); remove.mutate(); }}>
              <TrashIcon className="size-4" /> Delete
            </button>
          </div>
        </details>
      </div>
      {copies.length > 0 && (
        <div className="border-t border-stone-100 px-4 py-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Tailored copies</div>
          <ul className="flex flex-col gap-1">
            {copies.map((c) => (
              <li key={c.id}>
                <Link href={`/edit/${c.id}`} className="block truncate text-sm text-stone-700 hover:text-brand">
                  ↳ {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function ImportRow({ item }: { item: ResumeImportDto }) {
  const working = item.status === "queued" || item.status === "processing";
  return (
    <div className={`${card} flex flex-wrap items-center gap-3 px-4 py-3 text-sm`}>
      <span className={`size-2 rounded-full ${working ? "animate-pulse bg-amber-400" : item.status === "done" ? "bg-emerald-500" : "bg-red-500"}`} />
      <span className="min-w-0 flex-1 truncate">
        <strong className="font-semibold text-stone-800">{item.fileName}</strong>{" "}
        <span className="text-stone-500">
          {working ? "· reading your CV…" : item.status === "done" ? `· ready${item.warnings.length ? `, ${item.warnings.length} things to check` : ""}` : `· ${item.error ?? "couldn't be read"}`}
        </span>
      </span>
      {item.status === "done" && item.resumeId && (
        <Link href={`/edit/${item.resumeId}?import=${item.id}`} className="font-semibold text-brand hover:underline">
          Review and edit →
        </Link>
      )}
    </div>
  );
}

function EmptyState({ onCreate, onUpload, onDrop, highlightUpload }: { onCreate: () => void; onUpload: () => void; onDrop: (f: File | undefined) => void; highlightUpload: boolean }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <button type="button" onClick={onCreate} className={`${card} flex flex-col items-start gap-2 p-6 text-left transition hover:shadow-md`}>
        <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
          <PlusIcon className="size-5" />
        </span>
        <span className="text-base font-semibold text-stone-900">Start a new CV</span>
        <span className="text-sm text-stone-600">Answer a few short steps and watch it take shape.</span>
      </button>
      <DropZone onFile={onDrop} onClick={onUpload} highlight={highlightUpload} big />
    </div>
  );
}

function DropZone({ onFile, onClick, highlight = true, big = false }: { onFile: (f: File | undefined) => void; onClick?: () => void; highlight?: boolean; big?: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-start gap-2 rounded-2xl border-2 border-dashed p-6 text-left transition ${
        over ? "border-brand bg-brand/5" : highlight ? "border-brand/40 bg-white" : "border-stone-300 bg-white"
      } ${big ? "" : "min-h-56 justify-center"}`}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-stone-100 text-stone-700">
        <UploadIcon className="size-5" />
      </span>
      <span className="text-base font-semibold text-stone-900">Upload your current CV</span>
      <span className="text-sm text-stone-600">Drop a PDF or Word file (up to 5 MB). We fill in the steps for you to check. A LinkedIn &quot;Save to PDF&quot; works too.</span>
    </div>
  );
}

function Trash({ onRestored, onError }: { onRestored: () => void; onError: (e: Error) => void }) {
  const qc = useQueryClient();
  const trash = useTrash();
  const restore = useMutation({
    mutationFn: (id: string) => api.post<ResumeDto>(`/resumes/${id}/restore`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.trash });
      onRestored();
    },
    onError,
  });
  const items = trash.data ?? [];
  return (
    <div className={`${card} mt-3 divide-y divide-stone-100`}>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-stone-500">Trash is empty. Deleted CVs stay here for 30 days.</p>
      ) : (
        items.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-stone-800">{r.title}</span>
            <span className="text-xs text-stone-500">deleted {timeAgo(r.updatedAt)}</span>
            <button type="button" className={btn.ghost} onClick={() => restore.mutate(r.id)}>
              Restore
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}
