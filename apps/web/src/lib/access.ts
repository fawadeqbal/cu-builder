import { canUseTemplateTier, type Plan, type TemplateTier } from "@cvb/domain";

/**
 * The visitor's plan. Until accounts and billing ship (Phase 1) everyone gets everything;
 * then this reads the signed-in user's plan. Gating rules live in @cvb/domain.
 */
export const CURRENT_PLAN: Plan = "executive";

export const isUnlocked = (tier: TemplateTier): boolean => canUseTemplateTier(CURRENT_PLAN, tier);
