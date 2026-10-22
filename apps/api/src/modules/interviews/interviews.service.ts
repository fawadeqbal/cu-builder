import type { InterviewSessionDto, StarStoryBodyDto, StarStoryDto, StartInterviewDto } from "@cvb/contracts";
import { ASSISTANT, type Assistant } from "@cvb/ai";
import { DB } from "@cvb/db/nest";
import type { DbClient, InterviewSession, StarStory } from "@cvb/db";
import { can, questionsFor, requiredPlanFor, roleFamily, COMPETENCIES, ROLE_FAMILIES, type InterviewSeniority, type RoleFamily } from "@cvb/domain";
import { NotFoundError, PlanRequiredError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { AiService } from "../ai/ai.service.js";
import { CreditsService } from "../ai/credits.service.js";

type Answer = InterviewSessionDto["answers"][number];

const toSession = (s: InterviewSession): InterviewSessionDto => ({
  id: s.id,
  role: s.role,
  seniority: s.seniority,
  jobId: s.jobId,
  questions: s.questions as InterviewSessionDto["questions"],
  answers: s.answers as Answer[],
  completedAt: s.completedAt?.toISOString() ?? null,
  createdAt: s.createdAt.toISOString(),
});

const toStory = (s: StarStory): StarStoryDto => ({
  id: s.id,
  title: s.title,
  situation: s.situation,
  task: s.task,
  action: s.action,
  result: s.result,
  sourceBullet: s.sourceBullet,
  tags: s.tags,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

const MAX_STORIES = 100;
const MAX_QUESTIONS = 20;
const FOLLOW_UP = "Follow-up";

/**
 * Interview preparation: the curated question bank (free), AI mock interviews with feedback per
 * answer, and STAR stories built from CV bullets (Premium). AI calls are metered by credits.
 */
@Injectable()
export class InterviewsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(ASSISTANT) private readonly assistant: Assistant,
    private readonly credits: CreditsService,
    private readonly ai: AiService,
  ) {}

  bank(input: { role?: string; family?: string; seniority?: string; competency?: string }) {
    const family = (ROLE_FAMILIES as readonly string[]).includes(input.family ?? "")
      ? (input.family as RoleFamily)
      : input.role
        ? roleFamily(input.role)
        : "general";
    const seniority = (["entry", "mid", "senior", "lead"].includes(input.seniority ?? "") ? input.seniority : "lead") as InterviewSeniority;
    return {
      family,
      families: ROLE_FAMILIES,
      competencies: COMPETENCIES,
      questions: questionsFor({ family, seniority, competency: input.competency || undefined }),
    };
  }

  async sessions(user: AuthUser): Promise<InterviewSessionDto[]> {
    return (await this.db.interviewSession.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 })).map(toSession);
  }

  async session(user: AuthUser, id: string): Promise<InterviewSessionDto> {
    return toSession(await this.owned(user, id));
  }

  /** Generates questions for a role (and job, if given) and opens a session. */
  async start(user: AuthUser, dto: StartInterviewDto) {
    this.assertPremium(user, "Mock interviews");
    const job = dto.jobId ? await this.db.job.findFirst({ where: { id: dto.jobId, userId: user.id, deletedAt: null } }) : null;
    if (dto.jobId && !job) throw new NotFoundError("Job", dto.jobId);
    const out = await this.credits.charge(user, "interview-questions", () =>
      this.ai.call("interview-questions", () =>
        this.assistant.interviewQuestions({ role: dto.role, seniority: dto.seniority, description: job?.description.slice(0, 6000), count: dto.count }),
      ),
    );
    const row = await this.db.interviewSession.create({
      data: { userId: user.id, role: dto.role, seniority: dto.seniority, jobId: job?.id ?? null, questions: out.questions },
    });
    return { session: toSession(row), credits: out.credits };
  }

  /** Scores one answer; the session completes when every question has one. */
  async answer(user: AuthUser, id: string, input: { index: number; answer: string }) {
    this.assertPremium(user, "Mock interviews");
    const session = toSession(await this.owned(user, id));
    const question = session.questions[input.index];
    if (!question) throw new ValidationError("That question doesn't exist");
    const out = await this.credits.charge(user, "interview-feedback", () =>
      this.ai.call("interview-feedback", () => this.assistant.interviewFeedback({ role: session.role, question: question.question, answer: input.answer })),
    );
    const scored: Answer = { index: input.index, answer: input.answer, scores: out.scores, feedback: out.feedback, improved: out.improved };
    const answers = [...session.answers.filter((a) => a.index !== input.index), scored].sort((a, b) => a.index - b.index);
    // Like a real interviewer, probe a vague answer once: the follow-up joins the end of the list.
    const questions = [...session.questions];
    const firstTry = !session.answers.some((a) => a.index === input.index);
    if (out.followUp && firstTry && question.competency !== FOLLOW_UP && questions.length < MAX_QUESTIONS) {
      questions.push({ question: out.followUp, competency: FOLLOW_UP, tip: `Following up on: “${question.question.slice(0, 120)}”` });
    }
    const done = answers.length >= questions.length;
    const row = await this.db.interviewSession.update({
      where: { id },
      data: { answers, questions, completedAt: done ? new Date() : null },
    });
    return { session: toSession(row), answer: scored, credits: out.credits };
  }

  async removeSession(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.db.interviewSession.delete({ where: { id } });
  }

  async stories(user: AuthUser): Promise<StarStoryDto[]> {
    return (await this.db.starStory.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } })).map(toStory);
  }

  async createStory(user: AuthUser, dto: StarStoryBodyDto): Promise<StarStoryDto> {
    this.assertPremium(user, "STAR stories");
    if ((await this.db.starStory.count({ where: { userId: user.id } })) >= MAX_STORIES) throw new ValidationError("You have 100 stories; delete some first");
    return toStory(await this.db.starStory.create({ data: { userId: user.id, ...dto } }));
  }

  async updateStory(user: AuthUser, id: string, dto: Partial<StarStoryBodyDto>): Promise<StarStoryDto> {
    await this.ownedStory(user, id);
    return toStory(await this.db.starStory.update({ where: { id }, data: dto }));
  }

  async removeStory(user: AuthUser, id: string): Promise<void> {
    await this.ownedStory(user, id);
    await this.db.starStory.delete({ where: { id } });
  }

  /** Drafts a STAR story from one CV bullet (not saved: the person edits it first). */
  async storyFromBullet(user: AuthUser, input: { bullet: string; role: string; company: string }) {
    this.assertPremium(user, "STAR stories");
    return this.credits.charge(user, "star-story", () => this.ai.call("star-story", () => this.assistant.starStory(input)));
  }

  private assertPremium(user: AuthUser, what: string) {
    if (!can(user.plan, "interviewPrep")) throw new PlanRequiredError(what, requiredPlanFor("interviewPrep"));
  }

  private async owned(user: AuthUser, id: string): Promise<InterviewSession> {
    const s = await this.db.interviewSession.findFirst({ where: { id, userId: user.id } });
    if (!s) throw new NotFoundError("Interview", id);
    return s;
  }

  private async ownedStory(user: AuthUser, id: string): Promise<StarStory> {
    const s = await this.db.starStory.findFirst({ where: { id, userId: user.id } });
    if (!s) throw new NotFoundError("Story", id);
    return s;
  }
}
