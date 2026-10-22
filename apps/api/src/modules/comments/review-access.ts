import type { DbClient } from "@cvb/db";

export type ReviewAccess =
  | { role: "owner" }
  /** An expert working on (or who delivered) a paid order for this CV. */
  | { role: "expert"; orderId: string }
  /** A career-office reviewer (or admin) of an organisation the CV's owner belongs to. */
  | { role: "org-reviewer"; orgId: string };

const EXPERT_STATUSES = ["paid", "in_progress", "delivered", "completed", "disputed"];
const REVIEWER_ROLES = ["owner", "admin", "reviewer"];

/**
 * Who may read a CV and comment on it besides its owner. One policy for expert reviews and
 * career-office reviewers, so every route that shows someone else's CV asks the same question.
 */
export async function reviewAccess(db: DbClient, userId: string, resumeId: string): Promise<ReviewAccess | null> {
  const resume = await db.resume.findFirst({ where: { id: resumeId, deletedAt: null }, select: { userId: true } });
  if (!resume) return null;
  if (resume.userId === userId) return { role: "owner" };

  const order = await db.serviceOrder.findFirst({
    where: { resumeId, expertId: userId, status: { in: EXPERT_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (order) return { role: "expert", orderId: order.id };

  const shared = await db.membership.findFirst({
    where: {
      userId,
      role: { in: REVIEWER_ROLES },
      org: { deletedAt: null, members: { some: { userId: resume.userId } } },
    },
    select: { orgId: true },
  });
  if (shared) return { role: "org-reviewer", orgId: shared.orgId };
  return null;
}
