import { FILE_STORAGE, LocalDiskStorage } from "@cvb/storage";
import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/app-config.js";

/** Local disk today (a volume shared with the worker); swap for S3 by changing this provider. */
@Global()
@Module({
  providers: [
    { provide: FILE_STORAGE, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new LocalDiskStorage(config.STORAGE_DIR) },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
