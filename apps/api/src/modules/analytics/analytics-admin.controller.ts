import { AnalyticsQuerySchema, type AnalyticsQuery } from "@cvb/contracts";
import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { AnalyticsReportsService } from "./analytics-reports.service.js";

/** Analytics reports for the admin console. Every route takes the same range, compare and filter query. */
@Roles("admin")
@Controller("admin/analytics")
export class AnalyticsAdminController {
  constructor(private readonly reports: AnalyticsReportsService) {}

  @Get("overview")
  overview(@Query(new ZodPipe(AnalyticsQuerySchema)) q: AnalyticsQuery) {
    return this.reports.overview(q);
  }

  @Get("funnel")
  funnel(@Query(new ZodPipe(AnalyticsQuerySchema)) q: AnalyticsQuery) {
    return this.reports.funnel(q);
  }

  @Get("acquisition")
  acquisition(@Query(new ZodPipe(AnalyticsQuerySchema)) q: AnalyticsQuery) {
    return this.reports.acquisition(q);
  }

  @Get("revenue")
  revenue(@Query(new ZodPipe(AnalyticsQuerySchema)) q: AnalyticsQuery) {
    return this.reports.revenue(q);
  }

  @Get("usage")
  usage(@Query(new ZodPipe(AnalyticsQuerySchema)) q: AnalyticsQuery) {
    return this.reports.usage(q);
  }
}
