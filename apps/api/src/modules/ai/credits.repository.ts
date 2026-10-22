/** Persistence port for AI credit movements (an append-only ledger). */
export interface CreditsRepository {
  /** Credits spent since `since` from the monthly allowance, purchased credits ever, and purchased credits spent. */
  usage(userId: string, since: Date): Promise<{ usedThisMonth: number; purchased: number; purchasedUsed: number }>;
  /** Records a spend. `pool` says whether it came from the monthly allowance or purchased credits. */
  spend(input: { userId: string; amount: number; task: string; pool: "allowance" | "purchased" }): Promise<void>;
}

export const CREDITS_REPOSITORY = Symbol.for("cvb.api.CreditsRepository");
