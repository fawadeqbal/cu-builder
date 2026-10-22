"use client";

import type { CreditsDto, PublicAiUsageDto } from "@cvb/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { creditsKey, useCredits } from "./ai";
import { api, isApiError } from "./api";
import { useHydrated } from "./hydrated";
import { useMe } from "./queries";

/**
 * AI writing on the free tool pages. Signed-in people use the editor's /ai endpoints and their
 * credits; visitors use /public/ai with a few free tries a day. Both run the same assistant.
 */

export type FreeAiTask = "write-summary" | "improve-bullet";

const usageKey = ["public-ai", "usage"] as const;

export function useFreeAi() {
  const hydrated = useHydrated();
  const me = useMe();
  const qc = useQueryClient();
  const ready = hydrated && !me.isLoading;
  const signedIn = ready && Boolean(me.data);
  const usage = useQuery({ queryKey: usageKey, queryFn: () => api.get<PublicAiUsageDto>("/public/ai/usage"), enabled: ready && !me.data, staleTime: 30_000 });
  const credits = useCredits(signedIn);

  const call = useCallback(
    async <T,>(task: FreeAiTask, body: unknown): Promise<T> => {
      if (signedIn) {
        const res = await api.post<T & { credits: CreditsDto }>(`/ai/${task}`, body);
        qc.setQueryData(creditsKey, res.credits);
        return res;
      }
      try {
        const res = await api.post<T & { usage: PublicAiUsageDto }>(`/public/ai/${task}`, body);
        qc.setQueryData(usageKey, res.usage);
        return res;
      } catch (e) {
        // Out of tries: refresh the counter so the page shows the sign-up prompt.
        if (isApiError(e, "RATE_LIMITED")) void qc.invalidateQueries({ queryKey: usageKey });
        throw e;
      }
    },
    [signedIn, qc],
  );

  return {
    ready,
    signedIn,
    /** Free tries left today (visitors). */
    usage: usage.data,
    /** Credits left this month (signed in). */
    credits: credits.data,
    call,
  };
}

export type FreeAiProblem = { kind: "limit" | "credits" | "unavailable" | "invalid" | "other"; message: string };

/** A friendly explanation for a failed AI call. */
export function freeAiProblem(e: unknown, signedIn: boolean): FreeAiProblem {
  if (isApiError(e, "RATE_LIMITED")) {
    // The daily allowance says when it renews; a plain 429 is the per-minute throttle.
    const daily = !signedIn && Boolean((e.details as { resetsAt?: string } | undefined)?.resetsAt);
    return daily
      ? { kind: "limit", message: "You've used today's free tries. They start again tomorrow, or create a free account for monthly AI credits." }
      : { kind: "other", message: "That's a lot of requests in a short time. Please wait a minute and try again." };
  }
  if (isApiError(e, "CREDITS_EXHAUSTED")) return { kind: "credits", message: "You've used this month's AI credits. Top up or upgrade to keep writing with AI." };
  if (isApiError(e, "UPSTREAM_FAILED") || (e instanceof TypeError && /fetch/i.test(e.message))) {
    return { kind: "unavailable", message: "AI writing isn't available right now. Please try again in a few minutes; your text is still here." };
  }
  if (isApiError(e, "VALIDATION_FAILED")) return { kind: "invalid", message: "Check what you typed: some of it is too long or missing." };
  return { kind: "other", message: e instanceof Error ? e.message : "Something went wrong. Please try again." };
}
