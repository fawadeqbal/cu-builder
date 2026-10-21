import type { CreateResumeDto, Page, ResumeDto, ResumeSummary, UpdateResumeDto } from "@cvb/contracts";
import { canUseTemplateTier, emptyCV, LIMITS, requiredPlanForTier } from "@cvb/domain";
import { NotFoundError, PlanRequiredError, ValidationError } from "@cvb/shared";
import { isTemplateId, templateMeta } from "@cvb/templates/catalog";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { RESUMES_REPOSITORY, type ResumeRecord, type ResumesRepository } from "./resumes.repository.js";

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
  constructor(@Inject(RESUMES_REPOSITORY) private readonly resumes: ResumesRepository) {}

  async list(user: AuthUser, page: { cursor?: string; limit: number }): Promise<Page<ResumeSummary>> {
    const { items, nextCursor } = await this.resumes.listByUser(user.id, page);
    return { items: items.map(toSummary), nextCursor };
  }

  async get(user: AuthUser, id: string): Promise<ResumeDto> {
    return toDto(await this.owned(user, id));
  }

  async create(user: AuthUser, dto: CreateResumeDto): Promise<ResumeDto> {
    await this.assertCanAddResume(user);
    this.assertTemplateAllowed(user, dto.templateId);
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
    if (dto.templateId && dto.templateId !== current.templateId) this.assertTemplateAllowed(user, dto.templateId);
    const { snapshot, ...patch } = dto;
    return toDto(await this.resumes.update(id, patch, snapshot ? "manual" : undefined));
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

  private async assertCanAddResume(user: AuthUser): Promise<void> {
    const limit = LIMITS[user.plan].resumes;
    if ((await this.resumes.countByUser(user.id)) >= limit) {
      throw new PlanRequiredError("More than one CV", "standard");
    }
  }

  private assertTemplateAllowed(user: AuthUser, templateId: string): void {
    if (!isTemplateId(templateId)) throw new ValidationError(`Unknown template "${templateId}"`);
    const { tier, name } = templateMeta(templateId);
    if (!canUseTemplateTier(user.plan, tier)) throw new PlanRequiredError(`The ${name} template`, requiredPlanForTier(tier));
  }
}
