import type {
  AdminReviewDto,
  AdminReviewsQuery,
  Page,
  PublicReviewDto,
  PublicReviewsQuery,
  ReviewDto,
  SaveReviewDto,
} from "@cvb/contracts";
import { canModerateTo, cleanReview, reviewProblem, statusAfterSave, type ReviewStatus } from "@cvb/domain";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import {
  REVIEWS_REPOSITORY,
  type ReviewRecord,
  type ReviewsRepository,
  type ReviewWithAuthor,
} from "./reviews.repository.js";

const toDto = (r: ReviewRecord): ReviewDto => ({
  id: r.id,
  rating: r.rating,
  text: r.text,
  displayName: r.displayName,
  jobTitle: r.jobTitle,
  status: r.status,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const toPublic = (r: ReviewRecord): PublicReviewDto => ({
  id: r.id,
  rating: r.rating,
  text: r.text,
  displayName: r.displayName,
  jobTitle: r.jobTitle,
  createdAt: r.createdAt.toISOString(),
});

const toAdmin = (r: ReviewWithAuthor): AdminReviewDto => ({
  ...toDto(r),
  userEmail: r.userEmail,
  moderatedAt: r.moderatedAt?.toISOString() ?? null,
});

/**
 * Product reviews: one per account, editable by its author, shown publicly only after a
 * moderator approves it. Editing sends it back to moderation.
 */
@Injectable()
export class ReviewsService {
  constructor(
    @Inject(REVIEWS_REPOSITORY) private readonly repo: ReviewsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async mine(user: AuthUser): Promise<ReviewDto | null> {
    const r = await this.repo.findByUser(user.id);
    return r && toDto(r);
  }

  async save(user: AuthUser, dto: SaveReviewDto): Promise<ReviewDto> {
    const problem = reviewProblem(dto);
    if (problem) throw new ValidationError(problem);
    const previous = await this.repo.findByUser(user.id);
    const clean = cleanReview(dto);
    const saved = await this.repo.saveForUser(user.id, { ...clean, status: statusAfterSave(previous, clean) });
    return toDto(saved);
  }

  async remove(user: AuthUser): Promise<void> {
    await this.repo.deleteForUser(user.id);
  }

  async approved(query: PublicReviewsQuery): Promise<Page<PublicReviewDto>> {
    const page = await this.repo.list({ status: "approved" }, query);
    return { items: page.items.map(toPublic), nextCursor: page.nextCursor };
  }

  async adminList(query: AdminReviewsQuery): Promise<Page<AdminReviewDto>> {
    const page = await this.repo.list({ status: query.status }, query);
    return { items: page.items.map(toAdmin), nextCursor: page.nextCursor };
  }

  async moderate(id: string, status: ReviewStatus): Promise<ReviewDto> {
    if (!canModerateTo(status)) throw new ValidationError("A review can only be approved or rejected");
    const r = await this.repo.setStatus(id, status, this.now());
    if (!r) throw new NotFoundError("Review", id);
    return toDto(r);
  }
}
