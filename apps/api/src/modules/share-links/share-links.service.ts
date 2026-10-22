import type { CreateShareLinkDto, PublicResumeDto, ShareLinkDto, UpdateShareLinkDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import { can, requiredPlanFor } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { ConflictError, NotFoundError, PasswordRequiredError, PlanRequiredError, slugify } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
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
  createdAt: l.createdAt.toISOString(),
});

/** Owners are emailed when a link reaches these view counts. */
const NOTIFY_AT = new Set([1, 10, 25, 50, 100, 250, 500, 1000]);

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
    return toDto(await this.links.update(id, patch));
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.links.delete(id);
  }

  /** What a visitor sees. Disabled, expired or deleted links look the same as missing ones. */
  async view(slug: string, password?: string): Promise<PublicResumeDto> {
    const found = await this.links.findBySlug(slug.toLowerCase());
    const now = new Date();
    if (!found || !found.link.enabled || found.resume.deleted || (found.link.expiresAt && found.link.expiresAt <= now)) {
      throw new NotFoundError("Shared CV");
    }
    if (found.link.passwordHash) {
      if (!password) throw new PasswordRequiredError();
      if (!(await verifyPassword(password, found.link.passwordHash))) throw new PasswordRequiredError("That password is not right");
    }

    const views = await this.links.recordView(found.link.id);
    if (NOTIFY_AT.has(views)) {
      await this.jobs.enqueue(
        QUEUES.email,
        "send",
        { template: "resume-viewed", to: found.owner.email, resumeTitle: found.resume.title, views },
        { jobId: `viewed-${found.link.id}-${views}` },
      );
    }

    const { title, templateId, accent, pageSize, data } = found.resume;
    return { title, ownerName: found.owner.name, templateId, accent, pageSize, data };
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
