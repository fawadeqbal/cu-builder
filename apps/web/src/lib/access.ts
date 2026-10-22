"use client";

import { can, canUseTemplateTier, type Feature, type Plan, type TemplateTier } from "@cvb/domain";
import { useMe } from "./queries";

/**
 * What the visitor can use. Guests get the Free plan (everything stays previewable; some
 * downloads and features ask them to sign in or upgrade). Gating rules live in @cvb/domain.
 */
export function usePlan(): { plan: Plan; signedIn: boolean; loading: boolean } {
  const me = useMe();
  return { plan: me.data?.plan ?? "free", signedIn: Boolean(me.data), loading: me.isLoading };
}

export const isUnlocked = (plan: Plan, tier: TemplateTier): boolean => canUseTemplateTier(plan, tier);
export const hasFeature = (plan: Plan, feature: Feature): boolean => can(plan, feature);
