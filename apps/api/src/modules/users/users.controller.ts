import { Controller, Get } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { UsersService } from "./users.service.js";

@Controller("me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() user: AuthUser) {
    const record = await this.users.get(user.id);
    return { id: record.id, email: record.email, name: record.name, plan: record.plan };
  }
}
