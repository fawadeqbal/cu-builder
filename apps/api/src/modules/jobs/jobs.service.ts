import type { CreateJobDto, JobDto, JobMatchDto, TailorProposalDto, UpdateJobDto } from "@cvb/contracts";
import { ASSISTANT, type Assistant } from "@cvb/ai";
import { can, matchJob, requiredPlanFor } from "@cvb/domain";
import { NotFoundError, PlanRequiredError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { AiService } from "../ai/ai.service.js";
import { CreditsService } from "../ai/credits.service.js";
import { ResumesService } from "../resumes/resumes.service.js";
import { JOB_PAGE_READER, type JobPageReader } from "./job-page-reader.js";
import { JOBS_REPOSITORY, type JobRecord, type JobsRepository } from "./jobs.repository.js";

export const toJobDto = (j: JobRecord): JobDto => ({
  id: j.id,
  title: j.title,
  company: j.company,
  location: j.location,
  url: j.url,
  description: j.description,
  source: j.source,
  createdAt: j.createdAt.toISOString(),
  updatedAt: j.updatedAt.toISOString(),
});

/** How many missing keywords a plan without job matching gets to see. */
const PREVIEW_MISSING = 3;

@Injectable()
export class JobsService {
  constructor(
    @Inject(JOBS_REPOSITORY) private readonly jobs: JobsRepository,
    @Inject(JOB_PAGE_READER) private readonly reader: JobPageReader,
    @Inject(ASSISTANT) private readonly assistant: Assistant,
    private readonly resumes: ResumesService,
    private readonly credits: CreditsService,
    private readonly ai: AiService,
  ) {}

  async list(user: AuthUser): Promise<JobDto[]> {
    return (await this.jobs.list(user.id)).map(toJobDto);
  }

  async get(user: AuthUser, id: string): Promise<JobDto> {
    return toJobDto(await this.owned(user, id));
  }

  /** The job record, for other features (tracker, cover letters). */
  async owned(user: AuthUser, id: string): Promise<JobRecord> {
    const job = await this.jobs.findOwned(id, user.id);
    if (!job) throw new NotFoundError("Job", id);
    return job;
  }

  async create(user: AuthUser, dto: CreateJobDto): Promise<JobDto> {
    if (dto.url) {
      const existing = await this.jobs.findByUrl(user.id, dto.url);
      if (existing) return toJobDto(existing);
    }
    return toJobDto(await this.jobs.create({ ...dto, url: dto.url ?? null, userId: user.id }));
  }

  /** Reads a posting from its link and saves it. */
  async importFromUrl(user: AuthUser, url: string): Promise<JobDto> {
    const existing = await this.jobs.findByUrl(user.id, url);
    if (existing) return toJobDto(existing);
    const page = await this.reader.read(url);
    return toJobDto(
      await this.jobs.create({
        userId: user.id,
        title: page.title.slice(0, 200) || "Job",
        company: page.company.slice(0, 200),
        location: page.location.slice(0, 200),
        url,
        description: page.description,
        source: "link",
      }),
    );
  }

  async update(user: AuthUser, id: string, dto: UpdateJobDto): Promise<JobDto> {
    await this.owned(user, id);
    return toJobDto(await this.jobs.update(id, dto));
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.jobs.softDelete(id);
  }

  /** Match % and keywords. Everyone sees the score; the full keyword list needs job matching. */
  async match(user: AuthUser, jobId: string, resumeId: string): Promise<JobMatchDto> {
    const [job, resume] = await Promise.all([this.owned(user, jobId), this.resumes.get(user, resumeId)]);
    const m = matchJob(resume.data, { title: job.title, description: job.description });
    await this.jobs.saveMatch({ userId: user.id, resumeId, jobId, score: m.score, result: m });
    const complete = can(user.plan, "jobMatch");
    if (complete) return { ...m, resumeId, jobId, complete };
    const missing = m.keywords.filter((k) => !k.found).slice(0, PREVIEW_MISSING);
    return { ...m, keywords: missing, missing: missing.map((k) => k.keyword), resumeId, jobId, complete };
  }

  /** AI-suggested tailored version. Nothing is saved: the person reviews a diff and creates the copy. */
  async tailor(user: AuthUser, jobId: string, resumeId: string): Promise<TailorProposalDto & { credits: unknown }> {
    if (!can(user.plan, "ai.tailor")) throw new PlanRequiredError("Tailoring a CV to a job", requiredPlanFor("ai.tailor"));
    const [job, resume] = await Promise.all([this.owned(user, jobId), this.resumes.get(user, resumeId)]);
    const m = matchJob(resume.data, { title: job.title, description: job.description });
    const out = await this.credits.charge(user, "tailor", () =>
      this.ai.call("tailor", () => this.assistant.tailor({ cv: resume.data, job: { title: job.title, company: job.company, description: job.description }, missing: m.missing })),
    );
    return { proposal: out.cv, notes: out.notes, credits: out.credits };
  }
}
