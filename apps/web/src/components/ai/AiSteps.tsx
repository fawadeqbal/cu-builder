"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, ProgressBar, Spinner } from "@cvb/ui";
import { gateForError } from "@/lib/ai";
import type { Gate } from "@/lib/plans";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

/** One AI call in a sequence: `label` names the part, `doing` is the progress sentence. */
export type AiTask = { id: string; label: string; doing: string; run: () => Promise<void> };
export type AiStepState = { id: string; label: string; doing: string; status: StepStatus; error?: string };
export type AiRunResult = { done: string[]; failed: string[]; skipped: string[]; gate: Gate | null; cancelled: boolean };

/**
 * Runs AI calls one at a time (a local model may take a minute each), with progress per step.
 * Cancel stops after the current call; a failed call is recorded and the next one still runs,
 * except when the account can't continue (credits or plan), which stops the run. What finished
 * stays finished either way.
 */
export function useAiSteps() {
  const [steps, setSteps] = useState<AiStepState[]>([]);
  const [stopping, setStopping] = useState(false);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  // Leaving the page or closing the dialog stops the run after the call in flight.
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  const run = useCallback(async (tasks: AiTask[]): Promise<AiRunResult> => {
    stop.current = false;
    setStopping(false);
    setRunning(true);
    const status = new Map<string, StepStatus>(tasks.map((t) => [t.id, "pending"]));
    const errors = new Map<string, string>();
    const publish = () => setSteps(tasks.map((t) => ({ id: t.id, label: t.label, doing: t.doing, status: status.get(t.id)!, error: errors.get(t.id) })));
    publish();
    let gate: Gate | null = null;
    for (const t of tasks) {
      if (stop.current || gate) break;
      status.set(t.id, "running");
      publish();
      try {
        await t.run();
        status.set(t.id, "done");
      } catch (e) {
        status.set(t.id, "failed");
        gate = gateForError(e);
        errors.set(t.id, gate ? "Not run: you're out of AI credits or this needs another plan." : e instanceof Error ? e.message : "Something went wrong");
      }
      publish();
    }
    for (const t of tasks) if (status.get(t.id) === "pending") status.set(t.id, "skipped");
    publish();
    setRunning(false);
    const ids = (s: StepStatus) => tasks.filter((t) => status.get(t.id) === s).map((t) => t.id);
    return { done: ids("done"), failed: ids("failed"), skipped: ids("skipped"), gate, cancelled: stop.current && !gate };
  }, []);

  const cancel = useCallback(() => {
    stop.current = true;
    setStopping(true);
  }, []);

  return { steps, running, stopping, run, cancel };
}

const BADGE: Record<StepStatus, { tone: "neutral" | "success" | "danger"; icon?: string; text: string }> = {
  pending: { tone: "neutral", icon: "clock", text: "Waiting" },
  running: { tone: "neutral", text: "Working" },
  done: { tone: "success", icon: "check", text: "Done" },
  failed: { tone: "danger", icon: "x-circle", text: "Not written" },
  skipped: { tone: "neutral", icon: "minus", text: "Skipped" },
};

/** Progress for a sequence of AI calls: the current sentence, a bar, and each step's state. */
export function AiStepList({ steps, running, stopping, onCancel }: { steps: AiStepState[]; running: boolean; stopping: boolean; onCancel?: () => void }) {
  const finished = steps.filter((s) => s.status !== "pending" && s.status !== "running").length;
  const current = steps.findIndex((s) => s.status === "running");
  const now = current >= 0 ? steps[current]! : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4" aria-live="polite">
        <p className="flex items-start gap-2 text-sm font-medium text-ink">
          {running ? <Spinner /> : null}
          <span className="min-w-0 flex-1">
            {now ? (
              <>
                {now.doing}…{" "}
                <span className="cvb-num whitespace-nowrap text-ink-3">
                  {current + 1} of {steps.length}
                </span>
              </>
            ) : running ? (
              "Starting…"
            ) : (
              "Finished"
            )}
          </span>
        </p>
        <ProgressBar value={finished} max={Math.max(1, steps.length)} label={<span className="cvb-sr">Progress</span>} valueLabel={<span className="text-xs text-ink-3">{`${finished}/${steps.length}`}</span>} />
        {running && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="cvb-caption">Each step can take up to a minute. You can keep what&apos;s done.</span>
            {onCancel && (
              <Button size="sm" variant="secondary" disabled={stopping} onClick={onCancel}>
                {stopping ? "Stopping after this step…" : "Cancel"}
              </Button>
            )}
          </div>
        )}
      </div>
      <ol className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {steps.map((s) => {
          const b = BADGE[s.status];
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm" aria-current={s.status === "running" ? "step" : undefined}>
              <span className={`min-w-0 flex-1 basis-40 ${s.status === "running" ? "font-semibold text-ink" : "text-ink-2"}`}>{s.label}</span>
              {s.status === "running" ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
                  <span className="cvb-spinner" aria-hidden="true" />
                  {b.text}
                </span>
              ) : (
                <Badge tone={b.tone} icon={b.icon}>
                  {b.text}
                </Badge>
              )}
              {s.error && <span className="w-full text-xs text-danger">{s.error}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
