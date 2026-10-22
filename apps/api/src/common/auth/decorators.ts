import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser, Role } from "./auth.types.js";

export const IS_PUBLIC = "cvb:isPublic";
export const ROLES = "cvb:roles";

/** Opens a route to signed-out visitors (health checks, public share links, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restricts a route or controller to some roles: `@Roles("admin")`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** The signed-in user, set by AuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw new Error("CurrentUser used on a route without AuthGuard");
  return user;
});

/** The signed-in user if there is one (on @Public routes). */
export const OptionalUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined => ctx.switchToHttp().getRequest<Request>().user,
);
