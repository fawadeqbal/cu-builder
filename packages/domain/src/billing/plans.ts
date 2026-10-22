/**
 * Plans, the features they unlock, and which template tiers they open.
 * This table is the single source of truth: the web app greys out what a plan lacks,
 * and the API refuses it. Change entitlements here, nowhere else.
 */

export const PLANS = ["free", "standard", "premium", "executive"] as const;
export type Plan = (typeof PLANS)[number];

export const TEMPLATE_TIERS = ["basic", "standard", "premium", "executive"] as const;
export type TemplateTier = (typeof TEMPLATE_TIERS)[number];

export const FEATURES = [
  "resume.multiple",
  "export.docx",
  "share.link",
  "share.analytics",
  "ats.fullReport",
  "ai.writing",
  "ai.tailor",
  "jobMatch",
  "coverLetter",
  "coverLetter.ai",
  "tracker.unlimited",
  "interviewPrep",
  "expertReview.included",
] as const;
export type Feature = (typeof FEATURES)[number];

const RANK: Record<Plan, number> = { free: 0, standard: 1, premium: 2, executive: 3 };

/** The lowest plan that includes each feature. */
const MINIMUM_PLAN: Record<Feature, Plan> = {
  "resume.multiple": "standard",
  "export.docx": "standard",
  "share.link": "standard",
  "share.analytics": "premium",
  "ats.fullReport": "standard",
  // Free gets a few AI credits a month (see LIMITS); credits are the real limit.
  "ai.writing": "free",
  "ai.tailor": "premium",
  jobMatch: "premium",
  coverLetter: "standard",
  "coverLetter.ai": "premium",
  "tracker.unlimited": "standard",
  interviewPrep: "premium",
  "expertReview.included": "executive",
};

/** The lowest plan whose templates include each tier. */
const TIER_PLAN: Record<TemplateTier, Plan> = {
  basic: "free",
  standard: "standard",
  premium: "premium",
  executive: "premium",
};

/** Numeric limits per plan. `Infinity` means unlimited. */
export const LIMITS: Record<Plan, { resumes: number; trackedJobs: number; aiCreditsPerMonth: number }> = {
  free: { resumes: 1, trackedJobs: 10, aiCreditsPerMonth: 3 },
  standard: { resumes: Infinity, trackedJobs: Infinity, aiCreditsPerMonth: 50 },
  premium: { resumes: Infinity, trackedJobs: Infinity, aiCreditsPerMonth: 300 },
  executive: { resumes: Infinity, trackedJobs: Infinity, aiCreditsPerMonth: 300 },
};

export const atLeast = (plan: Plan, minimum: Plan): boolean => RANK[plan] >= RANK[minimum];

export const can = (plan: Plan, feature: Feature): boolean => atLeast(plan, MINIMUM_PLAN[feature]);

export const requiredPlanFor = (feature: Feature): Plan => MINIMUM_PLAN[feature];

export const canUseTemplateTier = (plan: Plan, tier: TemplateTier): boolean => atLeast(plan, TIER_PLAN[tier]);

export const requiredPlanForTier = (tier: TemplateTier): Plan => TIER_PLAN[tier];
