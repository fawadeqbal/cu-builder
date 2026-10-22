import { FILE_STORAGE, LocalDiskStorage } from "@cvb/storage";
import { Module } from "@nestjs/common";
import { WORKER_CONFIG, type WorkerConfig } from "../config/worker-config.js";
import { MaintenanceProcessor } from "./maintenance.processor.js";
import { MAINTENANCE_STORE, PrismaMaintenanceStore } from "./maintenance.store.js";

@Module({
  providers: [
    MaintenanceProcessor,
    { provide: MAINTENANCE_STORE, useClass: PrismaMaintenanceStore },
    { provide: FILE_STORAGE, inject: [WORKER_CONFIG], useFactory: (c: WorkerConfig) => new LocalDiskStorage(c.STORAGE_DIR) },
  ],
})
export class MaintenanceModule {}
