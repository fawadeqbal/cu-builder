import { CreateApiTokenSchema, IdParamSchema } from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { ApiTokensService } from "./api-tokens.service.js";

@Controller("tokens")
export class ApiTokensController {
  constructor(private readonly tokens: ApiTokensService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tokens.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateApiTokenSchema)) { name }: { name: string }) {
    return this.tokens.create(user, name);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.tokens.remove(user, id);
  }
}
