import { LIMITS, type Plan } from "../billing/plans";

/** Every AI action and what it costs in credits (cheap edits 1, long drafts 3). */
export const AI_TASKS = {
  "improve-bullet": 1,
  "write-summary": 1,
  rewrite: 1,
  "suggest-skills": 1,
  "improve-entry": 1,
  "organise-skills": 1,
  tailor: 3,
  "cover-letter": 3,
  "interview-questions": 1,
  "interview-feedback": 1,
  "star-story": 1,
  "company-brief": 1,
  "linkedin-profile": 2,
} as const;

export type AiTask = keyof typeof AI_TASKS;
export const AI_TASK_IDS = Object.keys(AI_TASKS) as [AiTask, ...AiTask[]];

export const aiCost = (task: AiTask): number => AI_TASKS[task];

/**
 * Credits left this month: the plan's monthly allowance, plus purchased packs (which don't
 * expire), minus what was used. Purchased credits are spent only after the allowance.
 */
export function creditBalance(input: { plan: Plan; usedThisMonth: number; purchased: number; purchasedUsed: number }): {
  allowance: number;
  usedThisMonth: number;
  purchasedLeft: number;
  remaining: number;
} {
  const allowance = LIMITS[input.plan].aiCreditsPerMonth;
  const purchasedLeft = Math.max(0, input.purchased - input.purchasedUsed);
  const remaining = Math.max(0, allowance - input.usedThisMonth) + purchasedLeft;
  return { allowance, usedThisMonth: input.usedThisMonth, purchasedLeft, remaining };
}

/** Start of the calendar month (UTC) that credit allowances reset on. */
export const monthStart = (now: Date = new Date()): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
