import { NotFoundError, ValidationError } from "@cvb/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { InMemoryReviewsRepository } from "./in-memory-reviews.repository.js";
import { ReviewsService } from "./reviews.service.js";

const user = (id: string): AuthUser => ({
  id,
  email: `${id}@example.com`,
  name: id,
  role: "user",
  emailVerified: true,
  plan: "free",
  planSource: "base",
});
const review = { rating: 5, text: "Clear steps and a free PDF.", displayName: "Sara A.", jobTitle: null };

describe("ReviewsService", () => {
  let repo: InMemoryReviewsRepository;
  let service: ReviewsService;
  const at = new Date("2026-10-22T10:00:00Z");

  beforeEach(() => {
    repo = new InMemoryReviewsRepository();
    service = new ReviewsService(repo, () => at);
  });

  it("creates one pending review per user and edits it in place", async () => {
    const first = await service.save(user("u1"), review);
    expect(first.status).toBe("pending");
    const again = await service.save(user("u1"), { ...review, rating: 4 });
    expect(again.id).toBe(first.id);
    expect(again.rating).toBe(4);
    expect(repo.rows).toHaveLength(1);
    expect(await service.mine(user("u1"))).toMatchObject({ rating: 4 });
    expect(await service.mine(user("u2"))).toBeNull();
  });

  it("refuses reviews the domain rules reject", async () => {
    await expect(service.save(user("u1"), { ...review, text: "Visit www.example.com now" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(service.save(user("u1"), { ...review, rating: 0 })).rejects.toBeInstanceOf(ValidationError);
    expect(repo.rows).toHaveLength(0);
  });

  it("shows only approved reviews publicly, without account details", async () => {
    const a = await service.save(user("u1"), review);
    await service.save(user("u2"), { ...review, displayName: "Bilal" });
    await service.moderate(a.id, "approved");
    const page = await service.approved({ limit: 6 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toEqual({
      id: a.id,
      rating: 5,
      text: review.text,
      displayName: "Sara A.",
      jobTitle: null,
      createdAt: expect.any(String),
    });
    expect(JSON.stringify(page)).not.toContain("example.com");
  });

  it("sends an approved review back to moderation when it changes", async () => {
    const a = await service.save(user("u1"), review);
    await service.moderate(a.id, "approved");
    expect((await service.save(user("u1"), review)).status).toBe("approved");
    expect((await service.save(user("u1"), { ...review, text: "Edited: still a good tool." })).status).toBe("pending");
    expect((await service.approved({ limit: 6 })).items).toHaveLength(0);
  });

  it("lets admins filter, page and moderate", async () => {
    for (const id of ["u1", "u2", "u3"]) await service.save(user(id), review);
    const all = await service.adminList({ limit: 2 });
    expect(all.items).toHaveLength(2);
    expect(all.items[0]!.userEmail).toBe("u3@example.com");
    const rest = await service.adminList({ limit: 2, cursor: all.nextCursor! });
    expect(rest.items.map((r) => r.userEmail)).toEqual(["u1@example.com"]);
    expect(rest.nextCursor).toBeNull();

    const rejected = await service.moderate(all.items[0]!.id, "rejected");
    expect(rejected.status).toBe("rejected");
    const list = await service.adminList({ limit: 10, status: "rejected" });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]!.moderatedAt).toBe(at.toISOString());
  });

  it("can't moderate to pending or a missing review", async () => {
    const a = await service.save(user("u1"), review);
    await expect(service.moderate(a.id, "pending")).rejects.toBeInstanceOf(ValidationError);
    await expect(service.moderate("missing", "approved")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deletes the user's own review", async () => {
    await service.save(user("u1"), review);
    await service.remove(user("u1"));
    expect(await service.mine(user("u1"))).toBeNull();
  });
});
