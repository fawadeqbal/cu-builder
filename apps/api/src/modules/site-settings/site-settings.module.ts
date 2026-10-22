import { Module } from "@nestjs/common";
import { PrismaSiteSettingsRepository } from "./prisma-site-settings.repository.js";
import { SiteSettingsController } from "./site-settings.controller.js";
import { SITE_SETTINGS_REPOSITORY, type SiteSettingsRepository } from "./site-settings.repository.js";
import { SiteSettingsService } from "./site-settings.service.js";

@Module({
  controllers: [SiteSettingsController],
  providers: [
    { provide: SITE_SETTINGS_REPOSITORY, useClass: PrismaSiteSettingsRepository },
    {
      provide: SiteSettingsService,
      inject: [SITE_SETTINGS_REPOSITORY],
      useFactory: (repo: SiteSettingsRepository) => new SiteSettingsService(repo),
    },
  ],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
