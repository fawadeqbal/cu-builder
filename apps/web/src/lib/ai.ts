"use client";

import type { CreditsDto } from "@cvb/contracts";
import type { Feature } from "@cvb/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext } from "react";
import { api, isApiError } from "./api";
import type { Gate } from "./plans";
import { useMe } from "./queries";

export const creditsKey = ["ai", "credits"] as const;

export const useCredits = (enabled: boolean) =>
  useQuery({ queryKey: creditsKey, queryFn: () => api.get<CreditsDto>("/ai/credits"), enabled, staleTime: 30_000 });

/** Turns an API refusal into the prompt that explains it (upgrade, credits, sign in). */
export function gateForError(e: unknown): Gate | null {
  if (isApiError(e, "CREDITS_EXHAUSTED")) return { kind: "credits" };
  if (isApiError(e, "UNAUTHENTICATED")) return { kind: "account", what: "use AI writing" };
  if (isApiError(e, "PLAN_REQUIRED")) {
    const feature = (e.details as { feature?: string } | undefined)?.feature ?? "";
    const map: Record<string, Feature> = {
      "Tailoring a CV to a job": "ai.tailor",
      "Cover letters": "coverLetter",
      "AI cover letter drafts": "coverLetter.ai",
      "Share links": "share.link",
      "More than one CV": "resume.multiple",
    };
    return { kind: "feature", feature: map[feature] ?? "jobMatch" };
  }
  return null;
}

/** Calls an AI endpoint and keeps the credits counter in sync with the answer. */
export function useAiCall() {
  const qc = useQueryClient();
  const me = useMe();
  const call = useCallback(
    async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await api.post<T & { credits?: CreditsDto }>(path, body);
      if (res.credits) qc.setQueryData(creditsKey, res.credits);
      return res;
    },
    [qc],
  );
  return { call, signedIn: Boolean(me.data) };
}

/** What AI helpers in the editor need from the page around them. */
export type AiAssist = {
  enabled: boolean;
  onGate: (gate: Gate) => void;
  notify: (text: string, undo?: () => void) => void;
};

export const AiAssistContext = createContext<AiAssist>({ enabled: false, onGate: () => {}, notify: () => {} });
export const useAiAssist = () => useContext(AiAssistContext);
