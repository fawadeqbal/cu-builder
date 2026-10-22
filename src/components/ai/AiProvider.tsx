"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AiError, listModels, loadAiSettings, RECOMMENDED_MODELS, saveAiSettings, type AiSettings } from "@/lib/ai";
import { AiSettingsDialog } from "./AiSettingsDialog";

export type AiStatus = "checking" | "ok" | "error";

type AiContextValue = {
  settings: AiSettings;
  status: AiStatus;
  error: string;
  models: string[];
  /** True when Ollama answered and a model is selected. */
  ready: boolean;
  update: (s: Partial<AiSettings>) => void;
  check: (url?: string) => Promise<void>;
  openSettings: () => void;
};

const AiContext = createContext<AiContextValue | null>(null);

export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside <AiProvider>");
  return ctx;
}

function pickModel(models: string[], current: string): string {
  if (current && models.includes(current)) return current;
  const preferred = RECOMMENDED_MODELS.map((m) => m.name).find((m) => models.includes(m));
  return preferred ?? models[0] ?? "";
}

export function AiProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);
  const [status, setStatus] = useState<AiStatus>("checking");
  const [error, setError] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const update = useCallback((patch: Partial<AiSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveAiSettings(next);
      return next;
    });
  }, []);

  const check = useCallback(
    async (url?: string) => {
      const target = url ?? settings.url;
      setStatus("checking");
      try {
        const found = await listModels(target);
        setModels(found);
        if (found.length === 0) {
          setStatus("error");
          setError("Ollama is running but has no models. Run: ollama pull qwen2.5:7b");
          return;
        }
        setSettings((s) => {
          const next = { ...s, url: target, model: pickModel(found, s.model) };
          saveAiSettings(next);
          return next;
        });
        setError("");
        setStatus("ok");
      } catch (e) {
        setModels([]);
        setStatus("error");
        setError(e instanceof AiError ? e.message : "Can't reach Ollama.");
      }
    },
    [settings.url],
  );

  // Check the connection once when the app opens.
  useEffect(() => {
    let cancelled = false;
    listModels(loadAiSettings().url)
      .then((found) => {
        if (cancelled) return;
        setModels(found);
        setSettings((s) => ({ ...s, model: pickModel(found, s.model) }));
        setStatus(found.length ? "ok" : "error");
        setError(found.length ? "" : "Ollama is running but has no models. Run: ollama pull qwen2.5:7b");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof AiError ? e.message : "Can't reach Ollama.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AiContextValue>(
    () => ({
      settings,
      status,
      error,
      models,
      ready: status === "ok" && !!settings.model,
      update,
      check,
      openSettings: () => setOpen(true),
    }),
    [settings, status, error, models, update, check],
  );

  return (
    <AiContext.Provider value={value}>
      {children}
      {open && <AiSettingsDialog onClose={() => setOpen(false)} />}
    </AiContext.Provider>
  );
}

/** Small header button showing whether local AI is connected. */
export function AiStatusButton() {
  const { status, settings, openSettings } = useAi();
  const dot = status === "ok" ? "bg-emerald-500" : status === "checking" ? "bg-amber-400" : "bg-stone-300";
  return (
    <button
      type="button"
      onClick={openSettings}
      title={status === "ok" ? `Local AI: ${settings.model}` : "Set up local AI (Ollama)"}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      <span>AI</span>
      <span className="sr-only">{status === "ok" ? "connected" : "not connected"}</span>
    </button>
  );
}
