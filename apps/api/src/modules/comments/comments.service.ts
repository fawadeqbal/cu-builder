import type { CommentDto, CreateCommentDto, ReviewResumeDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { normalizeCV, textAt, type CV } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { ForbiddenError, NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { reviewAccess, type ReviewAccess } from "./review-access.js";

const ROLE_LABEL: Record<ReviewAccess["role"], string> = { owner: "owner", expert: "expert", "org-reviewer": "reviewer" };
const MAX_COMMENTS = 300;

/**
 * Line-by-line comments on a CV by experts and career-office reviewers. Each comment keeps the
 * text it was about, so the owner sees when a line has changed since ("outdated").
 */
@Injectable()
export class CommentsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, "APP_URL">,
  ) {}

  /** The CV, read-only, for anyone allowed to review it. */
  async reviewResume(user: AuthUser, resumeId: string): Promise<ReviewResumeDto> {
    const access = await this.access(user, resumeId);
    const r = await this.db.resume.findUniqueOrThrow({ where: { id: resumeId }, include: { user: { select: { name: true } } } });
    return {
      id: r.id,
      title: r.title,
      ownerName: r.user.name,
      role: access.role,
      templateId: r.templateId,
      accent: r.accent,
      pageSize: r.pageSize === "LETTER" ? "LETTER" : "A4",
      data: normalizeCV(r.data),
      orderId: access.role === "expert" ? access.orderId : null,
    };
  }

  async list(user: AuthUser, resumeId: string): Promise<CommentDto[]> {
    await this.access(user, resumeId);
    const cv = await this.cv(resumeId);
    const rows = await this.db.reviewComment.findMany({
      where: { resumeId },
      include: { author: { select: { id: true, name: true } }, resume: { select: { userId: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((c) => this.toDto(c, cv));
  }

  async create(user: AuthUser, resumeId: string, dto: CreateCommentDto): Promise<CommentDto> {
    const access = await this.access(user, resumeId);
    const cv = await this.cv(resumeId);
    const quote = textAt(cv, dto.anchor);
    if (quote === null) throw new ValidationError("That line isn't in the CV any more");
    if ((await this.db.reviewComment.count({ where: { resumeId } })) >= MAX_COMMENTS) throw new ValidationError("This CV has too many comments");
    const row = await this.db.reviewComment.create({
      data: {
        resumeId,
        authorId: user.id,
        orderId: access.role === "expert" ? access.orderId : null,
        orgId: access.role === "org-reviewer" ? access.orgId : null,
        anchor: dto.anchor,
        quote,
        body: dto.body,
        suggestion: dto.suggestion?.trim() || null,
      },
      include: { author: { select: { id: true, name: true } }, resume: { select: { userId: true, title: true, user: { select: { email: true, name: true } } } } },
    });
    // Starting to comment means the expert has started the work.
    if (access.role === "expert") {
      await this.db.serviceOrder.updateMany({ where: { id: access.orderId, status: "paid" }, data: { status: "in_progress" } });
    }
    // Career-office reviewers: tell the student (at most once an hour per CV).
    if (access.role === "org-reviewer") {
      await this.jobs.enqueue(
        QUEUES.email,
        "send",
        {
          template: "notice",
          to: row.resume.user.email,
          name: row.resume.user.name,
          subject: `New comments on “${row.resume.title}”`.slice(0, 200),
          lines: [`${row.author.name} from your career office commented on your CV.`],
          action: { label: "Open your CV", url: `${this.config.APP_URL}/edit/${resumeId}` },
        },
        { jobId: `comments-${resumeId}-${Math.floor(Date.now() / 3_600_000)}` },
      );
    }
    return this.toDto(row, cv);
  }

  /** Owner (or the author) marks a comment done, or reopens it. */
  async resolve(user: AuthUser, id: string, resolved: boolean): Promise<CommentDto> {
    const c = await this.owned(user, id);
    const row = await this.db.reviewComment.update({
      where: { id },
      data: { resolvedAt: resolved ? new Date() : null },
      include: { author: { select: { id: true, name: true } }, resume: { select: { userId: true } } },
    });
    return this.toDto(row, await this.cv(c.resumeId));
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.owned(user, id);
    await this.db.reviewComment.delete({ where: { id } });
  }

  private async access(user: AuthUser, resumeId: string): Promise<ReviewAccess> {
    const access = await reviewAccess(this.db, user.id, resumeId);
    if (!access) throw new NotFoundError("Resume", resumeId);
    return access;
  }

  private async owned(user: AuthUser, id: string) {
    const c = await this.db.reviewComment.findUnique({ where: { id }, include: { resume: { select: { userId: true } } } });
    if (!c) throw new NotFoundError("Comment", id);
    if (c.authorId !== user.id && c.resume.userId !== user.id) {
      if (await reviewAccess(this.db, user.id, c.resumeId)) throw new ForbiddenError("Only the CV's owner or the comment's author can do that");
      throw new NotFoundError("Comment", id);
    }
    return c;
  }

  private async cv(resumeId: string): Promise<CV> {
    const r = await this.db.resume.findUnique({ where: { id: resumeId }, select: { data: true } });
    return normalizeCV(r?.data);
  }

  private toDto(
    c: { id: string; resumeId: string; authorId: string; orderId: string | null; orgId: string | null; anchor: string; quote: string; body: string; suggestion: string | null; resolvedAt: Date | null; createdAt: Date; author: { id: string; name: string }; resume: { userId: string } },
    cv: CV,
  ): CommentDto {
    const current = textAt(cv, c.anchor);
    return {
      id: c.id,
      resumeId: c.resumeId,
      author: c.author,
      authorRole: c.authorId === c.resume.userId ? ROLE_LABEL.owner : c.orderId ? ROLE_LABEL.expert : ROLE_LABEL["org-reviewer"],
      anchor: c.anchor,
      quote: c.quote,
      body: c.body,
      suggestion: c.suggestion,
      outdated: current === null || current !== c.quote,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
