import type { AcquisitionDto } from "@cvb/contracts";

/** One stored event: indexed columns for reporting, `props` for the rest. */
export type EventRecord = {
  name: string;
  anonymousId: string;
  userId: string | null;
  sessionId: string | null;
  path: string | null;
  referrerDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  device: string | null;
  browser: string | null;
  country: string | null;
  locale: string | null;
  currency: string | null;
  props: Record<string, string | number | boolean> | null;
  createdAt: Date;
};

/** A browser's first-touch facts; only written when the visitor is first seen. */
export type VisitorRecord = {
  anonymousId: string;
  userId: string | null;
  seenAt: Date;
  source: string;
  medium: string;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrerDomain: string | null;
  landingPath: string | null;
  device: string | null;
  browser: string | null;
  country: string | null;
  locale: string | null;
};

export type VisitorState = {
  firstSeenAt: Date;
  /** The account linked before this call (null if none). */
  previousUserId: string | null;
  /** The visitor's stored first touch (what `acquisition` is copied from). */
  firstTouch: Omit<VisitorRecord, "anonymousId" | "userId" | "seenAt">;
};

/** Persistence port for product events and anonymous visitors. */
export interface AnalyticsEventsRepository {
  insertEvents(events: EventRecord[]): Promise<void>;
  /** Creates the visitor on first sight, else bumps last-seen and links `userId` if none is linked yet. */
  upsertVisitor(visitor: VisitorRecord): Promise<VisitorState>;
  /** The account's sign-up time, and whether its first-touch attribution is already stored. */
  accountForAttribution(userId: string): Promise<{ createdAt: Date; hasAcquisition: boolean } | null>;
  /** Stores first-touch attribution on the account unless one is already there. */
  setAcquisition(userId: string, acquisition: AcquisitionDto): Promise<void>;
}

export const ANALYTICS_EVENTS_REPOSITORY = Symbol.for("cvb.api.AnalyticsEventsRepository");
