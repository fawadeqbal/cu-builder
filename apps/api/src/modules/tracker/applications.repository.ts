import type { ApplicationDto, BoardDto, ReminderDto, UpdateApplicationDto } from "@cvb/contracts";
import type { ReminderPlan } from "@cvb/domain";
import type { NewJob } from "../jobs/jobs.repository.js";

export type ApplicationRecord = ApplicationDto & { userId: string; jobId: string };

export type ApplicationPatch = Omit<UpdateApplicationDto, "archived" | "appliedAt" | "interviewAt" | "deadlineAt"> & {
  archivedAt?: Date | null;
  appliedAt?: Date | null;
  interviewAt?: Date | null;
  deadlineAt?: Date | null;
  position?: number;
};

/** Persistence port for the tracker: applications, the board's columns and reminders. */
export interface ApplicationsRepository {
  list(userId: string, archived: boolean): Promise<ApplicationRecord[]>;
  findOwned(id: string, userId: string): Promise<ApplicationRecord | null>;
  countActive(userId: string): Promise<number>;
  /** Highest position in a column, to append a card at the end. */
  lastPosition(userId: string, status: string): Promise<number | null>;
  positionOf(id: string, userId: string): Promise<number | null>;
  existsForJob(userId: string, jobId: string): Promise<string | null>;
  create(input: { userId: string; jobId: string; status: string; position: number; resumeId: string | null; appliedAt: Date | null }): Promise<ApplicationRecord>;
  /** Creates the job and the application together (extension, feed). */
  createWithJob(job: NewJob & { externalId?: string | null; salary?: string; remote?: boolean }, app: { status: string; position: number; resumeId: string | null }): Promise<ApplicationRecord>;
  update(id: string, patch: ApplicationPatch): Promise<ApplicationRecord>;
  delete(id: string): Promise<void>;

  board(userId: string): Promise<BoardDto | null>;
  saveBoard(userId: string, board: BoardDto): Promise<void>;
  /** Moves every card of a removed column into another one. */
  moveColumn(userId: string, from: string, to: string): Promise<void>;

  /** Replaces the automatic (not yet done) reminders of an application. */
  syncAutoReminders(userId: string, applicationId: string, plans: ReminderPlan[]): Promise<void>;
  reminders(userId: string, from: Date, to: Date): Promise<ReminderDto[]>;
  createReminder(input: { userId: string; title: string; dueAt: Date; applicationId: string | null }): Promise<ReminderDto>;
  setReminderDone(id: string, userId: string, done: boolean): Promise<ReminderDto | null>;
  deleteReminder(id: string, userId: string): Promise<boolean>;
}

export const APPLICATIONS_REPOSITORY = Symbol.for("cvb.api.ApplicationsRepository");
