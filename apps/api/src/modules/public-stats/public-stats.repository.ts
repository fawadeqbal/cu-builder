/** Read-only counts behind the landing page's numbers. */
export interface PublicStatsRepository {
  /** CVs saved to accounts (not deleted), optionally only those created since `since`. */
  countResumes(since?: Date): Promise<number>;
  /** Product analytics events with this name, optionally only since `since`. */
  countEvents(name: string, since?: Date): Promise<number>;
}

export const PUBLIC_STATS_REPOSITORY = Symbol.for("cvb.api.PublicStatsRepository");
