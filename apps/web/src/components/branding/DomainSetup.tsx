"use client";

import type { DomainStatusDto } from "@cvb/contracts";
import { useState } from "react";
import { btn, field, label } from "../ui/styles";

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
    <div className="flex flex-col gap-3">
      <div>
        <label className={label} htmlFor="custom-domain">
          Domain
        </label>
        <div className="flex flex-wrap gap-2">
          <input id="custom-domain" className={`${field} min-w-48 flex-1`} placeholder={example} value={domain} onChange={(e) => setDomain(e.target.value)} />
          <button type="button" className={btn.secondary} disabled={busy !== null || !domain.trim() || domain.trim() === host} onClick={() => void run("save", () => onSave(domain.trim()))}>
            {busy === "save" ? "Saving…" : "Connect"}
          </button>
          {host && (
            <button type="button" className={btn.ghost} disabled={busy !== null} onClick={() => void run("save", async () => (await onSave(null), setDomain("")))}>
              Remove
            </button>
          )}
        </div>
      </div>
      {host && (
        <div className="rounded-xl bg-stone-50 p-4 text-sm ring-1 ring-stone-200">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-semibold text-stone-900">{host}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.verified ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`}>
              {status.verified ? "Connected" : "Waiting for DNS"}
            </span>
          </div>
          {!status.verified && (
            <>
              <p className="text-stone-600">Add this record at your domain provider, then check. DNS changes can take up to a few hours.</p>
              <table className="mt-2 w-full text-start font-mono text-xs">
                <thead className="text-stone-500">
                  <tr>
                    <th className="py-1 pe-3 text-start font-medium">Type</th>
                    <th className="py-1 pe-3 text-start font-medium">Name</th>
                    <th className="py-1 text-start font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="text-stone-800">
                  {(!apex || status.ipv4.length === 0) && (
                    <tr>
                      <td className="py-1 pe-3">CNAME</td>
                      <td className="py-1 pe-3">{apex ? "@" : host.split(".")[0]}</td>
                      <td className="py-1 break-all">{status.cnameTarget}</td>
                    </tr>
                  )}
                  {status.ipv4.map((ip) => (
                    <tr key={ip}>
                      <td className="py-1 pe-3">A</td>
                      <td className="py-1 pe-3">{apex ? "@" : host.split(".")[0]}</td>
                      <td className="py-1">{ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className={`${btn.primary} mt-3`} disabled={busy !== null} onClick={() => void run("verify", onVerify)}>
                {busy === "verify" ? "Checking…" : "Check DNS"}
              </button>
              {checked && !status.verified && <p className="mt-2 text-xs text-amber-800">Not pointing here yet. Try again once your DNS change is live.</p>}
            </>
          )}
          {status.verified && <p className="text-stone-600">HTTPS is set up automatically on the first visit.</p>}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
