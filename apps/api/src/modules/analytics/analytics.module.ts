import { Global, Module } from "@nestjs/common";
import { AnalyticsAdminController } from "./analytics-admin.controller.js";
import { ANALYTICS_EVENTS_REPOSITORY } from "./analytics-events.repository.js";
import { ANALYTICS_RECORDER } from "./analytics-recorder.js";
import { ANALYTICS_REPORTS_REPOSITORY } from "./analytics-reports.repository.js";
import { AnalyticsReportsService } from "./analytics-reports.service.js";
import { AnalyticsController } from "./analytics.controller.js";
import { AnalyticsService } from "./analytics.service.js";
import { PrismaAnalyticsEventsRepository } from "./prisma-analytics-events.repository.js";
import { PrismaAnalyticsReportsRepository } from "./prisma-analytics-reports.repository.js";

/** First-party analytics: event ingestion, identity stitching, server-side events and the admin reports. */
@Global()
@Module({
  controllers: [AnalyticsController, AnalyticsAdminController],
  providers: [
    AnalyticsService,
    AnalyticsReportsService,
    { provide: ANALYTICS_EVENTS_REPOSITORY, useClass: PrismaAnalyticsEventsRepository },
    { provide: ANALYTICS_REPORTS_REPOSITORY, useClass: PrismaAnalyticsReportsRepository },
    { provide: ANALYTICS_RECORDER, useExisting: AnalyticsService },
  ],
  exports: [ANALYTICS_RECORDER],
})
export class AnalyticsModule {}
