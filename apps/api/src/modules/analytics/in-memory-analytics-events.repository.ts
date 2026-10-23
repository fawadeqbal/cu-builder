import type { AcquisitionDto } from "@cvb/contracts";
import type { AnalyticsEventsRepository, EventRecord, VisitorRecord, VisitorState } from "./analytics-events.repository.js";

/** Test double for AnalyticsEventsRepository. */
export class InMemoryAnalyticsEventsRepository implements AnalyticsEventsRepository {
  readonly events: EventRecord[] = [];
  readonly visitors = new Map<string, VisitorRecord & { firstSeenAt: Date; lastSeenAt: Date }>();
  readonly accounts = new Map<string, { createdAt: Date; acquisition: AcquisitionDto | null }>();

  async insertEvents(events: EventRecord[]): Promise<void> {
    this.events.push(...events);
  }

  async upsertVisitor(v: VisitorRecord): Promise<VisitorState> {
    const existing = this.visitors.get(v.anonymousId);
    const previousUserId = existing?.userId ?? null;
    const row = existing
      ? { ...existing, lastSeenAt: v.seenAt > existing.lastSeenAt ? v.seenAt : existing.lastSeenAt, userId: existing.userId ?? v.userId }
      : { ...v, firstSeenAt: v.seenAt, lastSeenAt: v.seenAt };
    this.visitors.set(v.anonymousId, row);
    const { anonymousId: _a, userId: _u, seenAt: _s, firstSeenAt, lastSeenAt: _l, ...firstTouch } = row;
    return { firstSeenAt, previousUserId, firstTouch };
  }

  async accountForAttribution(userId: string) {
    const a = this.accounts.get(userId);
    return a ? { createdAt: a.createdAt, hasAcquisition: a.acquisition !== null } : null;
  }

  async setAcquisition(userId: string, acquisition: AcquisitionDto): Promise<void> {
    const a = this.accounts.get(userId);
    if (a && !a.acquisition) a.acquisition = acquisition;
  }
}
