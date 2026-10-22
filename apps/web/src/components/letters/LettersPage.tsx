"use client";

import type { CoverLetterDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlusIcon, TrashIcon } from "@cvb/ui";
import { gateForError } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { keys, useLetters } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { btn, card } from "../ui/styles";

export function LettersPage() {
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-stone-50">
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
    onSuccess: (l) => router.push(`/letters/${l.id}`),
    onError: (e) => setGate(gateForError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/cover-letters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.letters }),
  });
  const list = letters.data ?? [];
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Cover letters</h1>
          <p className="mt-1 text-sm text-stone-600">Styled to match your CV. Start one from a saved job to get an AI first draft.</p>
        </div>
        <button type="button" className={btn.primary} disabled={create.isPending} onClick={() => create.mutate()}>
          <PlusIcon className="size-4" /> New letter
        </button>
      </div>
      {letters.isLoading ? (
        <p className="py-16 text-center text-sm text-stone-500">Loading…</p>
      ) : list.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center text-sm text-stone-600">
          No letters yet. Open <Link href="/jobs" className="font-semibold text-brand hover:underline">Jobs</Link>, pick a job and choose “Cover letter”, or start a blank one.
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((l) => (
            <li key={l.id} className={`${card} flex flex-col gap-2 p-4`}>
              <Link href={`/letters/${l.id}`} className="text-[15px] font-semibold text-stone-900 hover:text-brand">
                {l.title}
              </Link>
              <p className="line-clamp-3 text-sm text-stone-600">{l.data.paragraphs.find((p) => p.trim()) || "Empty letter"}</p>
              <div className="mt-auto flex items-center justify-between pt-2 text-xs text-stone-500">
                <span>
                  Edited {new Date(l.updatedAt).toLocaleDateString()}
                  {l.shareEnabled && <> · shared · {l.viewCount} views</>}
                </span>
                <button type="button" aria-label="Delete letter" className="rounded p-1 hover:bg-stone-100 hover:text-red-600" onClick={() => window.confirm("Delete this letter?") && remove.mutate(l.id)}>
                  <TrashIcon className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
    </main>
  );
}
