import type { Plan } from "@cvb/domain";

/** The signed-in user as the rest of the API sees it. */
export type AuthUser = { id: string; email: string; plan: Plan };

declare module "express" {
  interface Request {
    user?: AuthUser;
  }
}
