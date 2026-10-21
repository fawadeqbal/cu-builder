import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { QUEUES } from "@cvb/contracts";
import { InjectQueue } from "@nestjs/bullmq";
import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { Queue } from "bullmq";
import { Public } from "../../common/auth/decorators.js";

/** Liveness and readiness for load balancers and uptime checks. */
@Public()
@Controller("health")
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @InjectQueue(QUEUES.email) private readonly emailQueue: Queue,
  ) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    const checks = await Promise.allSettled([this.db.$queryRaw`SELECT 1`, this.emailQueue.getJobCounts("waiting")]);
    const [database, redis] = checks.map((c) => (c.status === "fulfilled" ? "up" : "down"));
    const body = { status: database === "up" && redis === "up" ? "ok" : "degraded", database, redis };
    if (body.status !== "ok") throw new ServiceUnavailableException(body);
    return body;
  }
}
