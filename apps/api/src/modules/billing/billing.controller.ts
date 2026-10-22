import { CheckoutSchema, type CheckoutDto } from "@cvb/contracts";
import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { BillingService } from "./billing.service.js";

@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get("offers")
  offers() {
    return this.billing.offers();
  }

  @Get("status")
  status(@CurrentUser() user: AuthUser) {
    return this.billing.status(user);
  }

  @Post("checkout")
  checkout(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CheckoutSchema)) dto: CheckoutDto) {
    return this.billing.checkout(user, dto.offer, dto.provider);
  }

  @Post("portal")
  portal(@CurrentUser() user: AuthUser) {
    return this.billing.portal(user);
  }

  /** Raw body (see main.ts) so the provider signature can be verified. */
  @Public()
  @Post("webhooks/:provider")
  @HttpCode(200)
  async webhook(
    @Param("provider") provider: string,
    @Req() req: Request,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    await this.billing.handleWebhook(provider === "local" ? "local" : "stripe", req.body as Buffer, signature);
    return { received: true };
  }
}
