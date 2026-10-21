import { JOBS, type JobName, type JobPayload, type QueueName } from "@cvb/contracts";
import type { ZodType } from "zod";

export type EnqueueOptions = {
  /** Deduplicates: a second job with the same id is ignored while the first exists. */
  jobId?: string;
  delayMs?: number;
  priority?: number;
};

/**
 * The port the application depends on to start background work. Use cases receive it by
 * injection (token `JOB_PRODUCER`), never a BullMQ queue, so the queue technology can change
 * and tests can pass an in-memory fake.
 */
export interface JobProducer {
  enqueue<Q extends QueueName, N extends JobName<Q>>(
    queue: Q,
    name: N,
    payload: JobPayload<Q, N>,
    options?: EnqueueOptions,
  ): Promise<string>;
}

export const JOB_PRODUCER = Symbol.for("cvb.JobProducer");

/** Validates a payload against its contract. Producers and consumers both call it. */
export function parseJob<Q extends QueueName, N extends JobName<Q>>(queue: Q, name: N, data: unknown): JobPayload<Q, N> {
  const schema = (JOBS[queue] as Record<string, ZodType>)[name];
  if (!schema) throw new Error(`Unknown job ${queue}/${name}`);
  return schema.parse(data) as JobPayload<Q, N>;
}

/** Records jobs instead of sending them. For unit tests. */
export class InMemoryJobProducer implements JobProducer {
  readonly jobs: { queue: string; name: string; payload: unknown; options?: EnqueueOptions }[] = [];

  async enqueue<Q extends QueueName, N extends JobName<Q>>(
    queue: Q,
    name: N,
    payload: JobPayload<Q, N>,
    options?: EnqueueOptions,
  ): Promise<string> {
    const valid = parseJob(queue, name, payload);
    this.jobs.push({ queue, name, payload: valid, options });
    return String(this.jobs.length);
  }
}
