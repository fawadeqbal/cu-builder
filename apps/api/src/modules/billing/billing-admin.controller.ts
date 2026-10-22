import { PriceParamsSchema, UpdatePriceSchema, type PriceParams, type UpdatePriceDto } from "@cvb/contracts";
import { Body, Controller, Delete, Get, Param, Put } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Roles } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { BillingService } from "./billing.service.js";

/** Admin: offer prices per currency (overrides of the defaults in @cvb/domain). */
@Roles("admin")
@Controller("admin/prices")
export class BillingAdminController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  list() {
    return this.billing.priceSettings();
  }

  @Put(":offer/:currency")
  set(
    @CurrentUser() actor: AuthUser,
    @Param(new ZodPipe(PriceParamsSchema)) { offer, currency }: PriceParams,
    @Body(new ZodPipe(UpdatePriceSchema)) dto: UpdatePriceDto,
  ) {
    return this.billing.setPrice(actor, offer, currency, dto.amount);
  }

  /** Back to the default price. */
  @Delete(":offer/:currency")
  reset(@CurrentUser() actor: AuthUser, @Param(new ZodPipe(PriceParamsSchema)) { offer, currency }: PriceParams) {
    return this.billing.resetPrice(actor, offer, currency);
  }
}
