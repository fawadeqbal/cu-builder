import { BrandingSchema, CustomDomainSchema, IdParamSchema, type BrandingDto } from "@cvb/contracts";
import { NotFoundError } from "@cvb/shared";
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { DomainsService } from "./domains.service.js";

@Controller()
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  /** Caddy on-demand TLS `ask`: 200 to issue a certificate for `domain`, anything else to refuse. */
  @Public()
  @Get("public/domains/allowed")
  async allowed(@Query("domain") domain = "") {
    if (!(await this.domains.allowed(domain.slice(0, 253)))) throw new NotFoundError("Domain", domain.slice(0, 253));
    return { ok: true };
  }

  /** For the web proxy: what a host serves. */
  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Get("public/domains/resolve")
  resolve(@Query("host") host = "") {
    return this.domains.resolveHost(host.slice(0, 253));
  }

  /** A partner's branding for the host the app is opened on. */
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get("public/branding")
  async branding(@Query("host") host = "") {
    return { branding: await this.domains.publicBranding(host.slice(0, 253)) };
  }

  @Get("orgs/:id/branding")
  get(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.domains.orgBranding(user, id);
  }

  @Put("orgs/:id/branding")
  save(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(BrandingSchema)) dto: BrandingDto) {
    return this.domains.saveOrgBranding(user, id, dto);
  }

  @Put("orgs/:id/branding/domain")
  setDomain(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(CustomDomainSchema)) { domain }: { domain: string | null }) {
    return this.domains.setOrgDomain(user, id, domain);
  }

  @Post("orgs/:id/branding/domain/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.domains.verifyOrgDomain(user, id);
  }
}
