import type { ExpertDto, ExpertProfileBodyDto, MyExpertProfileDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import { availableSlots, validWindow, type ExpertService, type WeeklyWindow } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { ORDERS_STORE, type ExpertRow, type OrdersStore } from "./orders.store.js";
import { SERVICE_PAYMENTS, type ServicePayments } from "./service-payments.js";

export const toExpertDto = (e: ExpertRow): ExpertDto => ({
  userId: e.userId,
  displayName: e.displayName,
  headline: e.headline,
  bio: e.bio,
  photoUrl: e.photoUrl,
  specialties: e.specialties,
  languages: e.languages,
  services: e.services as ExpertService[],
  timezone: e.timezone,
  ratingAvg: e.ratingAvg,
  ratingCount: e.ratingCount,
});

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Expert profiles: the public directory, onboarding, availability, payouts and admin approval. */
@Injectable()
export class ExpertsService {
  constructor(
    @Inject(ORDERS_STORE) private readonly store: OrdersStore,
    @Inject(SERVICE_PAYMENTS) private readonly payments: ServicePayments,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, "APP_URL" | "ADMIN_EMAILS">,
  ) {}

  async directory(filter: { service?: string; language?: string; q?: string }): Promise<ExpertDto[]> {
    const q = filter.q?.trim().toLowerCase();
    const lang = filter.language?.trim().toLowerCase();
    return (await this.store.experts({ status: "approved", service: filter.service || undefined }))
      .filter((e) => !lang || e.languages.some((l) => l.toLowerCase() === lang))
      .filter((e) => !q || [e.displayName, e.headline, ...e.specialties].join(" ").toLowerCase().includes(q))
      .map(toExpertDto);
  }

  async profile(id: string): Promise<ExpertDto> {
    return toExpertDto(await this.approved(id));
  }

  /** Bookable coaching starts for the next two weeks (UTC ISO strings). */
  async slots(id: string, durationMin: number, now = new Date()): Promise<string[]> {
    const e = await this.approved(id);
    if (!e.services.includes("coaching")) return [];
    return availableSlots({
      windows: (e.availability as WeeklyWindow[]) ?? [],
      timeZone: e.timezone,
      durationMin: durationMin === 45 ? 45 : 60,
      now,
      booked: await this.store.bookings(id, now),
    }).map((d) => d.toISOString());
  }

  async me(user: AuthUser): Promise<MyExpertProfileDto | null> {
    const e = await this.store.expert(user.id);
    return e && this.toMine(e);
  }

  /** Applies to become an expert, or updates the profile. New applications wait for approval. */
  async save(user: AuthUser, dto: ExpertProfileBodyDto): Promise<MyExpertProfileDto> {
    if (!validZone(dto.timezone)) throw new ValidationError("Unknown time zone");
    if (dto.availability.some((w) => !validWindow(w))) throw new ValidationError("Each availability window needs a start before its end");
    const existing = await this.store.expert(user.id);
    const saved = await this.store.saveExpert(user.id, { ...dto, ...(existing ? {} : { status: "pending" }) });
    if (!existing) {
      for (const to of this.config.ADMIN_EMAILS) {
        await this.jobs.enqueue(
          QUEUES.email,
          "send",
          {
            template: "notice",
            to,
            name: "Admin",
            subject: `New expert application: ${dto.displayName}`.slice(0, 200),
            lines: [`${dto.displayName} (${user.email}) applied to offer ${dto.services.join(", ")}.`],
            action: { label: "Review applications", url: `${this.config.APP_URL}/admin?tab=experts` },
          },
          { jobId: `expert-applied-${user.id}-${to}` },
        );
      }
    }
    return this.toMine(saved);
  }

  /** Stripe Connect onboarding (Express): returns the link to finish setting up payouts. */
  async connectPayouts(user: AuthUser): Promise<{ url: string }> {
    const e = await this.store.expert(user.id);
    if (!e) throw new ValidationError("Create your expert profile first");
    const { accountId, url } = await this.payments.connect({
      accountId: e.stripeAccountId,
      email: e.email,
      refreshUrl: `${this.config.APP_URL}/expert?payouts=retry`,
      returnUrl: `${this.config.APP_URL}/expert?payouts=done`,
    });
    if (accountId !== e.stripeAccountId) await this.store.saveExpert(user.id, { stripeAccountId: accountId });
    return { url };
  }

  async refreshPayouts(user: AuthUser): Promise<MyExpertProfileDto> {
    const e = await this.store.expert(user.id);
    if (!e) throw new NotFoundError("Expert", user.id);
    if (!e.stripeAccountId) return this.toMine(e);
    const { payoutsEnabled } = await this.payments.accountStatus(e.stripeAccountId);
    return this.toMine(await this.store.saveExpert(user.id, { payoutsEnabled }));
  }

  async adminList(): Promise<(MyExpertProfileDto & { email: string })[]> {
    return (await this.store.experts({})).map((e) => ({ ...this.toMine(e), email: e.email }));
  }

  async setStatus(id: string, status: "approved" | "suspended" | "pending", now = new Date()): Promise<MyExpertProfileDto> {
    const e = await this.store.expert(id);
    if (!e) throw new NotFoundError("Expert", id);
    const saved = await this.store.saveExpert(id, { status, ...(status === "approved" && !e.approvedAt ? { approvedAt: now } : {}) });
    if (status === "approved" && e.status !== "approved") {
      await this.jobs.enqueue(
        QUEUES.email,
        "send",
        {
          template: "notice",
          to: e.email,
          name: e.displayName,
          subject: "You're approved as a CV Builder expert",
          lines: ["Your profile is now listed. Connect payouts so you're paid when orders complete."],
          action: { label: "Open your workspace", url: `${this.config.APP_URL}/expert` },
        },
        { jobId: `expert-approved-${id}` },
      );
    }
    return this.toMine(saved);
  }

  private async approved(id: string): Promise<ExpertRow> {
    const e = await this.store.expert(id);
    if (!e || e.status !== "approved") throw new NotFoundError("Expert", id);
    return e;
  }

  private toMine(e: ExpertRow): MyExpertProfileDto {
    return {
      ...toExpertDto(e),
      status: e.status as MyExpertProfileDto["status"],
      availability: (e.availability as WeeklyWindow[]) ?? [],
      maxActiveOrders: e.maxActiveOrders,
      payoutsConnected: Boolean(e.stripeAccountId),
      payoutsEnabled: e.payoutsEnabled,
      payoutsAvailable: this.payments.mode === "stripe",
      approvedAt: e.approvedAt?.toISOString() ?? null,
    };
  }
}
