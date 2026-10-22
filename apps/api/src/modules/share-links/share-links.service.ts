import type { CreateShareLinkDto, LinkAnalyticsDto, PublicResumeDto, ShareLinkDto, UpdateShareLinkDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import { can, deviceFromUserAgent, referrerHost, requiredPlanFor, summariseViews } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { ConflictError, NotFoundError, PasswordRequiredError, PlanRequiredError, slugify } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { hashPassword, verifyPassword } from "../../common/crypto/password.js";
import { ResumesService } from "../resumes/resumes.service.js";
import { SHARE_LINKS_REPOSITORY, type ShareLinkRecord, type ShareLinksRepository } from "./share-links.repository.js";

const toDto = (l: ShareLinkRecord): ShareLinkDto => ({
  id: l.id,
  resumeId: l.resumeId,
  slug: l.slug,
  enabled: l.enabled,
  hasPassword: Boolean(l.passwordHash),
  expiresAt: l.expiresAt?.toISOString() ?? null,
  viewCount: l.viewCount,
  lastViewedAt: l.lastViewedAt?.toISOString() ?? null,
  label: l.label,
  notifyOnView: l.notifyOnView,
  createdAt: l.createdAt.toISOString(),
});

/** At most one "your CV was viewed" email per link per hour. */
const NOTIFY_EVERY_MS = 3600_000;

/** Who is looking, as far as we keep it: no IPs, only a hash that changes daily. */
export type Visit = { ip: string; userAgent?: string; referrer?: string; country?: string; host?: string };

@Injectable()
export class ShareLinksService {
  constructor(
    @Inject(SHARE_LINKS_REPOSITORY) private readonly links: ShareLinksRepository,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    private readonly resumes: ResumesService,
  ) {}

  async list(user: AuthUser, resumeId: string): Promise<ShareLinkDto[]> {
    await this.resumes.get(user, resumeId); // ownership
    return (await this.links.listForResume(resumeId)).map(toDto);
  }

  async create(user: AuthUser, resumeId: string, dto: CreateShareLinkDto): Promise<ShareLinkDto> {
    if (!can(user.plan, "share.link")) throw new PlanRequiredError("Share links", requiredPlanFor("share.link"));
    const resume = await this.resumes.get(user, resumeId);
    if (dto.slug && (await this.links.slugTaken(dto.slug))) throw new ConflictError("That link name is taken");
    const slug = dto.slug ?? (await this.freeSlug(resume.data.personal.name || user.name || resume.title));
    const link = await this.links.create({
      resumeId,
      slug,
      passwordHash: dto.password ? await hashPassword(dto.password) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      label: dto.label || null,
    });
    return toDto(link);
  }

  async update(user: AuthUser, id: string, dto: UpdateShareLinkDto): Promise<ShareLinkDto> {
    const link = await this.owned(user, id);
    if (dto.slug && dto.slug !== link.slug && (await this.links.slugTaken(dto.slug))) {
      throw new ConflictError("That link name is taken");
    }
    const patch: Parameters<ShareLinksRepository["update"]>[1] = {};
    if (dto.enabled !== undefined) patch.enabled = dto.enabled;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.password !== undefined) patch.passwordHash = dto.password ? await hashPassword(dto.password) : null;
    if (dto.expiresAt !== undefined) patch.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.label !== undefined) patch.label = dto.label || null;
    if (dto.notifyOnView !== undefined) patch.notifyOnView = dto.notifyOnView;
    return toDto(await this.links.update(id, patch));
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.links.delete(id);
  }

  /** What a visitor sees. Disabled, expired or deleted links look the same as missing ones. */
  async view(slug: string, visit: Visit, password?: string): Promise<PublicResumeDto> {
    const found = await this.links.findBySlug(slug.toLowerCase());
    const now = new Date();
    if (!found || !found.link.enabled || found.resume.deleted || (found.link.expiresAt && found.link.expiresAt <= now)) {
      throw new NotFoundError("Shared CV");
    }
    if (found.link.passwordHash) {
      if (!password) throw new PasswordRequiredError();
      if (!(await verifyPassword(password, found.link.passwordHash))) throw new PasswordRequiredError("That password is not right");
    }

    const device = deviceFromUserAgent(visit.userAgent);
    const day = now.toISOString().slice(0, 10);
    const visitor = createHash("sha256").update(`${found.link.id}|${visit.ip}|${visit.userAgent ?? ""}|${day}`).digest("hex").slice(0, 32);
    const { views, viewId } = await this.links.recordView(found.link.id, {
      visitor,
      referrer: referrerHost(visit.referrer, visit.host),
      country: visit.country && /^[A-Z]{2}$/.test(visit.country) ? visit.country : null,
      device,
    });

    const link = found.link;
    const quiet = link.lastNotifiedAt && now.getTime() - link.lastNotifiedAt.getTime() < NOTIFY_EVERY_MS;
    if (link.notifyOnView && !quiet && device !== "bot") {
      await this.links.update(link.id, { lastNotifiedAt: now });
      await this.jobs.enqueue(
        QUEUES.email,
        "send",
        { template: "resume-viewed", to: found.owner.email, resumeTitle: found.resume.title, views, ...(link.label ? { label: link.label } : {}) },
        { jobId: `viewed-${link.id}-${views}` },
      );
    }

    const { title, templateId, accent, pageSize, data } = found.resume;
    return { viewId, title, ownerName: found.owner.name, templateId, accent, pageSize, data };
  }

  /** Time on page and downloads, sent by the public page. */
  async ping(slug: string, viewId: string, patch: { durationMs?: number; downloaded?: boolean }): Promise<void> {
    await this.links.pingView(slug.toLowerCase(), viewId, patch);
  }

  /** Views, unique viewers, time, downloads, referrers and places; details need share analytics. */
  async analytics(user: AuthUser, id: string): Promise<LinkAnalyticsDto & { complete: boolean }> {
    const link = await this.owned(user, id);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.links.views(id, since);
    const summary = summariseViews(rows);
    const complete = can(user.plan, "share.analytics");
    const recent = rows
      .filter((r) => r.device !== "bot")
      .slice(0, 50)
      .map((r) => ({ viewedAt: r.viewedAt.toISOString(), seconds: Math.round(r.durationMs / 1000), downloaded: r.downloaded, referrer: r.referrer, country: r.country, device: r.device }));
    if (complete) return { linkId: link.id, ...summary, recent, complete };
    return { linkId: link.id, ...summary, referrers: [], countries: [], devices: [], recent: [], avgSeconds: 0, downloads: 0, complete };
  }

  private async owned(user: AuthUser, id: string): Promise<ShareLinkRecord> {
    const link = await this.links.findById(id);
    if (!link || link.ownerId !== user.id) throw new NotFoundError("Share link", id);
    return link;
  }

  private async freeSlug(name: string): Promise<string> {
    const base = slugify(name, "cv").slice(0, 40);
    for (let i = 0; i < 5; i++) {
      const slug = `${base}-${randomBytes(3).toString("hex")}`;
      if (!(await this.links.slugTaken(slug))) return slug;
    }
    return `cv-${randomBytes(8).toString("hex")}`;
  }
}
