import { z } from "zod";

export const InterviewQuestionSchema = z.object({ question: z.string(), competency: z.string(), tip: z.string() });

export const StartInterviewSchema = z.object({
  role: z.string().trim().min(1).max(120),
  seniority: z.enum(["entry", "mid", "senior", "lead"]).default("mid"),
  jobId: z.string().optional(),
  count: z.number().int().min(3).max(15).default(10),
});
export type StartInterviewDto = z.output<typeof StartInterviewSchema>;

export const AnswerQuestionSchema = z.object({ index: z.number().int().min(0).max(20), answer: z.string().trim().min(1).max(6000) });
export type AnswerQuestionDto = z.output<typeof AnswerQuestionSchema>;

export const ScoredAnswerSchema = z.object({
  index: z.number(),
  answer: z.string(),
  scores: z.object({ structure: z.number(), relevance: z.number(), clarity: z.number() }),
  feedback: z.string(),
  improved: z.string(),
});

export const InterviewSessionSchema = z.object({
  id: z.string(),
  role: z.string(),
  seniority: z.string(),
  jobId: z.string().nullable(),
  questions: z.array(InterviewQuestionSchema),
  answers: z.array(ScoredAnswerSchema),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type InterviewSessionDto = z.output<typeof InterviewSessionSchema>;

export const StarStoryBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  situation: z.string().max(3000).default(""),
  task: z.string().max(3000).default(""),
  action: z.string().max(3000).default(""),
  result: z.string().max(3000).default(""),
  sourceBullet: z.string().max(600).default(""),
  tags: z.array(z.string().max(40)).max(10).default([]),
});
export type StarStoryBodyDto = z.output<typeof StarStoryBodySchema>;

export const StarStorySchema = StarStoryBodySchema.extend({ id: z.string(), createdAt: z.string(), updatedAt: z.string() });
export type StarStoryDto = z.output<typeof StarStorySchema>;

export const StarFromBulletSchema = z.object({ bullet: z.string().trim().min(3).max(600), role: z.string().max(160).default(""), company: z.string().max(160).default("") });

export const CompanyBriefSchema = z.object({ questionsToAsk: z.array(z.string()), themes: z.array(z.string()) });
