import { effectivePlan, type Plan, type PlanSource } from "@cvb/domain";
import { NotFoundError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import { BILLING_REPOSITORY, type BillingRepository } from "./billing.repository.js";

/** Answers "what plan does this user have right now?" from base plan, subscriptions and passes. */
@Injectable()
export class EntitlementsService {
  constructor(@Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository) {}

  async planFor(userId: string, now = new Date()): Promise<{ plan: Plan; source: PlanSource }> {
    const profile = await this.billing.profile(userId);
    if (!profile) throw new NotFoundError("User", userId);
    return effectivePlan({ base: profile.basePlan, subscriptions: profile.subscriptions, passes: profile.passes }, now);
  }
}
