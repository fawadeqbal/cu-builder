"use client";

import type { MeDto, ResumeDto, ResumeImportDto, ResumeSummary } from "@cvb/contracts";
import { IMPORT_ACCEPT, IMPORT_MAX_BYTES, importLimitFor } from "@cvb/contracts";
import { normalizeCV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { isTemplateId } from "@cvb/templates/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dropdown,
  EmptyState,
  FileDrop,
  Icon,
  IconButton,
  PageHeader,
  Skeleton,
  TextField,
  Toast,
  type MenuItem,
} from "@cvb/ui";
import { track } from "@/lib/analytics";
import { api, isApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useCatalog } from "@/lib/catalog";
import { migrateGuestCv, discardGuestCv } from "@/lib/guest-migration";
import { paperSizeAttr } from "@/lib/page";
import { PLAN_LABEL, type Gate } from "@/lib/plans";
import { keys, useImports, useResume, useResumes, useTrash } from "@/lib/queries";
import { UpgradeDialog } from "../UpgradeDialog";
import { LinkedInImportHelp } from "./LinkedInImportHelp";
import { useT } from "@/lib/i18n";

/** "My CVs": every CV in the account, imports in progress, and the trash. */
export function Dashboard({ me }: { me: MeDto }) {
  const t = useT();
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
          setNotice(t("dash.migrated"));
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
    if (file.size > importLimitFor(file.name)) return setNotice(t(importLimitFor(file.name) > IMPORT_MAX_BYTES ? "dash.tooLargeZip" : "dash.tooLarge"));
    if (atLimit) return setGate({ kind: "feature", feature: "resume.multiple" });
    upload.mutate(file);
  }

  const recentImports = (imports.data ?? [])
    .filter((i) => openedAt - new Date(i.createdAt).getTime() < 24 * 3600 * 1000)
    .slice(0, 4);
  const wantsImport = params.get("import") === "1";

  const visible = list.filter((r) => !r.baseResumeId || !list.some((b) => b.id === r.baseResumeId));

  return (
    <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
      <PageHeader
        title={t("dash.title")}
        description={
          <>
            {list.length} {list.length === 1 ? "CV" : "CVs"}
            {limit !== null && (
              <>
                {" "}
                · your {PLAN_LABEL[me.plan]} plan keeps {limit}
              </>
            )}
          </>
        }
        actions={
          <>
            <Button icon="upload" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              {upload.isPending ? t("dash.uploading") : t("dash.upload")}
            </Button>
            <Button
              icon="sparkle"
              title="Answer a few questions and AI writes your CV from them"
              onClick={() => (atLimit ? setGate({ kind: "feature", feature: "resume.multiple" }) : router.push("/new"))}
            >
              Write with AI
            </Button>
            <Button
              variant="primary"
              icon="plus"
              disabled={create.isPending}
              onClick={() => (atLimit ? setGate({ kind: "feature", feature: "resume.multiple" }) : create.mutate())}
            >
              New CV
            </Button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={IMPORT_ACCEPT}
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!me.emailVerified && <VerifyBanner email={me.email} />}
      {migration === "blocked" && (
        <Alert
          tone="warning"
          actions={
            <>
              <Button size="sm" variant="highlight" icon="sparkle" href="/pricing?plan=standard">
                Upgrade
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  discardGuestCv();
                  setMigration("idle");
                }}
              >
                Discard browser copy
              </Button>
            </>
          }
        >
          You have a CV in this browser too, but the {PLAN_LABEL[me.plan]} plan keeps one CV. Upgrade to keep both, or
          discard the browser copy.
        </Alert>
      )}

      {recentImports.length > 0 && (
        <section className="flex flex-col gap-2">
          {recentImports.map((i) => (
            <ImportRow key={i.id} item={i} />
          ))}
        </section>
      )}

      {resumes.isLoading ? (
        <div
          className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
          role="status"
          aria-label={t("dash.loading")}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="cvb-card flex flex-col gap-3 overflow-hidden pb-4">
              <Skeleton height={224} shape="block" className="rounded-none" />
              <div className="flex flex-col gap-2 px-4">
                <Skeleton width="70%" height={14} />
                <Skeleton width="45%" height={10} />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyCvs onCreate={() => create.mutate()} highlightUpload={wantsImport} onDrop={pickFile} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((r) => (
            <ResumeCard
              key={r.id}
              resume={r}
              copies={list.filter((c) => c.baseResumeId === r.id)}
              onChanged={refresh}
              onError={onPlanError}
              onNotice={setNotice}
            />
          ))}
          {wantsImport && (
            <li className="flex">
              <UploadDrop onFile={pickFile} className="flex-1 justify-center border-brand" />
            </li>
          )}
        </ul>
      )}

      <section className="mt-6 flex flex-col items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          iconEnd={showTrash ? "chevron-up" : "chevron-down"}
          aria-expanded={showTrash}
          onClick={() => setShowTrash((v) => !v)}
        >
          {showTrash ? "Hide" : "Show"} trash
        </Button>
        {showTrash && <Trash onRestored={refresh} onError={onPlanError} />}
      </section>

      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto">
            <Toast>{notice}</Toast>
          </div>
        </div>
      )}
    </main>
  );
}

function VerifyBanner({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  return (
    <Alert
      tone="info"
      icon="mail"
      actions={
        <Button
          size="sm"
          variant="secondary"
          icon={sent ? "check" : undefined}
          disabled={sent}
          onClick={() =>
            void authClient.sendVerificationEmail({ email, callbackURL: "/app" }).then(() => setSent(true))
          }
        >
          {sent ? "Email sent" : "Resend email"}
        </Button>
      }
    >
      Please confirm your email address, <span dir="ltr">{email}</span>, so you can recover your account.
    </Alert>
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
  const t = useT();
  const full = useResume(resume.id);
  const catalog = useCatalog();
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
      onNotice(t("dash.movedToTrash"));
      onChanged();
    },
    onError,
  });

  const actions: MenuItem[] = [
    {
      label: "Rename",
      icon: "edit",
      onSelect: () => {
        setTitle(resume.title);
        setRenaming(true);
      },
    },
    { label: "Duplicate", icon: "copy", onSelect: () => duplicate.mutate() },
    "separator",
    { label: "Delete", icon: "trash", danger: true, onSelect: () => remove.mutate() },
  ];

  return (
    <li className="cvb-card flex flex-col transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-sm">
      {/* The sheet is a picture of the CV: its own links stay out of reach, and one link on top opens the editor. */}
      <div className="relative h-56 overflow-hidden rounded-t-lg border-b border-line bg-surface-3">
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center" aria-hidden="true" inert>
          <div className="w-[210mm] shrink-0 origin-top scale-[0.3] shadow-md">
            {full.data && (
              <div className="paper" data-size={paperSizeAttr(resume.pageSize)}>
                <CVDocument cv={normalizeCV(full.data.data)} template={template} accent={resume.accent} />
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/edit/${resume.id}`}
          className="absolute inset-0 rounded-t-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          aria-label={`Open ${resume.title}`}
        />
      </div>
      <div className="flex items-start gap-2 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {renaming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setRenaming(false);
                if (title.trim() && title.trim() !== resume.title) rename.mutate(title.trim());
              }}
            >
              <TextField
                size="sm"
                inputClassName="py-1"
                autoFocus
                aria-label="CV name"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              />
            </form>
          ) : (
            <Link
              href={`/edit/${resume.id}`}
              className="cvb-h3 block truncate text-ink hover:text-brand-ink hover:underline"
            >
              {resume.title}
            </Link>
          )}
          <p className="cvb-caption truncate">
            {meta.name} · {resume.pageSize === "LETTER" ? "Letter" : "A4"} · edited {timeAgo(resume.updatedAt)}
          </p>
        </div>
        <Dropdown
          label="CV actions"
          items={actions}
          trigger={(p) => (
            <IconButton
              icon="more"
              label="CV actions"
              tooltip={false}
              onClick={p.toggle}
              aria-expanded={p["aria-expanded"]}
              aria-haspopup="menu"
            />
          )}
        />
      </div>
      {copies.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3">
          <div className="cvb-overline">{t("dash.tailored")}</div>
          <ul className="flex flex-col gap-1">
            {copies.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/edit/${c.id}`}
                  className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-brand-ink hover:underline"
                >
                  <Icon name="file" size={16} className="shrink-0 text-ink-3" />
                  <span className="truncate">{c.title}</span>
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
    <div className="cvb-card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      {working ? (
        <span className="cvb-spinner" aria-hidden="true" />
      ) : item.status === "done" ? (
        <Icon name="check-circle" size={18} className="text-success" />
      ) : (
        <Icon name="x-circle" size={18} className="text-danger" />
      )}
      <span className="min-w-0 flex-1 truncate">
        <strong className="font-semibold text-ink">{item.fileName}</strong>{" "}
        <span className="text-ink-3">
          {working
            ? "· reading your CV…"
            : item.status === "done"
              ? `· ready${item.warnings.length ? `, ${item.warnings.length} things to check` : ""}`
              : `· ${item.error ?? "couldn't be read"}`}
        </span>
      </span>
      {item.status === "done" && item.resumeId && (
        <Button variant="link" size="sm" iconEnd="arrow-right" href={`/edit/${item.resumeId}?import=${item.id}`}>
          Review and edit
        </Button>
      )}
    </div>
  );
}

function EmptyCvs({
  onCreate,
  onDrop,
  highlightUpload,
}: {
  onCreate: () => void;
  onDrop: (f: File | undefined) => void;
  highlightUpload: boolean;
}) {
  const t = useT();
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
      <div className="cvb-card flex flex-col justify-center">
        <EmptyState
          icon="file"
          title={t("dash.newCv")}
          actions={
            <Button icon="plus" onClick={onCreate}>
              New CV
            </Button>
          }
        >
          {t("dash.newCvDesc")}
        </EmptyState>
      </div>
      <UploadDrop onFile={onDrop} className={highlightUpload ? "border-brand" : undefined} />
    </div>
  );
}

function UploadDrop({ onFile, className }: { onFile: (f: File | undefined) => void; className?: string }) {
  const t = useT();
  return (
    <FileDrop
      className={className}
      title={t("dash.uploadCv")}
      hint={t("dash.uploadCvDesc")}
      button={t("dash.upload")}
      accept={IMPORT_ACCEPT}
      onFiles={(files) => onFile(files[0])}
    >
      <LinkedInImportHelp className="mt-1" />
    </FileDrop>
  );
}

function Trash({ onRestored, onError }: { onRestored: () => void; onError: (e: Error) => void }) {
  const t = useT();
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
    <div className="cvb-card w-full divide-y divide-line">
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-3">{t("dash.trashEmpty")}</p>
      ) : (
        items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.title}</span>
            <span className="cvb-caption">deleted {timeAgo(r.updatedAt)}</span>
            <Button variant="ghost" size="sm" icon="undo" onClick={() => restore.mutate(r.id)}>
              Restore
            </Button>
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
