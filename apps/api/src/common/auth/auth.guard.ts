import { UnauthenticatedError } from "@cvb/shared";
import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { UsersService } from "../../modules/users/users.service.js";
import { IS_PUBLIC } from "./decorators.js";

/**
 * Runs on every route unless marked @Public().
 *
 * PHASE 1 PLACEHOLDER: until real sign-in ships, development requests identify themselves
 * with an `x-dev-user: <email>` header. This only works when DEV_AUTH=true and never in
 * production, where every protected request is refused.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const devEmail = req.header("x-dev-user");
    const devAuthAllowed = this.config.DEV_AUTH && this.config.NODE_ENV !== "production";

    if (devAuthAllowed && devEmail) {
      req.user = await this.users.findOrCreateByEmail(devEmail);
      return true;
    }
    throw new UnauthenticatedError();
  }
}
