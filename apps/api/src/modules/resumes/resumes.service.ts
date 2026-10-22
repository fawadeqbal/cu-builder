import type { CreateResumeDto, Page, ResumeDto, ResumeSummary, ResumeVersionDto, UpdateResumeDto } from "@cvb/contracts";
import { canUseTemplateTier, emptyCV, LIMITS, requiredPlanForTier } from "@cvb/domain";
import { NotFoundError, PlanRequiredError, ValidationError } from "@cvb/shared";
import { isTemplateId, templateMeta } from "@cvb/templates/catalog";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { TEMPLATE_CATALOG, type TemplateCatalog } from "../templates/template-catalog.js";
import { RESUMES_REPOSITORY, type ResumeRecord, type ResumesRepository, type VersionRecord } from "./resumes.repository.js";

const DAY = 24 * 3600 * 1000;

const toVersion = (v: VersionRecord): ResumeVersionDto => ({
  id: v.id,
  reason: v.reason,
  templateId: v.templateId,
  createdAt: v.createdAt.toISOString(),
});

export const toSummary = (r: ResumeRecord): ResumeSummary => ({
  id: r.id,
  title: r.title,
  templateId: r.templateId,
  accent: r.accent,
  pageSize: r.pageSize,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

export const toDto = (r: ResumeRecord): ResumeDto => ({ ...toSummary(r), data: r.data });

/** Resume use cases. Plan rules come from @cvb/domain; storage from the injected repository. */
@Injectable()
export class ResumesService {
  constructor(
    @Inject(RESUMES_REPOSITORY) private readonly resumes: ResumesRepository,
    @Inject(TEMPLATE_CATALOG) private readonly catalog: TemplateCatalog,
  ) {}

  async list(user: AuthUser, page: { cursor?: string; limit: number }): Promise<Page<ResumeSummary>> {
    const { items, nextCursor } = await this.resumes.listByUser(user.id, page);
    return { items: items.map(toSummary), nextCursor };
  }

  async get(user: AuthUser, id: string): Promise<ResumeDto> {
    return toDto(await this.owned(user, id));
  }

  async create(user: AuthUser, dto: CreateResumeDto): Promise<ResumeDto> {
    await this.assertCanAddResume(user);
    await this.assertTemplateAllowed(user, dto.templateId);
    const created = await this.resumes.create({
      userId: user.id,
      title: dto.title,
      templateId: dto.templateId,
      accent: dto.accent,
      pageSize: dto.pageSize,
      data: dto.data ?? emptyCV,
    });
    return toDto(created);
  }

  async update(user: AuthUser, id: string, dto: UpdateResumeDto): Promise<ResumeDto> {
    const current = await this.owned(user, id);
    if (dto.templateId && dto.templateId !== current.templateId) await this.assertTemplateAllowed(user, dto.templateId);
    const { snapshot, ...patch } = dto;
    // A restore point when asked, and automatically at most once a day while someone edits.
    let reason = snapshot ? "manual" : undefined;
    if (!reason && patch.data) {
      const last = await this.resumes.latestVersionAt(id);
      if (!last || Date.now() - last.getTime() > DAY) reason = "daily";
    }
    return toDto(await this.resumes.update(id, patch, reason));
  }

  async versions(user: AuthUser, id: string): Promise<ResumeVersionDto[]> {
    await this.owned(user, id);
    return (await this.resumes.listVersions(id)).map(toVersion);
  }

  async createVersion(user: AuthUser, id: string, reason: "manual" | "download"): Promise<ResumeVersionDto> {
    await this.owned(user, id);
    return toVersion(await this.resumes.snapshot(id, reason));
  }

  async restoreVersion(user: AuthUser, id: string, versionId: string): Promise<ResumeDto> {
    await this.owned(user, id);
    const restored = await this.resumes.restoreVersion(id, versionId);
    if (!restored) throw new NotFoundError("Version", versionId);
    return toDto(restored);
  }

  async trash(user: AuthUser): Promise<ResumeSummary[]> {
    return (await this.resumes.listTrash(user.id)).map(toSummary);
  }

  async restoreFromTrash(user: AuthUser, id: string): Promise<ResumeDto> {
    const deleted = await this.resumes.findDeleted(id, user.id);
    if (!deleted) throw new NotFoundError("Deleted resume", id);
    await this.assertCanAddResume(user);
    return toDto(await this.resumes.restore(id));
  }

  async duplicate(user: AuthUser, id: string): Promise<ResumeDto> {
    const source = await this.owned(user, id);
    await this.assertCanAddResume(user);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
    return toDto(await this.resumes.create({ ...rest, title: `${source.title} (copy)` }));
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.resumes.softDelete(id);
  }

  private async owned(user: AuthUser, id: string): Promise<ResumeRecord> {
    const resume = await this.resumes.findOwned(id, user.id);
    if (!resume) throw new NotFoundError("Resume", id);
    return resume;
  }

  /** Throws PlanRequiredError when the user is at their plan's CV limit. */
  async assertCanAddResume(user: AuthUser): Promise<void> {
    const limit = LIMITS[user.plan].resumes;
    if ((await this.resumes.countByUser(user.id)) >= limit) {
      throw new PlanRequiredError("More than one CV", "standard");
    }
  }

  private async assertTemplateAllowed(user: AuthUser, templateId: string): Promise<void> {
    if (!isTemplateId(templateId)) throw new ValidationError(`Unknown template "${templateId}"`);
    const { name } = templateMeta(templateId);
    const tier = await this.catalog.tierOf(templateId);
    if (!canUseTemplateTier(user.plan, tier)) throw new PlanRequiredError(`The ${name} template`, requiredPlanForTier(tier));
  }
}
