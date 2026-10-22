import { Controller, Get, Header } from "@nestjs/common";
import { Public } from "../../common/auth/decorators.js";
import { PublicStatsService } from "./public-stats.service.js";

@Controller("public/stats")
export class PublicStatsController {
  constructor(private readonly stats: PublicStatsService) {}

  @Public()
  @Get()
  @Header("cache-control", "public, max-age=600")
  get() {
    return this.stats.get();
  }
}
