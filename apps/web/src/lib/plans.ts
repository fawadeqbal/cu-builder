import { requiredPlanFor, requiredPlanForTier, type Feature, type Plan, type TemplateTier } from "@cvb/domain";

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  standard: "Standard",
  premium: "Premium",
  executive: "Executive",
};

/** What each plan includes, in the words used on the pricing page. */
export const PLAN_POINTS: Record<Plan, string[]> = {
  free: ["1 CV saved to your account", "Basic templates", "PDF download (with a small credit line)", "ATS score", "3 AI credits a month", "Track up to 10 applications"],
  standard: [
    "Unlimited CVs",
    "Basic and Standard templates",
    "Word (.docx) and plain text exports",
    "Share links with QR code",
    "Full ATS report",
    "Cover letters",
    "50 AI credits a month",
    "Unlimited application tracking",
  ],
  premium: [
    "Everything in Standard",
    "All templates, Premium and Executive included",
    "Job match and one-click tailoring",
    "AI cover letter drafts",
    "Mock interviews with AI feedback",
    "Share-link view analytics",
    "300 AI credits a month",
  ],
  executive: ["Everything in Premium", "One expert CV review per period", "Priority support"],
};

export const FEATURE_LABEL: Partial<Record<Feature, string>> = {
  "resume.multiple": "More than one CV",
  "export.docx": "Word and plain text exports",
  "share.link": "Share links",
  "share.analytics": "Share-link analytics",
  "ats.fullReport": "The full ATS report",
  jobMatch: "Full job matching",
  "ai.tailor": "Tailoring to a job",
  coverLetter: "Cover letters",
  "coverLetter.ai": "AI cover letter drafts",
  interviewPrep: "Mock interviews",
  "tracker.unlimited": "Unlimited application tracking",
  "expertReview.included": "An included expert review",
  "portfolio.customDomain": "A custom domain for your website",
};

export type Gate =
  | { kind: "feature"; feature: Feature }
  /** Needs an account (guests): AI help, saving jobs, letters. */
  | { kind: "account"; what: string }
  /** The month's AI credits are used up. */
  | { kind: "credits" }
  | { kind: "tier"; tier: TemplateTier; name: string }
  | { kind: "limit"; what: string; plan: Plan };

export const planForGate = (g: Gate): Plan =>
  g.kind === "feature"
    ? requiredPlanFor(g.feature)
    : g.kind === "tier"
      ? requiredPlanForTier(g.tier)
      : g.kind === "limit"
        ? g.plan
        : g.kind === "account"
          ? "free"
          : "premium";

export const gateTitle = (g: Gate): string =>
  g.kind === "account"
    ? `Create a free account to ${g.what}`
    : g.kind === "credits"
      ? "You've used this month's AI credits"
      : g.kind === "feature"
    ? `Get ${(FEATURE_LABEL[g.feature] ?? "this feature").toLowerCase()} with ${PLAN_LABEL[planForGate(g)]}`
    : g.kind === "tier"
      ? `${g.name} is a ${PLAN_LABEL[planForGate(g)]} template`
      : `Get ${g.what.toLowerCase()} with ${PLAN_LABEL[g.plan]}`;

/** Minor units ("cents" for any currency) → "$7", "$19.50", "Rs 990". */
export const formatPrice = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
