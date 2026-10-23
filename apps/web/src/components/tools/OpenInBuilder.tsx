"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, type ButtonSize, type ButtonVariant } from "@cvb/ui";
import { track } from "@/lib/analytics";
import { openInEditor, saveAndSignUp, type Handoff } from "@/lib/handoff";
import { useHydrated } from "@/lib/hydrated";
import { useMe } from "@/lib/queries";

/**
 * Opens a CV (an example, or one read by the ATS checker) in the editor: the guest builder for
 * visitors, a new CV in the account for signed-in people. Optionally offers "create a free
 * account to save it" next to it for visitors.
 */
export function OpenInBuilder({
  cv,
  template,
  accent,
  label,
  variant = "primary",
  size = "md",
  offerSignUp = false,
  source,
  example,
}: Handoff & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  offerSignUp?: boolean;
  /** Where the CV comes from, for analytics; `example` is the CV example's slug. */
  source: "cv_example" | "ats_check";
  example?: string;
}) {
  const started = () => {
    track("cv_started", { source, ...(example ? { example } : {}) });
    if (source === "cv_example" && example) track("cv_example_used", { example });
  };
  const router = useRouter();
  const me = useMe();
  const hydrated = useHydrated();
  const signedIn = hydrated && Boolean(me.data);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"limit" | "error" | null>(null);

  async function open() {
    setBusy(true);
    setProblem(null);
    try {
      const r = await openInEditor({ cv, template, accent }, signedIn);
      if (r.kind === "open") {
        started();
        router.push(r.href);
      } else if (r.kind === "limit") setProblem("limit");
    } catch {
      setProblem("error");
    } finally {
      setBusy(false);
    }
  }

  function signUp() {
    const r = saveAndSignUp({ cv, template, accent });
    if (r.kind === "open") {
      started();
      router.push(r.href);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={variant} size={size} iconEnd="arrow-right" loading={busy} disabled={!hydrated || me.isLoading} onClick={() => void open()}>
          {label}
        </Button>
        {offerSignUp && hydrated && !me.isLoading && !signedIn && (
          <Button variant="secondary" size={size} icon="user" onClick={signUp}>
            Create a free account to save it
          </Button>
        )}
      </div>
      {problem === "limit" && (
        <Alert tone="warning" title="You've reached your plan's CV limit">
          Delete a CV you no longer need from <Link href="/app" className="font-semibold underline">My CVs</Link>, or <Link href="/pricing" className="font-semibold underline">upgrade</Link> to keep more.
        </Alert>
      )}
      {problem === "error" && <Alert tone="danger">Couldn&apos;t open the builder. Check your connection and try again.</Alert>}
    </div>
  );
}
