import {
  ContactFormSchema,
  CustomDomainSchema,
  IdParamSchema,
  SavePortfolioSchema,
  type ContactFormDto,
  type SavePortfolioDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { PortfolioService } from "./portfolio.service.js";

const ReadSchema = z.object({ read: z.boolean() });

@Controller()
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get("portfolio")
  mine(@CurrentUser() user: AuthUser) {
    return this.portfolio.mine(user);
  }

  @Put("portfolio")
  save(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SavePortfolioSchema)) dto: SavePortfolioDto) {
    return this.portfolio.save(user, dto);
  }

  @Delete("portfolio")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.portfolio.remove(user);
  }

  @Put("portfolio/domain")
  setDomain(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CustomDomainSchema)) { domain }: { domain: string | null }) {
    return this.portfolio.setDomain(user, domain);
  }

  @Post("portfolio/domain/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@CurrentUser() user: AuthUser) {
    return this.portfolio.verifyDomain(user);
  }

  @Get("portfolio/messages")
  messages(@CurrentUser() user: AuthUser) {
    return this.portfolio.messages(user);
  }

  @Patch("portfolio/messages/:id")
  @HttpCode(204)
  async read(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(ReadSchema)) { read }: { read: boolean }) {
    await this.portfolio.markRead(user, id, read);
  }

  @Delete("portfolio/messages/:id")
  @HttpCode(204)
  async deleteMessage(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    await this.portfolio.deleteMessage(user, id);
  }

  /** `count=false` for look-ups that aren't visits (page metadata). */
  @Public()
  @Get("public/sites/by-host")
  byHost(@Query("host") host = "", @Query("count") count?: string) {
    return this.portfolio.publicByHost(host.slice(0, 253), count !== "false");
  }

  @Public()
  @Get("public/sites/:slug")
  view(@Param("slug") slug: string, @Query("count") count?: string) {
    return this.portfolio.publicBySlug(slug.slice(0, 60), count !== "false");
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("public/sites/:slug/contact")
  @HttpCode(204)
  async contact(@Param("slug") slug: string, @Body(new ZodPipe(ContactFormSchema)) dto: ContactFormDto) {
    await this.portfolio.contact(slug.slice(0, 60), dto);
  }
}
