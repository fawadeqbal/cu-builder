import type { ContactFormDto, ContactMessageDto, MyPortfolioDto, PortfolioContentDto, PortfolioDto, PublicSiteDto, SavePortfolioDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient, PortfolioSite, Prisma } from "@cvb/db";
import { can, normalizeCV, requiredPlanFor, siteSlugProblem, suggestSiteSlug } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { ConflictError, NotFoundError, PlanRequiredError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { DomainsService } from "../domains/domains.service.js";

const EMPTY_CONTENT: PortfolioContentDto = { about: "", projects: [] };
const content = (v: unknown): PortfolioContentDto => {
  const c = (v && typeof v === "object" ? v : {}) as Partial<PortfolioContentDto>;
  return { about: typeof c.about === "string" ? c.about : "", projects: Array.isArray(c.projects) ? c.projects : [] };
};
const THEMES = new Set(["minimal", "bold", "split"]);

/**
 * Personal websites generated from a CV. The site always shows the CV's current content, plus an
 * "about" text and extra projects. Public at <slug>.<PORTFOLIO_DOMAIN>, /p/<slug>, or a verified
 * custom domain (paid plans). Visitors can write through a contact form; messages reach the
 * owner's inbox and email.
 */
@Injectable()
export class PortfolioService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    private readonly domains: DomainsService,
  ) {}

  async mine(user: AuthUser): Promise<MyPortfolioDto> {
    const site = await this.db.portfolioSite.findUnique({ where: { userId: user.id } });
    let suggestedSlug = site?.slug ?? "";
    if (!site) {
      const resume = await this.db.resume.findFirst({ where: { userId: user.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, select: { data: true } });
      const name = (resume && normalizeCV(resume.data).personal.name) || user.name || user.email.split("@")[0]!;
      suggestedSlug = await this.freeSlug(suggestSiteSlug(name));
    }
    return {
      site: site ? await this.toDto(site) : null,
      suggestedSlug,
      portfolioDomain: this.domains.portfolioDomain,
      canUseCustomDomain: can(user.plan, "portfolio.customDomain"),
    };
  }

  async save(user: AuthUser, dto: SavePortfolioDto): Promise<PortfolioDto> {
    const problem = siteSlugProblem(dto.slug);
    if (problem) throw new ValidationError(problem);
    const resume = await this.db.resume.findFirst({ where: { id: dto.resumeId, userId: user.id, deletedAt: null }, select: { id: true } });
    if (!resume) throw new NotFoundError("Resume", dto.resumeId);
    const taken = await this.db.portfolioSite.findFirst({ where: { slug: dto.slug, NOT: { userId: user.id } }, select: { id: true } });
    if (taken) throw new ConflictError("That address is taken");
    const data = {
      resumeId: dto.resumeId,
      slug: dto.slug,
      theme: dto.theme,
      accent: dto.accent,
      showContactForm: dto.showContactForm,
      published: dto.published,
      content: dto.content as Prisma.InputJsonValue,
    };
    const site = await this.db.portfolioSite.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    return this.toDto(site);
  }

  async remove(user: AuthUser): Promise<void> {
    await this.db.portfolioSite.deleteMany({ where: { userId: user.id } });
  }

  async setDomain(user: AuthUser, input: string | null): Promise<PortfolioDto> {
    const site = await this.owned(user);
    if (input && !can(user.plan, "portfolio.customDomain")) {
      throw new PlanRequiredError("A custom domain for your website", requiredPlanFor("portfolio.customDomain"));
    }
    const domain = input ? await this.domains.claimable(input, { portfolioId: site.id }) : null;
    return this.toDto(await this.db.portfolioSite.update({ where: { id: site.id }, data: { customDomain: domain, domainVerifiedAt: null } }));
  }

  /** Checks DNS now; the domain goes live (and gets a certificate) once it points at us. */
  async verifyDomain(user: AuthUser): Promise<PortfolioDto> {
    const site = await this.owned(user);
    if (!site.customDomain) throw new ValidationError("Add a domain first");
    const ok = await this.domains.pointsAtUs(site.customDomain);
    return this.toDto(await this.db.portfolioSite.update({ where: { id: site.id }, data: { domainVerifiedAt: ok ? new Date() : null } }));
  }

  /** The public site. `count` adds a view (off for metadata look-ups). */
  async publicBySlug(slug: string, count = true): Promise<PublicSiteDto> {
    const site = await this.db.portfolioSite.findFirst({
      where: { slug: slug.toLowerCase(), published: true },
      include: { resume: { select: { templateId: true, accent: true, pageSize: true, data: true, deletedAt: true } }, user: { select: { name: true } } },
    });
    if (!site || site.resume.deletedAt) throw new NotFoundError("Site", slug);
    if (count) await this.db.portfolioSite.update({ where: { id: site.id }, data: { viewCount: { increment: 1 } } });
    return {
      slug: site.slug,
      theme: (THEMES.has(site.theme) ? site.theme : "minimal") as PublicSiteDto["theme"],
      accent: site.accent,
      showContactForm: site.showContactForm,
      content: content(site.content),
      ownerName: site.user.name,
      templateId: site.resume.templateId,
      resumeAccent: site.resume.accent,
      pageSize: site.resume.pageSize === "LETTER" ? "LETTER" : "A4",
      data: normalizeCV(site.resume.data),
      url: this.urlOf(site),
      hideCredit: Boolean(site.customDomain && site.domainVerifiedAt),
      appUrl: this.config.APP_URL,
    };
  }

  async publicByHost(host: string, count = true): Promise<PublicSiteDto> {
    const target = await this.domains.resolveHost(host);
    if (target.kind !== "portfolio") throw new NotFoundError("Site", host);
    return this.publicBySlug(target.slug, count);
  }

  /** A visitor's message. Bots that fill the hidden field get a quiet success and nothing is sent. */
  async contact(slug: string, dto: ContactFormDto): Promise<void> {
    const site = await this.db.portfolioSite.findFirst({
      where: { slug: slug.toLowerCase(), published: true, showContactForm: true },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!site) throw new NotFoundError("Site", slug);
    if (dto.website?.trim()) return;
    const msg = await this.db.contactMessage.create({ data: { siteId: site.id, name: dto.name, email: dto.email, message: dto.message } });
    await this.jobs.enqueue(
      QUEUES.email,
      "send",
      {
        template: "notice",
        to: site.user.email,
        name: site.user.name,
        subject: `New message from ${dto.name} via your website`,
        lines: [`${dto.name} (${dto.email}) wrote:`, dto.message.slice(0, 1000), "Reply to them by email. Messages are also kept in your website inbox."],
        action: { label: "Open inbox", url: `${this.config.APP_URL}/website#inbox` },
      },
      { jobId: `contact-${msg.id}` },
    );
  }

  async messages(user: AuthUser): Promise<ContactMessageDto[]> {
    const site = await this.owned(user);
    const rows = await this.db.contactMessage.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "desc" }, take: 200 });
    return rows.map((m) => ({ id: m.id, name: m.name, email: m.email, message: m.message, read: Boolean(m.readAt), createdAt: m.createdAt.toISOString() }));
  }

  async markRead(user: AuthUser, id: string, read: boolean): Promise<void> {
    const site = await this.owned(user);
    const { count } = await this.db.contactMessage.updateMany({ where: { id, siteId: site.id }, data: { readAt: read ? new Date() : null } });
    if (!count) throw new NotFoundError("Message", id);
  }

  async deleteMessage(user: AuthUser, id: string): Promise<void> {
    const site = await this.owned(user);
    const { count } = await this.db.contactMessage.deleteMany({ where: { id, siteId: site.id } });
    if (!count) throw new NotFoundError("Message", id);
  }

  private async owned(user: AuthUser): Promise<PortfolioSite> {
    const site = await this.db.portfolioSite.findUnique({ where: { userId: user.id } });
    if (!site) throw new NotFoundError("Site");
    return site;
  }

  private urlOf(site: Pick<PortfolioSite, "slug" | "customDomain" | "domainVerifiedAt">): string {
    if (site.customDomain && site.domainVerifiedAt) return `https://${site.customDomain}`;
    const parent = this.domains.portfolioDomain;
    return parent ? `https://${site.slug}.${parent}` : `${this.config.APP_URL.replace(/\/$/, "")}/p/${site.slug}`;
  }

  private async toDto(site: PortfolioSite): Promise<PortfolioDto> {
    const unreadMessages = await this.db.contactMessage.count({ where: { siteId: site.id, readAt: null } });
    return {
      id: site.id,
      resumeId: site.resumeId,
      slug: site.slug,
      theme: (THEMES.has(site.theme) ? site.theme : "minimal") as PortfolioDto["theme"],
      accent: site.accent,
      showContactForm: site.showContactForm,
      published: site.published,
      content: site.content ? content(site.content) : EMPTY_CONTENT,
      url: this.urlOf(site),
      customDomain: this.domains.status(site.customDomain, site.domainVerifiedAt),
      viewCount: site.viewCount,
      unreadMessages,
      createdAt: site.createdAt.toISOString(),
      updatedAt: site.updatedAt.toISOString(),
    };
  }

  private async freeSlug(base: string): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const slug = i === 0 ? base : `${base.slice(0, 36)}-${i + 1}`;
      if (!siteSlugProblem(slug) && !(await this.db.portfolioSite.findFirst({ where: { slug }, select: { id: true } }))) return slug;
    }
    return `${base.slice(0, 30)}-${Date.now().toString(36)}`;
  }
}
