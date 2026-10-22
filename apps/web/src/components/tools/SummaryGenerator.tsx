"use client";

import { useState } from "react";
import { Alert, Button, Card, markPlaceholders, TextArea, TextField } from "@cvb/ui";
import { freeAiProblem, useFreeAi, type FreeAiProblem } from "@/lib/free-ai";
import { EMPTY_SUMMARY_FIELDS, summaryToolCv, type SummaryFields } from "@/lib/free-tools";
import { CopyText } from "./CopyText";
import { FreeAiProblemAlert, FreeAiUsage, OfflineNote } from "./FreeAiStatus";

/** Free CV summary generator: a few facts in, two summary drafts out. */
export function SummaryGenerator() {
  const ai = useFreeAi();
  const [f, setF] = useState<SummaryFields>(EMPTY_SUMMARY_FIELDS);
  const [options, setOptions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<FreeAiProblem | null>(null);
  const set = (k: keyof SummaryFields) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const outOfTries = !ai.signedIn && ai.usage?.remaining === 0;
  const ready = f.targetTitle.trim().length > 1 && (f.skills.trim() || f.highlights.trim() || f.role.trim());

  async function generate() {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const out = await ai.call<{ options: string[] }>("write-summary", { cv: summaryToolCv(f), targetTitle: f.targetTitle.trim() });
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
            void generate();
          }}
        >
          <TextField label="Job you're applying for" required maxLength={160} value={f.targetTitle} onChange={set("targetTitle")} placeholder="e.g. Marketing Manager" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Current or last job title" optional maxLength={160} value={f.role} onChange={set("role")} placeholder="e.g. Brand Manager" />
            <TextField label="Company" optional maxLength={160} value={f.company} onChange={set("company")} />
          </div>
          <TextField label="Years of experience" optional inputMode="numeric" maxLength={4} value={f.years} onChange={set("years")} placeholder="e.g. 5" className="sm:max-w-[12rem]" />
          <TextField label="Key skills" hint="Separate them with commas." optional maxLength={600} value={f.skills} onChange={set("skills")} placeholder="e.g. Campaign planning, Meta Ads, budgeting" />
          <TextArea
            label="What you're proud of"
            hint="One per line: results, projects, awards. Include real numbers; we never make them up."
            optional
            rows={4}
            maxLength={2000}
            value={f.highlights}
            onChange={set("highlights")}
            placeholder={"Grew online sales by 30% in a year\nLed a team of 4"}
          />
          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <FreeAiUsage ready={ai.ready} signedIn={ai.signedIn} usage={ai.usage} credits={ai.credits} />
            <Button type="submit" variant="primary" icon="sparkle" loading={busy} disabled={!ready || !ai.ready || outOfTries}>
              {options ? "Write new drafts" : "Write my summary"}
            </Button>
          </div>
          {!ready && f.targetTitle.trim() && <p className="text-sm text-ink-3">Add your skills, a highlight or your current job so there&apos;s something real to write from.</p>}
        </form>
      </Card>

      {problem && <FreeAiProblemAlert problem={problem} signedIn={ai.signedIn} />}
      {outOfTries && !problem && <FreeAiProblemAlert problem={{ kind: "limit", message: "" }} signedIn={false} />}

      {options && (
        <section aria-labelledby="drafts-title" aria-live="polite" className="flex flex-col gap-3">
          <h2 id="drafts-title" className="cvb-h2">
            Your summary drafts
          </h2>
          {options.map((o, i) => (
            <Card key={i}>
              <div className="flex flex-col gap-3">
                <p className="text-base leading-7 text-ink">{markPlaceholders(o)}</p>
                <CopyText text={o} />
              </div>
            </Card>
          ))}
          {options.some((o) => o.includes("[")) && <Alert tone="info">Replace anything in [brackets] with your real details before you use it.</Alert>}
          <OfflineNote usage={ai.signedIn ? undefined : ai.usage} />
          <p className="text-sm leading-6 text-ink-3">
            Check every word is true for you. Paste your favourite into your CV, or build the whole CV in the{" "}
            <a href="/builder" className="font-semibold text-brand-ink underline-offset-4 hover:underline">
              free builder
            </a>
            .
          </p>
        </section>
      )}
    </div>
  );
}
