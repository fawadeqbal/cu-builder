import { UpdateMeSchema, type UpdateMeDto } from "@cvb/contracts";
import { Body, Controller, Get, Header, Inject, Patch } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, OptionalUser, Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { authProviders } from "../auth/better-auth.js";
import { UsersService } from "./users.service.js";

@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user);
  }

  @Patch("me")
  update(@CurrentUser() user: AuthUser, @Body(new ZodPipe(UpdateMeSchema)) dto: UpdateMeDto) {
    return this.users.updateMe(user, dto);
  }

  /** Who is signed in, or `{ user: null }` (the web app asks this on every page, so no 401 noise). */
  @Public()
  @Get("session")
  async session(@OptionalUser() user: AuthUser | undefined) {
    return { user: user ? await this.users.me(user) : null };
  }

  /** All of the user's data as one JSON file. */
  @Get("me/export")
  @Header("content-disposition", 'attachment; filename="cv-builder-export.json"')
  exportData(@CurrentUser() user: AuthUser) {
    return this.users.exportData(user);
  }

  /** Which sign-in buttons the web app should show. */
  @Public()
  @Get("auth-providers")
  providers() {
    return authProviders(this.config);
  }
}
