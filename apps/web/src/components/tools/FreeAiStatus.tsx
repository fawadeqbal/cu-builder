"use client";

import { PUBLIC_AI_DAILY_LIMIT, type CreditsDto, type PublicAiUsageDto } from "@cvb/contracts";
import { usePathname } from "next/navigation";
import { Alert, Button, Icon } from "@cvb/ui";
import type { FreeAiProblem } from "@/lib/free-ai";

/** "2 of 3 free tries left today" for visitors, the credit balance for signed-in people. */
export function FreeAiUsage({ ready, signedIn, usage, credits }: { ready: boolean; signedIn: boolean; usage?: PublicAiUsageDto; credits?: CreditsDto }) {
  if (!ready) return <span className="text-sm text-ink-3">&nbsp;</span>;
  if (signedIn) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-ink-3">
        <Icon name="sparkle" size={16} className="text-brand-ink" />
        {credits ? `Uses your AI credits: ${credits.remaining} left this month` : "Uses your AI credits"}
      </span>
    );
  }
  if (!usage) return <span className="text-sm text-ink-3">{`${PUBLIC_AI_DAILY_LIMIT} free tries a day, no sign-up`}</span>;
  return (
    <span className="flex items-center gap-1.5 text-sm text-ink-3">
      <Icon name="sparkle" size={16} className="text-brand-ink" />
      {usage.remaining > 0 ? `${usage.remaining} of ${usage.limit} free tries left today` : "No free tries left today"}
    </span>
  );
}

/** What to do when a call fails: sign up, top up, or try again later. */
export function FreeAiProblemAlert({ problem, signedIn }: { problem: FreeAiProblem; signedIn: boolean }) {
  const path = usePathname();
  if (problem.kind === "limit" && !signedIn) {
    return (
      <Alert
        tone="highlight"
        title="You've used today's free tries"
        actions={
          <>
            <Button size="sm" variant="primary" href={`/sign-up?next=${encodeURIComponent(path)}`}>
              Create a free account
            </Button>
            <Button size="sm" variant="ghost" href="/pricing">
              See plans
            </Button>
          </>
        }
      >
        Your free tries start again tomorrow. A free account saves your CV and comes with monthly AI credits to use in the builder; paid plans include more.
      </Alert>
    );
  }
  if (problem.kind === "credits") {
    return (
      <Alert
        tone="warning"
        title="Out of AI credits"
        actions={
          <Button size="sm" variant="secondary" href="/pricing">
            See plans
          </Button>
        }
      >
        {problem.message}
      </Alert>
    );
  }
  return <Alert tone={problem.kind === "unavailable" ? "warning" : "danger"}>{problem.message}</Alert>;
}

/** Shown when no AI model is connected and the basic offline helper answered. */
export function OfflineNote({ usage }: { usage?: PublicAiUsageDto }) {
  if (!usage || usage.aiConnected) return null;
  return <p className="text-xs leading-5 text-ink-3">AI isn&apos;t connected on this server right now, so these come from a basic rule-based helper. They follow the same rules: nothing is invented.</p>;
}
