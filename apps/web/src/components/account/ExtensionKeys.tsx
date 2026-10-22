"use client";

import type { ApiTokenDto, CreatedApiTokenDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { CopyIcon, TrashIcon } from "@cvb/ui";
import { api } from "@/lib/api";
import { btn, field } from "../ui/styles";
import { Section } from "./AccountLayout";

const KEY = ["api-tokens"] as const;

/** Personal access keys for the browser extension: shown once, revocable any time. */
export function ExtensionKeys() {
  const qc = useQueryClient();
  const tokens = useQuery({ queryKey: KEY, queryFn: () => api.get<ApiTokenDto[]>("/tokens") });
  const [name, setName] = useState("Chrome on this computer");
  const [created, setCreated] = useState<CreatedApiTokenDto | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () => api.post<CreatedApiTokenDto>("/tokens", { name: name.trim() || "Browser extension" }),
    onSuccess: (t) => {
      setCreated(t);
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/tokens/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Section
      title="Browser extension"
      description="Save jobs from LinkedIn, Indeed, Rozee.pk, Bayt and other job sites, see your match score and fill application forms. Create a key and paste it into the extension's settings."
    >
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input aria-label="Key name" className={`${field} min-w-48 flex-1`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className={btn.secondary} disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create key"}
        </button>
      </form>
      {create.error && <p className="mt-2 text-sm text-red-600">{create.error.message}</p>}
      {created && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <p className="text-sm font-medium text-amber-900">Copy this key now. It won&apos;t be shown again.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={created.token} className={`${field} font-mono text-xs`} onFocus={(e) => e.target.select()} aria-label="New key" />
            <button
              type="button"
              className={btn.secondary}
              onClick={() => void navigator.clipboard.writeText(created.token).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
            >
              <CopyIcon className="size-4" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {(tokens.data?.length ?? 0) > 0 && (
        <ul className="mt-4 divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
          {tokens.data!.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900">{t.name}</div>
                <div className="text-xs text-stone-500">
                  <span className="font-mono">{t.prefix}…</span> · created {new Date(t.createdAt).toLocaleDateString()} ·{" "}
                  {t.lastUsedAt ? `last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : "never used"}
                </div>
              </div>
              <button type="button" className={btn.ghost} aria-label={`Delete key ${t.name}`} onClick={() => window.confirm("Delete this key? The extension using it will stop working.") && remove.mutate(t.id)}>
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
