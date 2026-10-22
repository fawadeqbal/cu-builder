import { ForbiddenError, UnauthenticatedError } from "@cvb/shared";
import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { AUTH, type BetterAuth } from "../../modules/auth/better-auth.js";
import { EntitlementsService } from "../../modules/billing/entitlements.service.js";
import { ApiTokensService } from "../../modules/tokens/api-tokens.service.js";
import { UsersService } from "../../modules/users/users.service.js";
import type { AuthUser, Role } from "./auth.types.js";
import { IS_PUBLIC, ROLES } from "./decorators.js";

/**
 * Global guard. Resolves the signed-in user from the Better Auth session cookie, adds their
 * effective plan, and enforces @Roles(). On @Public() routes it still attaches the user when
 * there is one, so public endpoints can personalise.
 *
 * Browser extension: a personal access token in `Authorization: Bearer cvb_…`.
 *
 * Development only: with DEV_AUTH=true (never in production) an `x-dev-user: <email>` header
 * signs in as that user, which keeps API testing with curl simple.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(AUTH) private readonly auth: BetterAuth,
    private readonly users: UsersService,
    private readonly entitlements: EntitlementsService,
    private readonly tokens: ApiTokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    const req = context.switchToHttp().getRequest<Request>();

    req.user = await this.resolve(req);
    if (isPublic) return true;
    if (!req.user) throw new UnauthenticatedError();
    if (roles?.length && !roles.includes(req.user.role)) throw new ForbiddenError();
    return true;
  }

  private async resolve(req: Request): Promise<AuthUser | undefined> {
    const devEmail = req.header("x-dev-user");
    if (devEmail && this.config.DEV_AUTH && this.config.NODE_ENV !== "production") {
      const base = await this.users.findOrCreateByEmail(devEmail);
      return this.withPlan(base);
    }

    // Personal access tokens (the browser extension): "Authorization: Bearer cvb_…".
    const bearer = req.header("authorization")?.match(/^Bearer (cvb_[\w-]+)$/)?.[1];
    if (bearer) {
      const userId = await this.tokens.resolve(bearer);
      const u = userId ? await this.users.get(userId).catch(() => null) : null;
      return u ? this.withPlan({ id: u.id, email: u.email, name: u.name, emailVerified: u.emailVerified, role: u.role }) : undefined;
    }

    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return undefined;
    // Role and profile come from the database, not the session cookie cache, so an admin
    // change (promotion, demotion) applies on the next request.
    const u = await this.users.get(session.user.id).catch(() => null);
    if (!u) return undefined;
    return this.withPlan({ id: u.id, email: u.email, name: u.name, emailVerified: u.emailVerified, role: u.role });
  }

  private async withPlan(base: Omit<AuthUser, "plan" | "planSource">): Promise<AuthUser> {
    const { plan, source } = await this.entitlements.planFor(base.id);
    return { ...base, plan, planSource: source };
  }
}
