import { EXPERT_SERVICES, ORDER_STATUSES, SERVICE_KINDS } from "@cvb/domain";
import { z } from "zod";
import { PageSizeSchema, ResumeDataSchema } from "./resume";

const iso = z.string();

export const ServiceKindSchema = z.enum(SERVICE_KINDS);
export const ExpertServiceSchema = z.enum(EXPERT_SERVICES);
export const OrderStatusSchema = z.enum(ORDER_STATUSES);

export const WeeklyWindowSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{1,2}:\d{2}$/),
  end: z.string().regex(/^\d{1,2}:\d{2}$/),
});

/** What anyone sees about an expert. */
export const ExpertSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  headline: z.string(),
  bio: z.string(),
  photoUrl: z.string().nullable(),
  specialties: z.array(z.string()),
  languages: z.array(z.string()),
  services: z.array(ExpertServiceSchema),
  timezone: z.string(),
  ratingAvg: z.number(),
  ratingCount: z.number(),
});
export type ExpertDto = z.output<typeof ExpertSchema>;

/** The expert's own profile, with status and payouts. */
export const MyExpertProfileSchema = ExpertSchema.extend({
  status: z.enum(["pending", "approved", "suspended"]),
  availability: z.array(WeeklyWindowSchema),
  maxActiveOrders: z.number(),
  payoutsConnected: z.boolean(),
  payoutsEnabled: z.boolean(),
  payoutsAvailable: z.boolean(),
  approvedAt: iso.nullable(),
});
export type MyExpertProfileDto = z.output<typeof MyExpertProfileSchema>;

export const ExpertProfileBodySchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  headline: z.string().trim().max(160).default(""),
  bio: z.string().trim().max(3000).default(""),
  photoUrl: z.url().max(500).nullable().default(null),
  specialties: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  services: z.array(ExpertServiceSchema).min(1).max(4),
  timezone: z.string().trim().min(1).max(60).default("UTC"),
  availability: z.array(WeeklyWindowSchema).max(30).default([]),
  maxActiveOrders: z.number().int().min(1).max(50).default(5),
});
export type ExpertProfileBodyDto = z.output<typeof ExpertProfileBodySchema>;

export const ExpertStatusSchema = z.object({ status: z.enum(["approved", "suspended", "pending"]) });

export const ServiceInfoSchema = z.object({
  kind: ServiceKindSchema,
  service: ExpertServiceSchema,
  name: z.string(),
  description: z.string(),
  priceCents: z.number(),
  turnaroundHours: z.number().nullable(),
  revisions: z.number(),
  needsResume: z.boolean(),
  intake: z.array(z.object({ key: z.string(), label: z.string(), required: z.boolean(), long: z.boolean().optional() })),
});
export type ServiceInfoDto = z.output<typeof ServiceInfoSchema>;

export const CreateOrderSchema = z.object({
  kind: ServiceKindSchema,
  /** A specific expert, or any available one. */
  expertId: z.string().max(64).optional(),
  resumeId: z.string().max(64).optional(),
  intake: z.record(z.string().max(40), z.string().max(4000)).default({}),
  /** Coaching: the chosen start (UTC ISO) and length. */
  scheduledAt: z.iso.datetime().optional(),
  durationMin: z.union([z.literal(45), z.literal(60)]).optional(),
});
export type CreateOrderDto = z.output<typeof CreateOrderSchema>;

export const OrderMessageSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  mine: z.boolean(),
  body: z.string(),
  createdAt: iso,
});
export type OrderMessageDto = z.output<typeof OrderMessageSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  kind: ServiceKindSchema,
  name: z.string(),
  status: OrderStatusSchema,
  /** "buyer", "expert" or "admin": what the viewer may do. */
  viewerRole: z.enum(["buyer", "expert", "admin"]),
  buyer: z.object({ id: z.string(), name: z.string() }),
  expert: z.object({ userId: z.string(), displayName: z.string(), photoUrl: z.string().nullable() }).nullable(),
  resumeId: z.string().nullable(),
  resumeTitle: z.string().nullable(),
  priceCents: z.number(),
  currency: z.string(),
  /** The expert's share, shown to the expert and admins. */
  expertCents: z.number().nullable(),
  included: z.boolean(),
  intake: z.record(z.string(), z.string()),
  dueAt: iso.nullable(),
  scheduledAt: iso.nullable(),
  durationMin: z.number().nullable(),
  meetingUrl: z.string().nullable(),
  calendarUrl: z.string().nullable(),
  deliveryNote: z.string(),
  revisionsIncluded: z.number(),
  revisionsUsed: z.number(),
  rating: z.number().nullable(),
  ratingComment: z.string(),
  refundReason: z.string(),
  dispute: z.object({ reason: z.string(), openedAt: iso, resolution: z.string().optional(), resolvedAt: iso.optional() }).nullable(),
  paidOut: z.boolean(),
  paidAt: iso.nullable(),
  deliveredAt: iso.nullable(),
  completedAt: iso.nullable(),
  createdAt: iso,
});
export type OrderDto = z.output<typeof OrderSchema>;

export const CreatedOrderSchema = z.object({ order: OrderSchema, checkoutUrl: z.string().nullable() });
export type CreatedOrderDto = z.output<typeof CreatedOrderSchema>;

export const PostMessageSchema = z.object({ body: z.string().trim().min(1).max(8000) });
export const DeliverSchema = z.object({ note: z.string().trim().min(1).max(10_000) });
export const SessionNotesSchema = z.object({ notes: z.string().trim().max(10_000) });
export const CompleteOrderSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).default("") });
export const RevisionSchema = z.object({ request: z.string().trim().min(3).max(4000) });
export const DisputeSchema = z.object({ reason: z.string().trim().min(10).max(4000) });
export const RefundSchema = z.object({ amountCents: z.number().int().positive().optional(), reason: z.string().trim().min(3).max(1000) });
export const ResolveDisputeSchema = z.object({
  outcome: z.enum(["refund", "release", "rework"]),
  amountCents: z.number().int().positive().optional(),
  note: z.string().trim().min(3).max(2000),
});
export type ResolveDisputeDto = z.output<typeof ResolveDisputeSchema>;

// ─── Review comments ─────────────────────────────────────────────

export const CommentSchema = z.object({
  id: z.string(),
  resumeId: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  /** expert | reviewer | owner */
  authorRole: z.string(),
  anchor: z.string(),
  quote: z.string(),
  body: z.string(),
  suggestion: z.string().nullable(),
  /** The line changed since the comment was made. */
  outdated: z.boolean(),
  resolvedAt: iso.nullable(),
  createdAt: iso,
});
export type CommentDto = z.output<typeof CommentSchema>;

export const CreateCommentSchema = z.object({
  anchor: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  suggestion: z.string().trim().max(2000).optional(),
});
export type CreateCommentDto = z.output<typeof CreateCommentSchema>;

/** A CV opened for review by an expert or a career-office reviewer (read-only). */
export const ReviewResumeSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerName: z.string(),
  role: z.enum(["owner", "expert", "org-reviewer"]),
  templateId: z.string(),
  accent: z.string().nullable(),
  pageSize: PageSizeSchema,
  data: ResumeDataSchema,
  orderId: z.string().nullable(),
});
export type ReviewResumeDto = z.output<typeof ReviewResumeSchema>;
