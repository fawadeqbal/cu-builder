import { loadEnv, WorkerEnvSchema, type WorkerEnv } from "@cvb/config";
import { Global, Module } from "@nestjs/common";

export const WORKER_CONFIG = Symbol.for("cvb.worker.Config");
export type WorkerConfig = WorkerEnv;

@Global()
@Module({
  providers: [{ provide: WORKER_CONFIG, useFactory: (): WorkerConfig => loadEnv(WorkerEnvSchema) }],
  exports: [WORKER_CONFIG],
})
export class WorkerConfigModule {}
