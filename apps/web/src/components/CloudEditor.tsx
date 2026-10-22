"use client";

import type { ResumeDto, ResumeImportDto } from "@cvb/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, EmptyState, Spinner } from "@cvb/ui";
import { api, isApiError } from "@/lib/api";
import { useCloudDocument } from "@/lib/document";
import { keys, useResume } from "@/lib/queries";
import Builder from "./Builder";
import { OwnerComments } from "./comments/OwnerComments";
import { RequireAuth } from "./RequireAuth";
import { FullPageMessage } from "./ui/FullPageMessage";

/** Opens a CV from the account in the editor. */
export default function CloudEditor({ id }: { id: string }) {
  return <RequireAuth>{() => <Loaded id={id} />}</RequireAuth>;
}

function Loaded({ id }: { id: string }) {
  const resume = useResume(id);
  if (resume.isLoading)
    return (
      <FullPageMessage>
        <span className="flex items-center gap-3">
          <Spinner /> Opening your CV…
        </span>
      </FullPageMessage>
    );
  if (!resume.data) {
    const missing = isApiError(resume.error, "NOT_FOUND");
    return (
      <FullPageMessage>
        <EmptyState
          icon={missing ? "file" : "alert-triangle"}
          title={missing ? "This CV doesn't exist, or it was deleted." : "We couldn't open this CV. Please try again."}
          actions={
            <Button variant="secondary" icon="arrow-left" href="/app">
              Back to My CVs
            </Button>
          }
        />
      </FullPageMessage>
    );
  }
  // Keyed so that switching CVs starts a fresh document (its own autosave and offline queue).
  return <Editor key={id} resume={resume.data} />;
}

function Editor({ resume }: { resume: ResumeDto }) {
  const doc = useCloudDocument(resume);
  const qc = useQueryClient();
  const [title, setTitle] = useState(resume.title);

  async function rename(next: string) {
    setTitle(next);
    try {
      const saved = await api.patch<ResumeDto>(`/resumes/${resume.id}`, { title: next });
      qc.setQueryData(keys.resume(resume.id), (old: ResumeDto | undefined) => (old ? { ...old, title: saved.title } : saved));
      void qc.invalidateQueries({ queryKey: keys.resumes });
    } catch {
      setTitle(resume.title);
    }
  }

  return (
    <Builder
      doc={doc}
      cloud={{ resumeId: resume.id, title, onRename: (t) => void rename(t) }}
      banner={
        <>
          <ImportReview />
          <OwnerComments resumeId={resume.id} doc={doc} />
        </>
      }
    />
  );
}

/** After an upload: what the reader wasn't sure about, so the user checks those parts first. */
function ImportReview() {
  const params = useSearchParams();
  const router = useRouter();
  const importId = params.get("import");
  const item = useQuery({
    queryKey: ["imports", importId],
    queryFn: () => api.get<ResumeImportDto>(`/imports/${importId}`),
    enabled: Boolean(importId),
  });
  if (!importId || !item.data) return null;
  const dismiss = () => router.replace(window.location.pathname);
  return (
    <Alert
      tone="info"
      banner
      className="border-b border-line px-4 sm:px-6"
      title={`We filled in your CV from ${item.data.fileName}.`}
      actions={
        <Button variant="secondary" size="sm" onClick={dismiss}>
          Got it
        </Button>
      }
    >
      {item.data.warnings.length ? "Please check these first:" : "Go through each step to check names, dates and bullet points."}
      {item.data.warnings.length > 0 && (
        <ul className="mt-1 list-disc ps-5">
          {item.data.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
