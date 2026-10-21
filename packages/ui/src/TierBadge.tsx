import type { TemplateTier as Tier } from "@cvb/domain";

const TIER_STYLE: Record<Tier, string> = {
  basic: "bg-stone-100 text-stone-600 ring-stone-200",
  standard: "bg-sky-50 text-sky-800 ring-sky-200",
  premium: "bg-violet-50 text-violet-800 ring-violet-200",
  executive: "bg-amber-50 text-amber-900 ring-amber-300",
};

const TIER_LABEL: Record<Tier, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
  executive: "Executive",
};

/** Small pill naming a template's tier. Premium and Executive get a spark. */
export function TierBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TIER_STYLE[tier]} ${className}`}
    >
      {(tier === "premium" || tier === "executive") && (
        <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor" aria-hidden="true">
          <path d="M6 0.5 7.1 4.9 11.5 6 7.1 7.1 6 11.5 4.9 7.1 0.5 6 4.9 4.9Z" />
        </svg>
      )}
      {TIER_LABEL[tier]}
    </span>
  );
}
