import { ApiError, type Api } from "./api";
import type { ExtractedJob } from "./types";

/**
 * "Tailor my CV for this job": the job is saved to the person's saved jobs, then the web app's
 * Jobs page opens on it and starts the usual tailoring review for the chosen CV (nothing changes
 * until they accept changes and create the tailored copy).
 */
export function tailorUrl(appUrl: string, jobId: string, resumeId: string): string {
  const q = new URLSearchParams({ tab: "saved", job: jobId, resume: resumeId, tailor: "1" });
  return `${appUrl}/jobs?${q.toString()}`;
}

export type TailorProblem = "no-title" | "no-description" | "no-cv";

/** What stops tailoring before anything is sent, with the words to show. */
export function tailorProblem(job: ExtractedJob, resumeId: string): { problem: TailorProblem; text: string } | null {
  if (!resumeId) return { problem: "no-cv", text: "Create a CV in CV Builder first, then pick it here." };
  if (!job.title.trim()) return { problem: "no-title", text: "Add the job title first." };
  if (job.description.trim().length < 80) return { problem: "no-description", text: "Tailoring needs the job description. Paste it under Description." };
  return null;
}

/** Saves the job and returns the page that starts tailoring the chosen CV for it. */
export async function startTailoring(api: Pick<Api, "createJob">, appUrl: string, job: ExtractedJob, resumeId: string): Promise<string> {
  const problem = tailorProblem(job, resumeId);
  if (problem) throw new ApiError(0, "INVALID", problem.text);
  const saved = await api.createJob(job);
  return tailorUrl(appUrl, saved.id, resumeId);
}
