import { WorkerHost } from "@nestjs/bullmq";
import { Inject, type OnApplicationBootstrap } from "@nestjs/common";
import { WORKER_CONFIG, type WorkerConfig } from "../config/worker-config.js";

/** Base for every processor: applies WORKER_CONCURRENCY from config once the worker starts. */
export abstract class ConfiguredWorkerHost extends WorkerHost implements OnApplicationBootstrap {
  @Inject(WORKER_CONFIG) protected readonly config!: WorkerConfig;

  onApplicationBootstrap(): void {
    this.worker.concurrency = this.config.WORKER_CONCURRENCY;
  }
}
