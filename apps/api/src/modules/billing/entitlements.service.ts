import { effectivePlan, seatUpgrade, type Plan, type PlanSource } from "@cvb/domain";
import { NotFoundError } from "@cvb/shared";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { ORGS_STORE, type OrgsStore } from "../orgs/orgs.store.js";
import { BILLING_REPOSITORY, type BillingRepository } from "./billing.repository.js";

/**
 * Answers "what plan does this user have right now?" from base plan, subscriptions, passes and
 * any organisation seat they hold (a university licence, say).
 */
@Injectable()
export class EntitlementsService {
  constructor(
    @Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository,
    @Optional() @Inject(ORGS_STORE) private readonly orgs?: Pick<OrgsStore, "seatPlans">,
  ) {}

  async planFor(userId: string, now = new Date()): Promise<{ plan: Plan; source: PlanSource }> {
    const profile = await this.billing.profile(userId);
    if (!profile) throw new NotFoundError("User", userId);
    const own = effectivePlan({ base: profile.basePlan, subscriptions: profile.subscriptions, passes: profile.passes }, now);
    const seat = this.orgs ? seatUpgrade(own.plan, await this.orgs.seatPlans(userId)) : null;
    return seat ? { plan: seat, source: "organization" } : own;
  }
}
