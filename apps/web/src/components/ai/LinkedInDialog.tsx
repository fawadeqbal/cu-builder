"use client";

import type { LinkedInProfileDto } from "@cvb/contracts";
import { AI_TASKS, type CV } from "@cvb/domain";
import { useState } from "react";
import { Alert, Badge, Button, Icon, Spinner, TextField } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { countPlaceholders } from "@/lib/ai-cv";
import { charCount, linkedinParts, type LinkedInPart } from "@/lib/linkedin";
import type { Gate } from "@/lib/plans";
import { Dialog } from "../ui/Dialog";

const COST = AI_TASKS["linkedin-profile"];

/**
 * "LinkedIn profile": writes a headline, About, one description per job and top skills from the
 * CV, each with its character count against LinkedIn's limit and a Copy button. Nothing is posted
 * anywhere; the person pastes what they want into LinkedIn.
 */
export function LinkedInDialog({ open, onClose, cv, creditsLeft, onGate }: { open: boolean; onClose: () => void; cv: CV; creditsLeft?: number; onGate: (gate: Gate) => void }) {
  const { call } = useAiCall();
  const [target, setTarget] = useState(cv.personal.headline);
  const [profile, setProfile] = useState<LinkedInProfileDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const short = creditsLeft !== undefined && creditsLeft < COST;

  async function write() {
    setBusy(true);
    setError("");
    try {
      setProfile(await call<LinkedInProfileDto>("/ai/linkedin-profile", { cv, targetTitle: target.trim() || undefined }));
    } catch (e) {
      const gate = gateForError(e);
      if (gate) {
        onClose();
        onGate(gate);
      } else setError(e instanceof Error ? e.message : "Couldn't write your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const parts = profile && linkedinParts(profile);
  const placeholders = profile ? countPlaceholders([profile.headline, profile.about, ...profile.experience.map((e) => e.description)]) : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Your LinkedIn profile"
      description={profile ? "Copy each part into your LinkedIn profile. Check it reads like you first." : "AI writes your headline, About, job descriptions and top skills from this CV, using only what it says."}
      footer={
        profile ? (
          <>
            <Button variant="ghost" icon="sparkle" className="me-auto" loading={busy} disabled={busy || short} onClick={() => void write()} title={`Uses ${COST} AI credits`}>
              {busy ? "Writing…" : "Write again"}
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" icon="sparkle" loading={busy} disabled={busy || short} onClick={() => void write()}>
              {busy ? "Writing…" : "Write my LinkedIn profile"}
            </Button>
          </>
        )
      }
    >
      {!profile ? (
        <div className="flex flex-col gap-4">
          <TextField label="Roles you're aiming for" optional hint="Shapes the headline and which skills come first." value={target} maxLength={160} onChange={(e) => setTarget(e.target.value)} />
          <p className="cvb-caption flex items-center gap-1.5">
            <Icon name="sparkle" size={14} />
            Uses {COST} AI credits{creditsLeft !== undefined ? ` · ${creditsLeft} left` : ""}.
          </p>
          {short && (
            <Alert tone="warning" actions={<Button size="sm" variant="secondary" href="/pricing#credits">Get credits</Button>}>
              You need {COST} AI credits for this.
            </Alert>
          )}
          {busy && (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-3" role="status">
              <Spinner /> Writing your profile…
            </p>
          )}
        </div>
      ) : (
        parts && (
          <div className="flex flex-col gap-6" aria-busy={busy}>
            {placeholders > 0 && (
              <Alert tone="info" icon="lightbulb">
                Replace the {placeholders === 1 ? "part" : `${placeholders} parts`} in [square brackets] with your own details, or delete {placeholders === 1 ? "it" : "them"}, before you paste.
              </Alert>
            )}
            <CopyPart part={parts.main[0]!} large />
            {parts.headlines.length > 0 && (
              <section className="flex flex-col gap-2" aria-label="Other headlines">
                <h3 className="cvb-overline">Other headlines to try</h3>
                {parts.headlines.map((p) => (
                  <CopyPart key={p.key} part={p} compact />
                ))}
              </section>
            )}
            <CopyPart part={parts.main[1]!} />
            {parts.experience.length > 0 && (
              <section className="flex flex-col gap-3" aria-label="Experience">
                <h3 className="cvb-overline">Experience</h3>
                {parts.experience.map((p) => (
                  <CopyPart key={p.key} part={p} />
                ))}
              </section>
            )}
            {profile.skills.length > 0 && (
              <section className="flex flex-col gap-2" aria-label="Top skills">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="cvb-overline">Top skills</h3>
                  <CopyButton text={parts.skills.text} label="Copy top skills" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
                <p className="cvb-caption">Add these on LinkedIn under Skills, and pin them as your top skills.</p>
              </section>
            )}
          </div>
        )
      )}
      {error && (
        <Alert tone="danger" className="mt-3">
          {error}
        </Alert>
      )}
    </Dialog>
  );
}

function CopyPart({ part, large, compact }: { part: LinkedInPart; large?: boolean; compact?: boolean }) {
  const count = charCount(part.text, part.max);
  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-line bg-surface ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`min-w-0 flex-1 ${compact ? "cvb-caption" : "text-sm font-semibold text-ink"}`}>{part.label}</span>
        <span className={`cvb-num text-xs ${count.over ? "font-semibold text-danger" : "text-ink-3"}`} aria-label={`${part.text.length} of ${part.max ?? "any"} characters`}>
          {count.label}
        </span>
        <CopyButton text={part.text} label={`Copy ${part.label.toLowerCase()}`} />
      </div>
      <p dir="auto" className={`whitespace-pre-line break-words text-ink-2 ${large ? "text-base font-medium text-ink" : "text-sm leading-relaxed"}`}>
        {part.text || <span className="text-ink-3">Nothing to add here: this job has no lines on your CV yet.</span>}
      </p>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button size="sm" variant="secondary" icon={copied ? "check" : "copy"} disabled={!text} onClick={() => void copy()} aria-label={label}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
