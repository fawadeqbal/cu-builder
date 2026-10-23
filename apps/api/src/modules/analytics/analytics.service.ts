import type { AcquisitionDto, ServerEventName, TouchDto, TrackDto } from "@cvb/contracts";
import { browserFamily, channelOf, deviceClass, isBot, normalisePath, resolveCountry, type Touch } from "@cvb/domain";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AnalyticsRecorder, ServerEventProps } from "./analytics-recorder.js";
import { ANALYTICS_EVENTS_REPOSITORY, type AnalyticsEventsRepository, type EventRecord } from "./analytics-events.repository.js";

export type RequestFacts = {
  userId: string | null;
  userAgent: string | undefined;
  headers: Record<string, string | string[] | undefined>;
};

/** A visitor counts as the source of a sign-up when it was seen before (or within an hour after) the account was made. */
export const ATTRIBUTION_GRACE_MS = 60 * 60 * 1000;

const lower = (v: string | undefined, max = 100) => (v ? v.trim().toLowerCase().slice(0, max) || null : null);
const header = (h: RequestFacts["headers"], name: string) => {
  const v = h[name];
  return Array.isArray(v) ? v[0] : v;
};

/** Do Not Track or Global Privacy Control: the browser asked not to be tracked. */
export const optedOut = (h: RequestFacts["headers"]) => header(h, "dnt") === "1" || header(h, "sec-gpc") === "1";

const toTouch = (t: TouchDto | undefined): Touch => ({
  source: lower(t?.source) ?? undefined,
  medium: lower(t?.medium) ?? undefined,
  campaign: lower(t?.campaign) ?? undefined,
  term: lower(t?.term) ?? undefined,
  content: lower(t?.content) ?? undefined,
  referrer: lower(t?.referrer, 253) ?? undefined,
  landing: t?.landing ? normalisePath(t.landing) : undefined,
});

/**
 * Ingests product events: drops bots and opted-out browsers, derives coarse device facts from
 * the User-Agent (which is not stored), keeps first-touch attribution per browser and links the
 * browser to the account once someone signs up or signs in (identity stitching).
 */
@Injectable()
export class AnalyticsService implements AnalyticsRecorder {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(@Inject(ANALYTICS_EVENTS_REPOSITORY) private readonly events: AnalyticsEventsRepository) {}

  /** Returns how many events were stored (0 when dropped). */
  async track(dto: TrackDto, req: RequestFacts, now: Date = new Date()): Promise<number> {
    if (optedOut(req.headers) || isBot(req.userAgent)) return 0;
    const ctx = dto.context ?? {};
    const last = toTouch(ctx.last);
    const first = ctx.first ? toTouch(ctx.first) : last;
    const device = deviceClass(req.userAgent);
    const browser = browserFamily(req.userAgent);
    const country = resolveCountry(req.headers, ctx.tzCountry) ?? null;
    const locale = lower(ctx.locale, 12);
    const { source, medium } = channelOf(first);

    const visitor = await this.events.upsertVisitor({
      anonymousId: dto.anonymousId,
      userId: req.userId,
      seenAt: now,
      source,
      medium,
      campaign: first.campaign ?? null,
      term: first.term ?? null,
      content: first.content ?? null,
      referrerDomain: first.referrer ?? null,
      landingPath: first.landing ?? null,
      device,
      browser,
      country,
      locale,
    });

    const records: EventRecord[] = dto.events.map((e) => ({
      name: e.name,
      anonymousId: dto.anonymousId,
      userId: req.userId,
      sessionId: dto.sessionId ?? null,
      path: e.path ? normalisePath(e.path) : null,
      referrerDomain: last.referrer ?? null,
      utmSource: last.source ?? null,
      utmMedium: last.medium ?? null,
      utmCampaign: last.campaign ?? null,
      utmTerm: last.term ?? null,
      utmContent: last.content ?? null,
      device,
      browser,
      country,
      locale,
      currency: ctx.currency ?? null,
      props: e.props ?? null,
      createdAt: now,
    }));
    await this.events.insertEvents(records);

    if (req.userId && !visitor.previousUserId) await this.attribute(req.userId, visitor.firstSeenAt, visitor.firstTouch);
    return records.length;
  }

  /** Copies the browser's first touch onto the account once, if the browser predates the account. */
  private async attribute(userId: string, firstSeenAt: Date, t: Awaited<ReturnType<AnalyticsEventsRepository["upsertVisitor"]>>["firstTouch"]) {
    const account = await this.events.accountForAttribution(userId);
    if (!account || account.hasAcquisition) return;
    if (firstSeenAt.getTime() > account.createdAt.getTime() + ATTRIBUTION_GRACE_MS) return;
    const acquisition: AcquisitionDto = {
      source: t.source,
      medium: t.medium,
      campaign: t.campaign,
      term: t.term,
      content: t.content,
      referrer: t.referrerDomain,
      landing: t.landingPath,
      device: t.device,
      country: t.country,
      locale: t.locale,
      firstSeenAt: firstSeenAt.toISOString(),
    };
    await this.events.setAcquisition(userId, acquisition);
  }

  /** Server-side facts (billing, imports). Never throws: analytics must not break the caller. */
  async record(
    name: ServerEventName,
    input: { userId: string | null; props?: ServerEventProps; currency?: string | null; at?: Date },
  ): Promise<void> {
    try {
      await this.events.insertEvents([
        {
          name,
          anonymousId: input.userId ? `u:${input.userId}` : "server",
          userId: input.userId,
          sessionId: null,
          path: null,
          referrerDomain: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmTerm: null,
          utmContent: null,
          device: null,
          browser: null,
          country: null,
          locale: null,
          currency: input.currency ?? null,
          props: input.props ?? null,
          createdAt: input.at ?? new Date(),
        },
      ]);
    } catch (e) {
      this.logger.warn(`Could not record ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
