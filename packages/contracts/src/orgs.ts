import { z } from "zod";
import { PlanSchema } from "./billing";
import { ResumeDataSchema } from "./resume";

export const OrgKindSchema = z.enum(["university", "agency", "partner"]);
export const OrgRoleSchema = z.enum(["owner", "admin", "reviewer", "recruiter", "member"]);
export type OrgRoleDto = z.output<typeof OrgRoleSchema>;

export const OrgBrandSchema = z.object({
  productName: z.string().trim().max(60).optional(),
  logoUrl: z.string().trim().max(500_000).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  templateIds: z.array(z.string().max(40)).max(20).optional(),
  hideBrand: z.boolean().optional(),
});
export type OrgBrandDto = z.output<typeof OrgBrandSchema>;

export const CreateOrgSchema = z.object({ name: z.string().trim().min(2).max(120), kind: OrgKindSchema });
export type CreateOrgDto = z.output<typeof CreateOrgSchema>;

export const UpdateOrgSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    ssoDomains: z.array(z.string().trim().max(120)).max(10),
    defaultTemplateId: z.string().max(40).nullable(),
    /** The agency's name and logo above formatted CVs. */
    brandName: z.string().trim().max(80),
    brandLogoUrl: z.string().trim().max(500_000),
  })
  .partial();
export type UpdateOrgDto = z.output<typeof UpdateOrgSchema>;

export const OrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  kind: OrgKindSchema,
  seats: z.number(),
  seatsUsed: z.number(),
  seatPlan: PlanSchema,
  inviteCode: z.string(),
  ssoDomains: z.array(z.string()),
  defaultTemplateId: z.string().nullable(),
  branding: OrgBrandSchema,
  /** The caller's role (null for site admins looking in). */
  role: OrgRoleSchema.nullable(),
  createdAt: z.string(),
});
export type OrgDto = z.output<typeof OrgSchema>;

export const MemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: OrgRoleSchema,
  cohort: z.string(),
  seat: z.boolean(),
  createdAt: z.string(),
});
export type MemberDto = z.output<typeof MemberSchema>;

export const UpdateMemberSchema = z.object({ role: OrgRoleSchema, cohort: z.string().trim().max(80), seat: z.boolean() }).partial();
export type UpdateMemberDto = z.output<typeof UpdateMemberSchema>;

export const InviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: OrgRoleSchema,
  cohort: z.string(),
  acceptedAt: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type InviteDto = z.output<typeof InviteSchema>;

export const CreateInviteSchema = z.object({
  email: z.email().max(200),
  role: OrgRoleSchema.exclude(["owner"]).default("member"),
  cohort: z.string().trim().max(80).default(""),
});
export type CreateInviteDto = z.output<typeof CreateInviteSchema>;

/** A CSV pasted or read from a file in the browser. */
export const BulkInviteSchema = z.object({ csv: z.string().max(500_000), dryRun: z.boolean().default(false) });
export const BulkInviteResultSchema = z.object({
  invited: z.number(),
  skipped: z.array(z.object({ line: z.number(), email: z.string(), reason: z.string() })),
  errors: z.array(z.object({ line: z.number(), message: z.string() })),
  rows: z.array(z.object({ line: z.number(), email: z.string(), role: OrgRoleSchema, cohort: z.string() })),
});
export type BulkInviteResultDto = z.output<typeof BulkInviteResultSchema>;

/** What /join/<code> and /join/<token> show before joining. */
export const JoinPreviewSchema = z.object({
  orgName: z.string(),
  kind: OrgKindSchema,
  role: OrgRoleSchema,
  seatsLeft: z.number(),
  logoUrl: z.string().nullable(),
  invitedEmail: z.string().nullable(),
  alreadyMember: z.boolean(),
});
export type JoinPreviewDto = z.output<typeof JoinPreviewSchema>;

export const StudentRowSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  cohort: z.string(),
  cvs: z.number(),
  bestResumeId: z.string().nullable(),
  bestAts: z.number().nullable(),
  applications: z.number(),
  interviews: z.number(),
  offers: z.number(),
  placed: z.boolean(),
  lastActiveAt: z.string().nullable(),
});
export type StudentRowDto = z.output<typeof StudentRowSchema>;

export const CohortSchema = z.object({
  metrics: z.object({
    students: z.number(),
    withCv: z.number(),
    withCvPct: z.number(),
    avgAts: z.number().nullable(),
    applications: z.number(),
    interviews: z.number(),
    offers: z.number(),
    placed: z.number(),
    placedPct: z.number(),
    active30: z.number(),
  }),
  cohorts: z.array(z.string()),
  rows: z.array(StudentRowSchema),
});
export type CohortDto = z.output<typeof CohortSchema>;

// ─── Agencies ───────────────────────────────────────────────────────────────

export const CANDIDATE_BATCH_MAX = 50;

export const LowConfidenceSchema = z.object({ path: z.string(), label: z.string(), reason: z.string() });

export const CandidateSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  name: z.string(),
  status: z.enum(["queued", "parsing", "ready", "failed"]),
  fileName: z.string(),
  data: ResumeDataSchema.nullable(),
  lowConfidence: z.array(LowConfidenceSchema),
  hideContacts: z.boolean(),
  templateId: z.string().nullable(),
  error: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CandidateDto = z.output<typeof CandidateSchema>;

export const UpdateCandidateSchema = z
  .object({
    data: ResumeDataSchema,
    hideContacts: z.boolean(),
    templateId: z.string().max(40).nullable(),
    /** Mark the flagged fields as checked. */
    clearFlags: z.boolean(),
  })
  .partial();
export type UpdateCandidateDto = z.output<typeof UpdateCandidateSchema>;

export const CandidateUploadResultSchema = z.object({
  batchId: z.string(),
  accepted: z.array(CandidateSchema),
  rejected: z.array(z.object({ fileName: z.string(), reason: z.string() })),
});
export type CandidateUploadResultDto = z.output<typeof CandidateUploadResultSchema>;

// ─── Site admin ─────────────────────────────────────────────────────────────

export const AdminOrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: OrgKindSchema,
  seats: z.number(),
  seatsUsed: z.number(),
  seatPlan: PlanSchema,
  members: z.number(),
  createdAt: z.string(),
});
export type AdminOrgDto = z.output<typeof AdminOrgSchema>;

export const AdminUpdateOrgSchema = z.object({ seats: z.number().int().min(0).max(100_000), seatPlan: PlanSchema, kind: OrgKindSchema }).partial();
export type AdminUpdateOrgDto = z.output<typeof AdminUpdateOrgSchema>;
