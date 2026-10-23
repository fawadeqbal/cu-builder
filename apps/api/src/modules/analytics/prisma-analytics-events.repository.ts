import type { AcquisitionDto } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { AnalyticsEventsRepository, EventRecord, VisitorRecord, VisitorState } from "./analytics-events.repository.js";

type VisitorRow = {
  first_seen_at: Date;
  previous_user_id: string | null;
  source: string;
  medium: string;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrer_domain: string | null;
  landing_path: string | null;
  device: string | null;
  browser: string | null;
  country: string | null;
  locale: string | null;
};

@Injectable()
export class PrismaAnalyticsEventsRepository implements AnalyticsEventsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async insertEvents(events: EventRecord[]): Promise<void> {
    if (!events.length) return;
    await this.db.analyticsEvent.createMany({
      data: events.map((e) => ({ ...e, props: (e.props ?? undefined) as Prisma.InputJsonValue | undefined })),
    });
  }

  async upsertVisitor(v: VisitorRecord): Promise<VisitorState> {
    // One statement: the CTE reads the row as it was before the upsert, so we learn whether this
    // call linked the account. First-touch columns are only written on insert.
    const rows = await this.db.$queryRaw<VisitorRow[]>`
      WITH prev AS (SELECT user_id FROM analytics_visitors WHERE anonymous_id = ${v.anonymousId})
      INSERT INTO analytics_visitors AS a (
        anonymous_id, user_id, first_seen_at, last_seen_at, source, medium, campaign, term, content,
        referrer_domain, landing_path, device, browser, country, locale
      ) VALUES (
        ${v.anonymousId}, ${v.userId}, ${v.seenAt}, ${v.seenAt}, ${v.source}, ${v.medium}, ${v.campaign}, ${v.term}, ${v.content},
        ${v.referrerDomain}, ${v.landingPath}, ${v.device}, ${v.browser}, ${v.country}, ${v.locale}
      )
      ON CONFLICT (anonymous_id) DO UPDATE SET
        last_seen_at = GREATEST(a.last_seen_at, EXCLUDED.last_seen_at),
        user_id = COALESCE(a.user_id, EXCLUDED.user_id),
        country = COALESCE(a.country, EXCLUDED.country),
        locale = COALESCE(a.locale, EXCLUDED.locale)
      RETURNING a.first_seen_at, (SELECT user_id FROM prev) AS previous_user_id, a.source, a.medium, a.campaign, a.term,
        a.content, a.referrer_domain, a.landing_path, a.device, a.browser, a.country, a.locale`;
    const r = rows[0]!;
    return {
      firstSeenAt: r.first_seen_at,
      previousUserId: r.previous_user_id,
      firstTouch: {
        source: r.source,
        medium: r.medium,
        campaign: r.campaign,
        term: r.term,
        content: r.content,
        referrerDomain: r.referrer_domain,
        landingPath: r.landing_path,
        device: r.device,
        browser: r.browser,
        country: r.country,
        locale: r.locale,
      },
    };
  }

  async accountForAttribution(userId: string): Promise<{ createdAt: Date; hasAcquisition: boolean } | null> {
    const u = await this.db.user.findUnique({ where: { id: userId }, select: { createdAt: true, acquisition: true } });
    return u ? { createdAt: u.createdAt, hasAcquisition: u.acquisition !== null } : null;
  }

  async setAcquisition(userId: string, acquisition: AcquisitionDto): Promise<void> {
    await this.db.$executeRaw`
      UPDATE users SET acquisition = ${JSON.stringify(acquisition)}::jsonb
      WHERE id = ${userId} AND acquisition IS NULL`;
  }
}
