import { Module } from "@nestjs/common";
import { DomainsModule } from "../domains/domains.module.js";
import { PortfolioController } from "./portfolio.controller.js";
import { PortfolioService } from "./portfolio.service.js";

@Module({ imports: [DomainsModule], controllers: [PortfolioController], providers: [PortfolioService] })
export class PortfolioModule {}
