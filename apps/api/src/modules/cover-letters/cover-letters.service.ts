import type { CoverLetterDto, CreateCoverLetterDto, DraftLetterDto, LetterData, PublicLetterDto, UpdateCoverLetterDto } from "@cvb/contracts";
import { LetterDataSchema } from "@cvb/contracts";
import { ASSISTANT, type Assistant } from "@cvb/ai";
import { can, requiredPlanFor } from "@cvb/domain";
import { NotFoundError, PlanRequiredError, slugify } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { AiService } from "../ai/ai.service.js";
import { CreditsService } from "../ai/credits.service.js";
import { JobsService } from "../jobs/jobs.service.js";
import { ResumesService } from "../resumes/resumes.service.js";
import { COVER_LETTERS_REPOSITORY, type CoverLetterRecord, type CoverLettersRepository } from "./cover-letters.repository.js";

const toDto = (c: CoverLetterRecord): CoverLetterDto => ({
  id: c.id,
  title: c.title,
  resumeId: c.resumeId,
  jobId: c.jobId,
  templateId: c.templateId,
  accent: c.accent,
  pageSize: c.pageSize,
  data: c.data,
  shareSlug: c.shareSlug,
  shareEnabled: c.shareEnabled,
  viewCount: c.viewCount,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Cover letters: an editor document styled like the CV, an AI first draft, and a share link. */
@Injectable()
export class CoverLettersService {
  constructor(
    @Inject(COVER_LETTERS_REPOSITORY) private readonly letters: CoverLettersRepository,
    @Inject(ASSISTANT) private readonly assistant: Assistant,
    private readonly resumes: ResumesService,
    private readonly jobs: JobsService,
    private readonly credits: CreditsService,
    private readonly ai: AiService,
  ) {}

  private assertPlan(user: AuthUser) {
    if (!can(user.plan, "coverLetter")) throw new PlanRequiredError("Cover letters", requiredPlanFor("coverLetter"));
  }

  async list(user: AuthUser): Promise<CoverLetterDto[]> {
    return (await this.letters.list(user.id)).map(toDto);
  }

  async get(user: AuthUser, id: string): Promise<CoverLetterDto> {
    return toDto(await this.owned(user, id));
  }

  async create(user: AuthUser, dto: CreateCoverLetterDto): Promise<CoverLetterDto> {
    this.assertPlan(user);
    const resume = dto.resumeId ? await this.resumes.get(user, dto.resumeId) : null;
    const job = dto.jobId ? await this.jobs.owned(user, dto.jobId) : null;
    const name = resume?.data.personal.name || user.name;
    const data: LetterData =
      dto.data ??
      LetterDataSchema.parse({
        company: job?.company ?? "",
        date: today(),
        subject: job ? `Application for ${job.title}` : "",
        greeting: "Dear Hiring Manager,",
        paragraphs: [""],
        closing: "Kind regards,",
        signature: name,
      });
    return toDto(
      await this.letters.create({
        userId: user.id,
        resumeId: resume?.id ?? null,
        jobId: job?.id ?? null,
        title: dto.title === "Cover letter" && job ? `${job.company || job.title} cover letter` : dto.title,
        templateId: dto.templateId ?? resume?.templateId ?? "classic",
        accent: dto.accent ?? resume?.accent ?? null,
        pageSize: dto.pageSize ?? resume?.pageSize ?? "A4",
        data,
      }),
    );
  }

  async update(user: AuthUser, id: string, dto: UpdateCoverLetterDto): Promise<CoverLetterDto> {
    const letter = await this.owned(user, id);
    const { shareEnabled, ...rest } = dto;
    let shareSlug = letter.shareSlug;
    if (shareEnabled && !shareSlug) shareSlug = await this.freeSlug(letter.title);
    return toDto(await this.letters.update(id, { ...rest, ...(shareEnabled === undefined ? {} : { shareEnabled, shareSlug }) }));
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.letters.softDelete(id);
  }

  /** An AI first draft from the CV and the job. Returned for review, not saved. */
  async draft(user: AuthUser, dto: DraftLetterDto) {
    if (!can(user.plan, "coverLetter.ai")) throw new PlanRequiredError("AI cover letter drafts", requiredPlanFor("coverLetter.ai"));
    const [resume, job] = await Promise.all([this.resumes.get(user, dto.resumeId), this.jobs.owned(user, dto.jobId)]);
    return this.credits.charge(user, "cover-letter", () =>
      this.ai.call("cover-letter", () =>
        this.assistant.coverLetter({ cv: resume.data, job: { title: job.title, company: job.company, description: job.description }, tone: dto.tone, length: dto.length }),
      ),
    );
  }

  async publicView(slug: string): Promise<PublicLetterDto> {
    const letter = await this.letters.viewShared(slug);
    if (!letter) throw new NotFoundError("Shared cover letter");
    const resume = letter.resumeId ? await this.resumes.getForOwner(letter.userId, letter.resumeId).catch(() => null) : null;
    const p = resume?.data.personal;
    return {
      title: letter.title,
      templateId: letter.templateId,
      accent: letter.accent,
      pageSize: letter.pageSize,
      data: letter.data,
      sender: { name: p?.name || letter.data.signature, headline: p?.headline ?? "", email: p?.email ?? "", phone: p?.phone ?? "", location: p?.location ?? "" },
    };
  }

  private async owned(user: AuthUser, id: string): Promise<CoverLetterRecord> {
    const letter = await this.letters.findOwned(id, user.id);
    if (!letter) throw new NotFoundError("Cover letter", id);
    return letter;
  }

  private async freeSlug(title: string): Promise<string> {
    const base = slugify(title, "letter").slice(0, 40);
    for (let i = 0; i < 5; i++) {
      const slug = `${base}-${randomBytes(3).toString("hex")}`;
      if (!(await this.letters.slugTaken(slug))) return slug;
    }
    return `letter-${randomBytes(8).toString("hex")}`;
  }
}
