"use client";

import { useState } from "react";
import { RECOMMENDED_MODELS } from "@/lib/ai";
import { Modal } from "../Modal";
import { useAi } from "./AiProvider";

function Command({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md bg-stone-900 px-3 py-2 pr-16 text-xs leading-relaxed text-stone-100">
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute right-1.5 top-1.5 rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/20"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function AiSettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, status, error, models, update, check } = useAi();
  const [url, setUrl] = useState(settings.url);
  const [os, setOs] = useState<"mac" | "windows" | "linux">(() => {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return "windows";
    if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
    return "mac";
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  const originCmd = {
    mac: `launchctl setenv OLLAMA_ORIGINS "${origin}"\n# then quit Ollama from the menu bar and open it again`,
    windows: `setx OLLAMA_ORIGINS "${origin}"\n# then quit Ollama from the system tray and open it again`,
    linux: `sudo systemctl edit ollama.service\n# add these two lines, save, then:\n#   [Service]\n#   Environment="OLLAMA_ORIGINS=${origin}"\nsudo systemctl restart ollama`,
  }[os];

  return (
    <Modal title="Local AI (Ollama)" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-sm leading-relaxed text-stone-600">
          AI features run on <b>your own computer</b> with Ollama. Your CV is sent only to Ollama on your machine, never to
          a cloud service.
        </p>

        <div
          className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm ring-1 ${
            status === "ok"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : status === "checking"
                ? "bg-stone-50 text-stone-600 ring-stone-200"
                : "bg-amber-50 text-amber-900 ring-amber-200"
          }`}
          role="status"
        >
          <span
            className={`mt-1 size-2 shrink-0 rounded-full ${
              status === "ok" ? "bg-emerald-500" : status === "checking" ? "bg-amber-400" : "bg-amber-500"
            }`}
          />
          <span>
            {status === "ok" && `Connected · ${models.length} model${models.length === 1 ? "" : "s"} installed`}
            {status === "checking" && "Checking connection…"}
            {status === "error" && error}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ollama-url" className="text-xs font-medium text-stone-600">
            Ollama address
          </label>
          <div className="flex gap-2">
            <input
              id="ollama-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="button"
              onClick={() => {
                update({ url });
                void check(url);
              }}
              className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Connect
            </button>
          </div>
        </div>

        {models.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="ollama-model" className="text-xs font-medium text-stone-600">
              Model
            </label>
            <select
              id="ollama-model"
              value={settings.model}
              onChange={(e) => update({ model: e.target.value })}
              className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-500">Bigger models write and extract better but are slower.</p>
          </div>
        )}

        <details className="rounded-lg border border-stone-200 [&_summary::-webkit-details-marker]:hidden" open={status === "error"}>
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-stone-800">Setup help</summary>
          <ol className="flex list-decimal flex-col gap-4 border-t border-stone-100 py-3 pl-8 pr-3 text-sm text-stone-700">
            <li>
              Install Ollama from{" "}
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="font-medium text-brand underline">
                ollama.com/download
              </a>
              .
            </li>
            <li className="flex flex-col gap-2">
              <span>Download a model (once):</span>
              <Command>{`ollama pull ${RECOMMENDED_MODELS[0].name}`}</Command>
              <ul className="text-xs text-stone-500">
                {RECOMMENDED_MODELS.map((m) => (
                  <li key={m.name}>
                    <code className="font-medium text-stone-700">{m.name}</code> · {m.note}
                  </li>
                ))}
              </ul>
            </li>
            {!isLocal && (
              <li className="flex flex-col gap-2">
                <span>
                  Allow this website to talk to Ollama. Without this, Ollama blocks the browser for safety.
                </span>
                <div className="flex gap-1 text-xs">
                  {(["mac", "windows", "linux"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOs(o)}
                      className={`rounded px-2 py-0.5 font-medium capitalize ${os === o ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600"}`}
                    >
                      {o === "mac" ? "macOS" : o}
                    </button>
                  ))}
                </div>
                <Command>{originCmd}</Command>
              </li>
            )}
            <li>
              Click <b>Connect</b> above. Chrome or Edge may ask to allow access to your local network. Choose{" "}
              <b>Allow</b>. Safari blocks this, so use Chrome, Edge or Firefox.
            </li>
          </ol>
        </details>
      </div>
    </Modal>
  );
}
