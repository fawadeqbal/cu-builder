import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "./auth.types.js";

export const IS_PUBLIC = "cvb:isPublic";

/** Opens a route to signed-out visitors (health checks, public share links). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The signed-in user, set by AuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw new Error("CurrentUser used on a route without AuthGuard");
  return user;
});
