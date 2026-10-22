export type JobRecord = {
  id: string;
  userId: string;
  title: string;
  company: string;
  location: string;
  url: string | null;
  description: string;
  source: "manual" | "link" | "extension" | "feed";
  salary: string;
  remote: boolean;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewJob = Omit<JobRecord, "id" | "createdAt" | "updatedAt" | "salary" | "remote" | "externalId"> &
  Partial<Pick<JobRecord, "salary" | "remote" | "externalId">>;
export type JobPatch = Partial<Pick<JobRecord, "title" | "company" | "location" | "url" | "description" | "salary" | "remote">>;

/** Persistence port for the jobs a user targets. */
export interface JobsRepository {
  list(userId: string): Promise<JobRecord[]>;
  findOwned(id: string, userId: string): Promise<JobRecord | null>;
  /** The user's job with this URL, to avoid saving the same posting twice. */
  findByUrl(userId: string, url: string): Promise<JobRecord | null>;
  findByExternalId(userId: string, externalId: string): Promise<JobRecord | null>;
  create(input: NewJob): Promise<JobRecord>;
  update(id: string, patch: JobPatch): Promise<JobRecord>;
  softDelete(id: string): Promise<void>;
  saveMatch(input: { userId: string; resumeId: string; jobId: string; score: number; result: unknown }): Promise<void>;
}

export const JOBS_REPOSITORY = Symbol.for("cvb.api.JobsRepository");
