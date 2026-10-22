import type { CreditsDto } from "@cvb/contracts";
import { aiCost, creditBalance, monthStart, type AiTask } from "@cvb/domain";
import { CreditsExhaustedError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import { ASSISTANT, type Assistant } from "@cvb/ai";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CREDITS_REPOSITORY, type CreditsRepository } from "./credits.repository.js";

/**
 * Meters AI use. A call is charged only when it succeeds, from the monthly allowance first and
 * purchased packs after. Every AI use case goes through `charge()`.
 */
@Injectable()
export class CreditsService {
  constructor(
    @Inject(CREDITS_REPOSITORY) private readonly credits: CreditsRepository,
    @Inject(ASSISTANT) private readonly assistant: Assistant,
  ) {}

  async balance(user: AuthUser, now = new Date()): Promise<CreditsDto> {
    const start = monthStart(now);
    const usage = await this.credits.usage(user.id, start);
    const b = creditBalance({ plan: user.plan, ...usage });
    const resetsAt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { ...b, resetsAt: resetsAt.toISOString(), provider: this.assistant.name };
  }

  /** Runs `work` if the user can afford `task`, then records the spend and returns the new balance. */
  async charge<T>(user: AuthUser, task: AiTask, work: () => Promise<T>): Promise<T & { credits: CreditsDto }> {
    const cost = aiCost(task);
    const before = await this.balance(user);
    if (before.remaining < cost) throw new CreditsExhaustedError(cost, before.remaining);
    const result = await work();
    const fromAllowance = Math.min(cost, Math.max(0, before.allowance - before.usedThisMonth));
    if (fromAllowance > 0) await this.credits.spend({ userId: user.id, amount: fromAllowance, task, pool: "allowance" });
    if (cost - fromAllowance > 0) await this.credits.spend({ userId: user.id, amount: cost - fromAllowance, task, pool: "purchased" });
    return { ...result, credits: await this.balance(user) };
  }
}
