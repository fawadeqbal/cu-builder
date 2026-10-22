import { QUEUES } from "@cvb/contracts";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { InjectQueue, Processor } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { ConfiguredWorkerHost } from "../common/configured-worker-host.js";
import { MAINTENANCE_STORE, type MaintenanceStore } from "./maintenance.store.js";

const DAY = 24 * 3600 * 1000;
export const TRASH_DAYS = 30;
export const UPLOAD_DAYS = 7;

/** Runs once a day: keeps the promise that the trash empties after 30 days, and that uploads aren't kept. */
@Processor(QUEUES.maintenance)
export class MaintenanceProcessor extends ConfiguredWorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    @Inject(MAINTENANCE_STORE) private readonly store: MaintenanceStore,
    @Inject(FILE_STORAGE) private readonly files: FileStorage,
    @InjectQueue(QUEUES.maintenance) private readonly queue: Queue,
  ) {
    super();
  }

  /** Registers the daily schedule (idempotent: every worker upserts the same scheduler). */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler("daily-purge", { pattern: "17 3 * * *" }, { name: "purge", data: {} });
  }

  process(_job: Job): Promise<{ resumes: number; files: number; tokens: number }> {
    return this.purge(new Date());
  }

  async purge(now: Date): Promise<{ resumes: number; files: number; tokens: number }> {
    const resumes = await this.store.purgeTrash(new Date(now.getTime() - TRASH_DAYS * DAY));
    let files = 0;
    for (const item of await this.store.oldImportFiles(new Date(now.getTime() - UPLOAD_DAYS * DAY))) {
      await this.files.delete(item.fileKey).catch(() => undefined);
      await this.store.forgetImportFile(item.id);
      files++;
    }
    const tokens = await this.store.purgeExpiredTokens(now);
    this.logger.log(`Purged ${resumes} trashed CVs, ${files} upload files, ${tokens} expired tokens`);
    return { resumes, files, tokens };
  }
}
