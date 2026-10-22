import { can, type Plan } from "../billing/plans";

/**
 * Expert services: what can be bought, what it costs, how fast it's delivered, and how the
 * money is split between the expert and the platform.
 */

export const SERVICE_KINDS = ["review", "review_rush", "writing", "coaching", "linkedin"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

/** The services an expert can offer (rush is a review delivered faster). */
export const EXPERT_SERVICES = ["review", "writing", "coaching", "linkedin"] as const;
export type ExpertService = (typeof EXPERT_SERVICES)[number];

export type ServiceInfo = {
  kind: ServiceKind;
  /** Which expert skill it needs. */
  service: ExpertService;
  name: string;
  description: string;
  priceCents: number;
  /** Delivery time after payment; null for coaching (it happens at the booked time). */
  turnaroundHours: number | null;
  revisions: number;
  needsResume: boolean;
  /** Questions asked before the work starts. */
  intake: { key: string; label: string; required: boolean; long?: boolean }[];
};

export const COACHING_DURATIONS = [45, 60] as const;
export type CoachingDuration = (typeof COACHING_DURATIONS)[number];
const COACHING_PRICE: Record<CoachingDuration, number> = { 45: 5900, 60: 7900 };

export const SERVICES: Record<ServiceKind, ServiceInfo> = {
  review: {
    kind: "review",
    service: "review",
    name: "CV review",
    description: "A vetted expert comments on your CV line by line, in the editor, within 48 hours.",
    priceCents: 3900,
    turnaroundHours: 48,
    revisions: 0,
    needsResume: true,
    intake: [{ key: "target", label: "What roles are you applying for?", required: false }],
  },
  review_rush: {
    kind: "review_rush",
    service: "review",
    name: "CV review, 24-hour rush",
    description: "The same line-by-line review, delivered within 24 hours.",
    priceCents: 5900,
    turnaroundHours: 24,
    revisions: 0,
    needsResume: true,
    intake: [{ key: "target", label: "What roles are you applying for?", required: false }],
  },
  writing: {
    kind: "writing",
    service: "writing",
    name: "Done-for-you CV writing",
    description: "An expert writes your CV from a questionnaire and a call: drafts and two revision rounds.",
    priceCents: 19900,
    turnaroundHours: 5 * 24,
    revisions: 2,
    needsResume: true,
    intake: [
      { key: "target", label: "Target roles and industries", required: true },
      { key: "achievements", label: "Your three proudest achievements", required: true, long: true },
      { key: "callTimes", label: "Good times for a 20-minute call", required: false },
      { key: "notes", label: "Anything else the writer should know", required: false, long: true },
    ],
  },
  coaching: {
    kind: "coaching",
    service: "coaching",
    name: "Coaching session",
    description: "A video call with a career coach: interview practice, job search plan or career change.",
    priceCents: COACHING_PRICE[60],
    turnaroundHours: null,
    revisions: 0,
    needsResume: false,
    intake: [{ key: "goals", label: "What do you want from the session?", required: true, long: true }],
  },
  linkedin: {
    kind: "linkedin",
    service: "linkedin",
    name: "LinkedIn makeover",
    description: "A rewritten headline, About section and experience entries for your LinkedIn profile.",
    priceCents: 7900,
    turnaroundHours: 3 * 24,
    revisions: 1,
    needsResume: false,
    intake: [
      { key: "profileUrl", label: "Your LinkedIn profile link", required: true },
      { key: "headline", label: "Current headline", required: false },
      { key: "about", label: "Current About section", required: false, long: true },
      { key: "goal", label: "What should people think when they see your profile?", required: true },
    ],
  },
};

export const isServiceKind = (v: string): v is ServiceKind => (SERVICE_KINDS as readonly string[]).includes(v);

export function priceFor(kind: ServiceKind, opts: { durationMin?: number } = {}): number {
  if (kind === "coaching") return COACHING_PRICE[(opts.durationMin === 45 ? 45 : 60) as CoachingDuration];
  return SERVICES[kind].priceCents;
}

/** The platform's share of each sale; the expert gets the rest when the order completes. */
export const COMMISSION_RATE = 0.25;

export function splitPayment(priceCents: number, rate = COMMISSION_RATE): { commissionCents: number; expertCents: number } {
  const commissionCents = Math.round(priceCents * rate);
  return { commissionCents, expertCents: priceCents - commissionCents };
}

const HOUR = 3600 * 1000;

/** When the work is due: payment time plus turnaround, or the booked time for coaching. */
export function dueDate(kind: ServiceKind, paidAt: Date, scheduledAt?: Date | null): Date | null {
  if (kind === "coaching") return scheduledAt ?? null;
  return new Date(paidAt.getTime() + SERVICES[kind].turnaroundHours! * HOUR);
}

/** Missing required intake answers, by label. */
export function missingIntake(kind: ServiceKind, intake: Record<string, string>): string[] {
  return SERVICES[kind].intake.filter((q) => q.required && !intake[q.key]?.trim()).map((q) => q.label);
}

/**
 * Executive includes one review a calendar month (the 48-hour one; rush is paid).
 * `usedThisMonth` counts included orders created since the start of the month.
 */
export function includedReviewAvailable(plan: Plan, kind: ServiceKind, usedThisMonth: number): boolean {
  return kind === "review" && can(plan, "expertReview.included") && usedThisMonth < 1;
}

export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Running average after one more rating (1–5). */
export function nextRating(avg: number, count: number, rating: number): { avg: number; count: number } {
  const r = Math.min(5, Math.max(1, Math.round(rating)));
  const n = count + 1;
  return { avg: Math.round(((avg * count + r) / n) * 100) / 100, count: n };
}
