"use client";

import type { CoverLetterDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, EmptyState, IconButton, PageHeader, Skeleton } from "@cvb/ui";
import { gateForError } from "@/lib/ai";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import type { Gate } from "@/lib/plans";
import { keys, useLetters } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";

export function LettersPage() {
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <Letters />
        </div>
      )}
    </RequireAuth>
  );
}

function Letters() {
  const qc = useQueryClient();
  const router = useRouter();
  const letters = useLetters();
  const [gate, setGate] = useState<Gate | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<CoverLetterDto>("/cover-letters", {}),
    onSuccess: (l) => {
      track("cover_letter_created", { from: "letters" });
      router.push(`/letters/${l.id}`);
    },
    onError: (e) => setGate(gateForError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/cover-letters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.letters }),
  });
  const list = letters.data ?? [];
  return (
    <main className="mx-auto flex max-w-(--layout-md) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
      <PageHeader
        title="Cover letters"
        description="Styled to match your CV. Start one from a saved job to get an AI first draft."
        actions={
          <Button variant="primary" icon="plus" loading={create.isPending} onClick={() => create.mutate()}>
            New letter
          </Button>
        }
      />
      {letters.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={148} shape="block" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="cvb-card">
          <EmptyState icon="mail" title="No letters yet">
            Open{" "}
            <Link href="/jobs?tab=saved" className="font-semibold text-brand-ink hover:underline">
              Jobs
            </Link>
            , pick a job and choose “Cover letter”, or start a blank one.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Your cover letters">
          {list.map((l) => (
            <li key={l.id} className="cvb-card relative flex flex-col gap-2 p-5 transition-colors hover:border-line-strong">
              <Link href={`/letters/${l.id}`} className="cvb-h3 text-ink after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:text-brand-ink focus-visible:outline-none focus-visible:after:shadow-(--focus-ring)">
                {l.title}
              </Link>
              <p className="line-clamp-3 text-sm text-ink-2">{l.data.paragraphs.find((p) => p.trim()) || "Empty letter"}</p>
              {l.shareEnabled && (
                <span>
                  <Badge tone="info" icon="link">
                    Shared · <span className="cvb-num">{l.viewCount}</span> views
                  </Badge>
                </span>
              )}
              <div className="mt-auto flex items-center gap-2 pt-1">
                <span className="cvb-caption flex-1">Edited {new Date(l.updatedAt).toLocaleDateString()}</span>
                <span className="relative z-10">
                  <IconButton icon="trash" size="sm" label="Delete letter" onClick={() => window.confirm("Delete this letter?") && remove.mutate(l.id)} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
    </main>
  );
}
