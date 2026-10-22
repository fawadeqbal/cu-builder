"use client";

import type { ApiTokenDto, CreatedApiTokenDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Alert, Button, DataTable, IconButton, TextField } from "@cvb/ui";
import { api } from "@/lib/api";
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
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const rows = tokens.data ?? [];

  return (
    <Section
      title="Browser extension"
      description="Save jobs from LinkedIn, Indeed, Rozee.pk, Bayt and other job sites, see your match score and fill application forms. Create a key and paste it into the extension's settings."
    >
      <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
        <TextField
          aria-label="Key name"
          className="min-w-48 flex-1"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" icon="plus" loading={create.isPending}>
          {create.isPending ? "Creating…" : "Create key"}
        </Button>
      </form>
      {create.error && <Alert tone="danger">{create.error.message}</Alert>}
      {created && (
        <Alert tone="warning" title="Copy this key now. It won't be shown again.">
          <div className="mt-1 flex flex-wrap gap-2">
            <TextField
              readOnly
              value={created.token}
              className="min-w-0 flex-1"
              inputClassName="font-mono text-xs"
              dir="ltr"
              onFocus={(e) => e.target.select()}
              aria-label="New key"
            />
            <Button
              icon={copied ? "check" : "copy"}
              onClick={() =>
                void navigator.clipboard
                  .writeText(created.token)
                  .then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))
              }
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Alert>
      )}
      {rows.length > 0 && (
        <DataTable<ApiTokenDto>
          caption="Extension keys"
          rows={rows}
          rowKey={(t) => t.id}
          columns={[
            {
              key: "name",
              label: "Name",
              render: (t) => <span className="block max-w-[16rem] truncate">{t.name}</span>,
            },
            {
              key: "prefix",
              label: "Key",
              render: (t) => (
                <span className="font-mono text-[13px]" dir="ltr">
                  {t.prefix}…
                </span>
              ),
            },
            {
              key: "createdAt",
              label: "Created",
              render: (t) => <span className="whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</span>,
            },
            {
              key: "lastUsedAt",
              label: "Last used",
              render: (t) => (
                <span className="whitespace-nowrap">
                  {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : "Never used"}
                </span>
              ),
            },
            {
              key: "actions",
              label: (
                <span className="relative block">
                  <span className="cvb-sr">Actions</span>
                </span>
              ),
              width: 56,
              render: (t) => (
                <IconButton
                  icon="trash"
                  size="sm"
                  label={`Delete key ${t.name}`}
                  tooltip={false}
                  onClick={() =>
                    window.confirm("Delete this key? The extension using it will stop working.") && remove.mutate(t.id)
                  }
                />
              ),
            },
          ]}
        />
      )}
    </Section>
  );
}
