import type { Plan as DomainPlan } from "@cvb/domain";
import { Plan as DbPlan } from "./generated/prisma/client.js";

const TO_DOMAIN: Record<DbPlan, DomainPlan> = {
  [DbPlan.FREE]: "free",
  [DbPlan.STANDARD]: "standard",
  [DbPlan.PREMIUM]: "premium",
  [DbPlan.EXECUTIVE]: "executive",
};

const TO_DB: Record<DomainPlan, DbPlan> = {
  free: DbPlan.FREE,
  standard: DbPlan.STANDARD,
  premium: DbPlan.PREMIUM,
  executive: DbPlan.EXECUTIVE,
};

export const planToDomain = (plan: DbPlan): DomainPlan => TO_DOMAIN[plan];
export const planToDb = (plan: DomainPlan): DbPlan => TO_DB[plan];
