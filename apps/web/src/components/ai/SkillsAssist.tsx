"use client";

import { newId, type CV } from "@cvb/domain";
import { useState } from "react";
import { Alert, Chip, Icon } from "@cvb/ui";
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
    <div className="cvb-ai">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="cvb-ai-head min-w-0 flex-1 font-normal">
          <Icon name="sparkle" size={18} />
          Not sure what to list? Get suggestions from your experience.
        </span>
        <AiButton busy={busy} onClick={() => void suggest()}>
          Suggest skills
        </AiButton>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {skills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {skills.map((s) => (
            <Chip key={s} icon="plus" onClick={() => add(s)} title={`Add ${s} to ${cv.skills[0]?.category || "your skills"}`}>
              {s}
            </Chip>
          ))}
          <span className="cvb-caption">Only add what you can talk about in an interview.</span>
        </div>
      )}
    </div>
  );
}
