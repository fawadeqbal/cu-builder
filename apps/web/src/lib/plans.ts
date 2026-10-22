import { requiredPlanFor, requiredPlanForTier, type Feature, type Plan, type TemplateTier } from "@cvb/domain";

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  standard: "Standard",
  premium: "Premium",
  executive: "Executive",
};

/** What each paid plan adds, in the words used on the pricing page. */
export const PLAN_POINTS: Record<Plan, string[]> = {
  free: ["1 CV saved to your account", "Basic templates", "PDF download (with a small credit line)"],
  standard: ["Unlimited CVs", "Basic and Standard templates", "Word (.docx) and plain text exports", "Share links with QR code", "No credit line on PDFs"],
  premium: ["Everything in Standard", "All templates, Premium and Executive included", "Share-link view analytics (coming soon)", "AI writing and job matching (coming soon)"],
  executive: ["Everything in Premium", "One expert CV review per period (coming soon)", "Priority support"],
};

export const FEATURE_LABEL: Partial<Record<Feature, string>> = {
  "resume.multiple": "More than one CV",
  "export.docx": "Word and plain text exports",
  "share.link": "Share links",
};

export type Gate =
  | { kind: "feature"; feature: Feature }
  | { kind: "tier"; tier: TemplateTier; name: string }
  | { kind: "limit"; what: string; plan: Plan };

export const planForGate = (g: Gate): Plan =>
  g.kind === "feature" ? requiredPlanFor(g.feature) : g.kind === "tier" ? requiredPlanForTier(g.tier) : g.plan;

export const gateTitle = (g: Gate): string =>
  g.kind === "feature"
    ? `Get ${(FEATURE_LABEL[g.feature] ?? "this feature").toLowerCase()} with ${PLAN_LABEL[planForGate(g)]}`
    : g.kind === "tier"
      ? `${g.name} is a ${PLAN_LABEL[planForGate(g)]} template`
      : `Get ${g.what.toLowerCase()} with ${PLAN_LABEL[g.plan]}`;

export const formatPrice = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
