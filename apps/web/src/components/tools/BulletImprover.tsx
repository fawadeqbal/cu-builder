"use client";

import { isActionLed, isQuantified } from "@cvb/domain";
import { useState } from "react";
import { Alert, Badge, Button, Card, markPlaceholders, TextArea, TextField } from "@cvb/ui";
import { freeAiProblem, useFreeAi, type FreeAiProblem } from "@/lib/free-ai";
import { CopyText } from "./CopyText";
import { FreeAiProblemAlert, FreeAiUsage, OfflineNote } from "./FreeAiStatus";

const EXAMPLES = ["Responsible for handling customer complaints", "Worked on the company website", "Helped with month-end closing"];

/** Free bullet point improver: one CV line in, three achievement-style rewrites out. */
export function BulletImprover() {
  const ai = useFreeAi();
  const [bullet, setBullet] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [options, setOptions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<FreeAiProblem | null>(null);
  const outOfTries = !ai.signedIn && ai.usage?.remaining === 0;
  const ready = bullet.trim().length >= 8;

  async function improve() {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const out = await ai.call<{ options: string[] }>("improve-bullet", { bullet: bullet.trim(), role: role.trim() || undefined, company: company.trim() || undefined });
      setOptions(out.options);
    } catch (e) {
      setProblem(freeAiProblem(e, ai.signedIn));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void improve();
          }}
        >
          <TextArea label="Your CV line" required rows={3} maxLength={600} value={bullet} onChange={(e) => setBullet(e.target.value)} placeholder="e.g. Responsible for handling customer complaints" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-3">Try:</span>
            {EXAMPLES.map((x) => (
              <button key={x} type="button" onClick={() => setBullet(x)} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none">
                {x}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Job title" optional maxLength={160} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Customer Service Officer" />
            <TextField label="Company" optional maxLength={160} value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          {ready && (
            <div className="flex flex-wrap gap-2">
              <Badge tone={isActionLed(bullet) ? "success" : "warning"} icon={isActionLed(bullet) ? "check" : "info"}>
                {isActionLed(bullet) ? "Starts with an action verb" : "Doesn't start with an action verb"}
              </Badge>
              <Badge tone={isQuantified(bullet) ? "success" : "warning"} icon={isQuantified(bullet) ? "check" : "info"}>
                {isQuantified(bullet) ? "Has a number" : "No number yet"}
              </Badge>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <FreeAiUsage ready={ai.ready} signedIn={ai.signedIn} usage={ai.usage} credits={ai.credits} />
            <Button type="submit" variant="primary" icon="sparkle" loading={busy} disabled={!ready || !ai.ready || outOfTries}>
              {options ? "Try again" : "Improve this line"}
            </Button>
          </div>
        </form>
      </Card>

      {problem && <FreeAiProblemAlert problem={problem} signedIn={ai.signedIn} />}
      {outOfTries && !problem && <FreeAiProblemAlert problem={{ kind: "limit", message: "" }} signedIn={false} />}

      {options && (
        <section aria-labelledby="options-title" aria-live="polite" className="flex flex-col gap-3">
          <h2 id="options-title" className="cvb-h2">
            Stronger versions
          </h2>
          <ul className="flex flex-col gap-3">
            {options.map((o, i) => (
              <li key={i}>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-base leading-7 text-ink">{markPlaceholders(o)}</p>
                    <CopyText text={o} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {options.some((o) => o.includes("[")) && <Alert tone="info">Replace [number], [%] and other brackets with your real figures. If you don&apos;t know the exact number, a careful estimate you can explain is fine.</Alert>}
          <OfflineNote usage={ai.signedIn ? undefined : ai.usage} />
        </section>
      )}
    </div>
  );
}
