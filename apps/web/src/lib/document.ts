"use client";

import type { ResumeDto, UpdateResumeDto } from "@cvb/contracts";
import { normalizeCV } from "@cvb/domain";
import { isTemplateId } from "@cvb/templates/catalog";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { FRESH, loadSaved, save, type Saved } from "./cv";
import { keys } from "./queries";

/**
 * Where the CV being edited lives. The builder only talks to this interface, so the same
 * editor works for guests (browser storage) and for signed-in users (the API), and a new
 * store (for example an offline-first one) can be added without touching the editor.
 */
export type SaveStatus = "local" | "saving" | "saved" | "offline" | "error";

export type DocumentController = {
  state: Saved;
  update: (patch: Partial<Saved>) => void;
  status: SaveStatus;
  /** Set when another device saved a newer copy while this one had unsaved edits. */
  conflict: boolean;
  resolveConflict: (keep: "mine" | "theirs") => void;
  /** Saves pending edits now. */
  flush: () => Promise<void>;
  /** Replaces the CV with a copy the server just returned (after restoring a version). */
  applyServer: (resume: ResumeDto) => void;
};

/** Guest CV, kept in this browser only. */
export function useGuestDocument(): DocumentController {
  const [state, setState] = useState<Saved>(() => loadSaved() ?? FRESH);
  useEffect(() => save(state), [state]);
  const update = useCallback((patch: Partial<Saved>) => setState((s) => ({ ...s, ...patch })), []);
  return { state, update, status: "local", conflict: false, resolveConflict: () => {}, flush: async () => {}, applyServer: () => {} };
}

type CloudFields = Pick<Saved, "cv" | "template" | "accent" | "pageSize">;
/** Unsaved edits kept in the browser, with the server version they were made on. */
type Pending = CloudFields & { base?: string };

const SAVE_DELAY = 800;
const POLL_EVERY = 5_000;
const stepKey = (id: string) => `cv-builder:step:${id}`;
const pendingKey = (id: string) => `cv-builder:pending:${id}`;

function readLocal<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: edits still save to the server, just not across a reload while offline.
  }
}

const fromResume = (r: ResumeDto): CloudFields => ({
  cv: normalizeCV(r.data),
  template: isTemplateId(r.templateId) ? r.templateId : "classic",
  accent: r.accent,
  pageSize: r.pageSize,
});

const toPatch = (f: CloudFields): UpdateResumeDto => ({ data: f.cv, templateId: f.template, accent: f.accent, pageSize: f.pageSize });

/**
 * A CV stored in the user's account. Edits save automatically shortly after typing stops.
 * Unsaved edits are also kept in this browser, so they survive going offline or closing the
 * tab, and are sent when the connection is back. Every few seconds the server copy is checked:
 * changes from another device are applied straight away, or, if this device has unsaved edits
 * too, the user chooses which copy to keep (the last save wins).
 */
export function useCloudDocument(resume: ResumeDto): DocumentController {
  const id = resume.id;
  const qc = useQueryClient();

  // Edits left from an earlier visit (offline, or the tab closed before saving).
  const [initial] = useState(() => {
    const pending = readLocal<Pending>(pendingKey(id));
    const stale = Boolean(pending?.base && new Date(resume.updatedAt) > new Date(pending.base));
    return { pending, stale };
  });
  const [state, setState] = useState<Saved>(() => {
    const { base: _base, ...fields } = initial.pending ?? ({} as Partial<Pending>);
    const step = readLocal<number>(stepKey(id)) ?? 0;
    return { ...fromResume(resume), ...fields, step, started: true };
  });
  const [status, setStatus] = useState<SaveStatus>(initial.pending ? "offline" : "saved");
  // The server changed after those edits were made: ask before overwriting.
  const [conflict, setConflictState] = useState(initial.stale);

  const stateRef = useRef(state);
  const serverAt = useRef(resume.updatedAt);
  const dirty = useRef(Boolean(initial.pending));
  const saving = useRef(false);
  const seq = useRef(0); // bumps on every local edit and every save, so stale polls are ignored
  const remote = useRef<ResumeDto | null>(initial.stale ? resume : null);
  const conflictRef = useRef(initial.stale);
  /** After being offline, look at the server copy before sending queued edits. */
  const verifyFirst = useRef(Boolean(initial.pending) && !initial.stale);
  const setConflict = useCallback((on: boolean) => {
    conflictRef.current = on;
    setConflictState(on);
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const inflight = useRef<Promise<void> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    // One save at a time; callers that need everything saved wait for the running one first.
    if (inflight.current) await inflight.current;
    if (!dirty.current || conflictRef.current) return;
    if (verifyFirst.current) {
      try {
        const r = await api.get<ResumeDto>(`/resumes/${id}`);
        verifyFirst.current = false;
        if (new Date(r.updatedAt) > new Date(serverAt.current)) {
          remote.current = r;
          setConflict(true);
          return;
        }
      } catch (e) {
        setStatus(e instanceof ApiError ? "error" : "offline");
        return;
      }
    }
    const mySeq = ++seq.current;
    saving.current = true;
    setStatus("saving");
    const run = (async () => {
      try {
        const saved = await api.patch<ResumeDto>(`/resumes/${id}`, toPatch(stateRef.current));
        serverAt.current = saved.updatedAt;
        qc.setQueryData(keys.resume(id), saved);
        if (seq.current === mySeq) {
          dirty.current = false;
          writeLocal(pendingKey(id), null);
          setStatus("saved");
        }
      } catch (e) {
        // Network failures keep the edits queued; refusals (validation, plan) are shown as errors.
        const offline = !(e instanceof ApiError);
        if (offline) verifyFirst.current = true;
        setStatus(offline ? "offline" : "error");
      } finally {
        saving.current = false;
        inflight.current = null;
      }
    })();
    inflight.current = run;
    await run;
    // Edits made while that save was running go out next.
    if (dirty.current && seq.current !== mySeq) timer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY);
  }, [id, qc, setConflict]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const update = useCallback(
    (patch: Partial<Saved>) => {
      const s = stateRef.current;
      const next = { ...s, ...patch };
      stateRef.current = next;
      setState(next);
      if ("step" in patch) writeLocal(stepKey(id), next.step);
      const contentChanged = (["cv", "template", "accent", "pageSize"] as const).some((k) => k in patch && patch[k] !== s[k]);
      if (!contentChanged) return;
      dirty.current = true;
      seq.current++;
      const pending: Pending = { cv: next.cv, template: next.template, accent: next.accent, pageSize: next.pageSize, base: serverAt.current };
      writeLocal(pendingKey(id), pending);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY);
      setStatus((st) => (st === "offline" ? st : "saving"));
    },
    [id, flush],
  );

  const applyRemote = useCallback(
    (r: ResumeDto) => {
      serverAt.current = r.updatedAt;
      qc.setQueryData(keys.resume(id), r);
      const next = { ...stateRef.current, ...fromResume(r) };
      stateRef.current = next;
      setState(next);
    },
    [id, qc],
  );

  const resolveConflict = useCallback(
    (keep: "mine" | "theirs") => {
      setConflict(false);
      const r = remote.current;
      remote.current = null;
      if (keep === "theirs" && r) {
        dirty.current = false;
        writeLocal(pendingKey(id), null);
        applyRemote(r);
        setStatus("saved");
      } else {
        if (r) serverAt.current = r.updatedAt;
        verifyFirst.current = false;
        void flush();
      }
    },
    [id, applyRemote, flush, setConflict],
  );

  // Send queued edits now (they may be left over from an earlier offline session).
  useEffect(() => {
    if (dirty.current) void flush();
    const onOnline = () => void flush();
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
      clearTimeout(timer.current);
    };
  }, [flush]);

  // Pick up changes made on other devices.
  useEffect(() => {
    const poll = async () => {
      if (document.visibilityState !== "visible" || saving.current || conflict) return;
      const before = seq.current;
      try {
        const r = await api.get<ResumeDto>(`/resumes/${id}`);
        if (seq.current !== before || saving.current) return;
        if (new Date(r.updatedAt) <= new Date(serverAt.current)) return;
        if (dirty.current) {
          remote.current = r;
          setConflict(true);
        } else {
          applyRemote(r);
        }
      } catch {
        // Offline or signed out: try again next time.
      }
      if (dirty.current && status === "offline") void flush();
    };
    const t = setInterval(() => void poll(), POLL_EVERY);
    return () => clearInterval(t);
  }, [id, conflict, status, applyRemote, flush, setConflict]);

  const applyServer = useCallback(
    (r: ResumeDto) => {
      clearTimeout(timer.current);
      dirty.current = false;
      seq.current++;
      writeLocal(pendingKey(id), null);
      setConflict(false);
      applyRemote(r);
      setStatus("saved");
    },
    [id, applyRemote, setConflict],
  );

  return { state, update, status, conflict, resolveConflict, flush, applyServer };
}
