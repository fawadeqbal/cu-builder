import type { Plan, PlanSource } from "@cvb/domain";

export type Role = "user" | "admin";

/** The signed-in user as the rest of the API sees it. `plan` is the effective plan right now. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  plan: Plan;
  planSource: PlanSource;
};

declare module "express" {
  interface Request {
    user?: AuthUser;
  }
}
