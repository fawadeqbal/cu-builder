"use client";

import { newId, type CV } from "@cvb/domain";
import { useState } from "react";
import { gateForError, useAiAssist, useAiCall } from "@/lib/ai";
import { AiButton } from "./AiButton";

/** "✦ Suggest skills": skills the person likely has, added with one tap (they decide). */
export function SkillsAssist({ cv, onChange }: { cv: CV; onChange: (cv: CV) => void }) {
  const { enabled, onGate } = useAiAssist();
  const { call } = useAiCall();
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function suggest() {
    if (!enabled) return onGate({ kind: "account", what: "use AI writing" });
    setBusy(true);
    setError("");
    try {
      setSkills((await call<{ skills: string[] }>("/ai/suggest-skills", { cv, targetTitle: cv.personal.headline || undefined })).skills);
    } catch (e) {
      const gate = gateForError(e);
      if (gate) onGate(gate);
      else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function add(skill: string) {
    const target = cv.skills[0];
    const next = target
      ? cv.skills.map((s) => (s.id === target.id ? { ...s, items: s.items.trim() ? `${s.items.trim()}, ${skill}` : skill } : s))
      : [{ id: newId("skill"), category: "Skills", items: skill }];
    onChange({ ...cv, skills: next });
    setSkills((list) => list.filter((s) => s !== skill));
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-violet-100 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-stone-600">Not sure what to list? Get suggestions from your experience.</span>
        <AiButton busy={busy} onClick={() => void suggest()}>
          Suggest skills
        </AiButton>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
              title={`Add ${s} to ${cv.skills[0]?.category || "your skills"}`}
            >
              + {s}
            </button>
          ))}
          <span className="self-center text-[11px] text-stone-500">Only add what you can talk about in an interview.</span>
        </div>
      )}
    </div>
  );
}
