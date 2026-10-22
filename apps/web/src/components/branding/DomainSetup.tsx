"use client";

import type { DomainStatusDto } from "@cvb/contracts";
import { useState } from "react";
import { Alert, Badge, Button, TextField } from "@cvb/ui";

type Props = {
  status: DomainStatusDto;
  /** Saves (or with null, removes) the domain. */
  onSave: (domain: string | null) => Promise<unknown>;
  onVerify: () => Promise<unknown>;
  example: string;
};

/** Connect a custom domain: enter it, point DNS at us, then check. Shared by websites and partners. */
export function DomainSetup({ status, onSave, onVerify, example }: Props) {
  const [domain, setDomain] = useState(status.domain ?? "");
  const [busy, setBusy] = useState<"save" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);

  async function run(kind: "save" | "verify", fn: () => Promise<unknown>) {
    setBusy(kind);
    setError("");
    try {
      await fn();
      if (kind === "verify") setChecked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const host = status.domain ?? "";
  const apex = host.split(".").length === 2;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <TextField
          id="custom-domain"
          dir="ltr"
          label="Domain"
          className="min-w-48 flex-1"
          inputClassName="font-mono"
          placeholder={example}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
        <Button
          loading={busy === "save"}
          disabled={busy !== null || !domain.trim() || domain.trim() === host}
          onClick={() => void run("save", () => onSave(domain.trim()))}
        >
          {busy === "save" ? "Saving…" : "Connect"}
        </Button>
        {host && (
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void run("save", async () => (await onSave(null), setDomain("")))}
          >
            Remove
          </Button>
        )}
      </div>
      {host && (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-ink" dir="ltr">
              {host}
            </span>
            {status.verified ? (
              <Badge tone="success" icon="check">
                Connected
              </Badge>
            ) : (
              <Badge tone="warning" icon="clock">
                Waiting for DNS
              </Badge>
            )}
          </div>
          {!status.verified && (
            <>
              <p className="text-ink-2">
                Add this record at your domain provider, then check. DNS changes can take up to a few hours.
              </p>
              <div className="cvb-table-wrap relative">
                <table className="cvb-table" dir="ltr">
                  <caption className="cvb-sr">DNS record</caption>
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Name</th>
                      <th scope="col">Value</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px] text-ink">
                    {(!apex || status.ipv4.length === 0) && (
                      <tr>
                        <td>CNAME</td>
                        <td>{apex ? "@" : host.split(".")[0]}</td>
                        <td className="break-all">{status.cnameTarget}</td>
                      </tr>
                    )}
                    {status.ipv4.map((ip) => (
                      <tr key={ip}>
                        <td>A</td>
                        <td>{apex ? "@" : host.split(".")[0]}</td>
                        <td>{ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                className="self-start"
                icon="globe"
                loading={busy === "verify"}
                disabled={busy !== null}
                onClick={() => void run("verify", onVerify)}
              >
                {busy === "verify" ? "Checking…" : "Check DNS"}
              </Button>
              {checked && !status.verified && (
                <Alert tone="warning">Not pointing here yet. Try again once your DNS change is live.</Alert>
              )}
            </>
          )}
          {status.verified && <p className="text-ink-2">HTTPS is set up automatically on the first visit.</p>}
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
