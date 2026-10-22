import type {
  ApplicationDto,
  BoardDto,
  CreateApplicationDto,
  MoveApplicationDto,
  ReminderDto,
  UpdateApplicationDto,
} from "@cvb/contracts";
import { ASSISTANT, type Assistant } from "@cvb/ai";
import { DEFAULT_COLUMNS, LIMITS, can, positionBetween, remindersFor, requiredPlanFor } from "@cvb/domain";
import { NotFoundError, PlanRequiredError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { AiService } from "../ai/ai.service.js";
import { CreditsService } from "../ai/credits.service.js";
import { JobsService } from "../jobs/jobs.service.js";
import { ResumesService } from "../resumes/resumes.service.js";
import { ShareLinksService } from "../share-links/share-links.service.js";
import { APPLICATIONS_REPOSITORY, type ApplicationPatch, type ApplicationRecord, type ApplicationsRepository } from "./applications.repository.js";

const strip = ({ userId: _u, jobId: _j, ...dto }: ApplicationRecord): ApplicationDto => dto;
const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

/** The application tracker: board columns, cards, moves, reminders and per-application tools. */
@Injectable()
export class TrackerService {
  constructor(
    @Inject(APPLICATIONS_REPOSITORY) private readonly apps: ApplicationsRepository,
    @Inject(ASSISTANT) private readonly assistant: Assistant,
    private readonly jobs: JobsService,
    private readonly resumes: ResumesService,
    private readonly links: ShareLinksService,
    private readonly credits: CreditsService,
    private readonly ai: AiService,
  ) {}

  async board(user: AuthUser): Promise<BoardDto> {
    return (await this.apps.board(user.id)) ?? { columns: DEFAULT_COLUMNS };
  }

  /** Saves columns; cards in a removed column move to the first one. */
  async saveBoard(user: AuthUser, board: BoardDto): Promise<BoardDto> {
    const keys = board.columns.map((c) => c.key);
    if (new Set(keys).size !== keys.length) throw new ValidationError("Column names must be different");
    const before = await this.board(user);
    for (const old of before.columns) {
      if (!keys.includes(old.key)) await this.apps.moveColumn(user.id, old.key, keys[0]!);
    }
    await this.apps.saveBoard(user.id, board);
    return board;
  }

  async list(user: AuthUser, archived = false): Promise<ApplicationDto[]> {
    return (await this.apps.list(user.id, archived)).map(strip);
  }

  async get(user: AuthUser, id: string): Promise<ApplicationDto> {
    return strip(await this.owned(user, id));
  }

  async create(user: AuthUser, dto: CreateApplicationDto, source: "manual" | "extension" | "feed" = "manual"): Promise<ApplicationDto> {
    const board = await this.board(user);
    const status = dto.status && board.columns.some((c) => c.key === dto.status) ? dto.status : board.columns[0]!.key;
    const job = dto.jobId ? await this.jobs.owned(user, dto.jobId) : await this.jobs.create(user, { ...dto.job!, source: source === "manual" ? dto.job!.source : source });
    const existing = await this.apps.existsForJob(user.id, job.id);
    if (existing) return this.get(user, existing);
    await this.assertCanTrack(user);
    const resumeId = dto.resumeId ? (await this.resumes.get(user, dto.resumeId)).id : null;
    const created = await this.apps.create({
      userId: user.id,
      jobId: job.id,
      status,
      position: positionBetween(await this.apps.lastPosition(user.id, status), null),
      resumeId,
      appliedAt: status === "applied" ? new Date() : null,
    });
    return strip(created);
  }

  /** Free plans track a limited number of active applications. */
  async assertCanTrack(user: AuthUser): Promise<void> {
    if (can(user.plan, "tracker.unlimited")) return;
    if ((await this.apps.countActive(user.id)) >= LIMITS[user.plan].trackedJobs) {
      throw new PlanRequiredError("Unlimited application tracking", requiredPlanFor("tracker.unlimited"));
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateApplicationDto): Promise<ApplicationDto> {
    const app = await this.owned(user, id);
    const { archived, appliedAt, interviewAt, deadlineAt, shareLinkId: _ignored, ...rest } = dto;
    if (rest.resumeId) await this.resumes.get(user, rest.resumeId);
    const patch: ApplicationPatch = { ...rest, appliedAt: toDate(appliedAt), interviewAt: toDate(interviewAt), deadlineAt: toDate(deadlineAt) };
    if (archived !== undefined) patch.archivedAt = archived ? new Date() : null;
    if (rest.status === "applied" && !app.appliedAt && appliedAt === undefined) patch.appliedAt = new Date();
    for (const k of Object.keys(patch) as (keyof ApplicationPatch)[]) if (patch[k] === undefined) delete patch[k];
    const updated = await this.apps.update(id, patch);
    await this.syncReminders(updated);
    return strip(updated);
  }

  /** Drag and drop: new column, placed between two neighbours. */
  async move(user: AuthUser, id: string, dto: MoveApplicationDto): Promise<ApplicationDto> {
    const app = await this.owned(user, id);
    const [before, after] = await Promise.all([
      dto.beforeId ? this.apps.positionOf(dto.beforeId, user.id) : null,
      dto.afterId ? this.apps.positionOf(dto.afterId, user.id) : null,
    ]);
    const position = before === null && after === null ? positionBetween(await this.apps.lastPosition(user.id, dto.status), null) : positionBetween(before, after);
    const patch: ApplicationPatch = { status: dto.status, position };
    if (dto.status === "applied" && !app.appliedAt) patch.appliedAt = new Date();
    const updated = await this.apps.update(id, patch);
    await this.syncReminders(updated);
    return strip(updated);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.apps.delete(id);
  }

  /** A share link just for this application, so its views show which employer opened the CV. */
  async shareLink(user: AuthUser, id: string): Promise<ApplicationDto> {
    const app = await this.owned(user, id);
    if (!app.resumeId) throw new ValidationError("Choose the CV you sent for this application first");
    const link = await this.links.create(user, app.resumeId, { label: `${app.job.company || app.job.title} application`.slice(0, 80) });
    return strip(await this.apps.update(id, { shareLinkId: link.id }));
  }

  /** AI help preparing for the company: questions to ask and themes to research. */
  async brief(user: AuthUser, id: string) {
    const app = await this.owned(user, id);
    const out = await this.credits.charge(user, "company-brief", () =>
      this.ai.call("company-brief", () => this.assistant.companyBrief({ company: app.job.company || "the company", role: app.job.title, description: app.job.description })),
    );
    const questions = [...new Set([...app.research.questionsToAsk, ...out.questionsToAsk])].slice(0, 20);
    const themes = out.themes.map((t) => `• ${t}`).join("\n");
    const notes = app.research.notes.includes(themes) ? app.research.notes : [app.research.notes, themes].filter(Boolean).join("\n");
    const updated = await this.apps.update(id, { research: { ...app.research, questionsToAsk: questions, notes } });
    return { ...strip(updated), credits: out.credits };
  }

  async reminders(user: AuthUser, from: Date, to: Date): Promise<ReminderDto[]> {
    return this.apps.reminders(user.id, from, to);
  }

  async createReminder(user: AuthUser, input: { title: string; dueAt: string; applicationId?: string }): Promise<ReminderDto> {
    if (input.applicationId) await this.owned(user, input.applicationId);
    return this.apps.createReminder({ userId: user.id, title: input.title, dueAt: new Date(input.dueAt), applicationId: input.applicationId ?? null });
  }

  async setReminderDone(user: AuthUser, id: string, done: boolean): Promise<ReminderDto> {
    const r = await this.apps.setReminderDone(id, user.id, done);
    if (!r) throw new NotFoundError("Reminder", id);
    return r;
  }

  async deleteReminder(user: AuthUser, id: string): Promise<void> {
    if (!(await this.apps.deleteReminder(id, user.id))) throw new NotFoundError("Reminder", id);
  }

  private async syncReminders(app: ApplicationRecord) {
    await this.apps.syncAutoReminders(
      app.userId,
      app.id,
      remindersFor({
        status: app.status,
        company: app.job.company,
        title: app.job.title,
        appliedAt: app.appliedAt ? new Date(app.appliedAt) : null,
        interviewAt: app.interviewAt ? new Date(app.interviewAt) : null,
        deadlineAt: app.deadlineAt ? new Date(app.deadlineAt) : null,
        followUpDays: app.followUpDays,
      }),
    );
  }

  private async owned(user: AuthUser, id: string): Promise<ApplicationRecord> {
    const app = await this.apps.findOwned(id, user.id);
    if (!app) throw new NotFoundError("Application", id);
    return app;
  }
}
