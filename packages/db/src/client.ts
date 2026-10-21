import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export type DbClient = PrismaClient;

export type CreateDbClientOptions = {
  url: string;
  log?: ("query" | "info" | "warn" | "error")[];
};

/**
 * The one way to build a Prisma client. Apps call this once (the API wraps it in a Nest
 * provider) so connection settings and logging stay consistent everywhere.
 */
export function createDbClient({ url, log = ["warn", "error"] }: CreateDbClientOptions): DbClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log });
}
