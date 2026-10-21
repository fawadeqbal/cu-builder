import { QUEUES, type QueueName } from "@cvb/contracts";
import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Module, type DynamicModule } from "@nestjs/common";
import type { Queue } from "bullmq";
import { BullMqJobProducer, DEFAULT_JOB_OPTIONS, redisConnection } from "./bullmq";
import { JOB_PRODUCER } from "./producer";

export type QueueModuleOptions = { redisUrl: string };

const NAMES = Object.values(QUEUES) as QueueName[];

/**
 * Registers every queue on one Redis connection and provides `JOB_PRODUCER`.
 * The api imports it to enqueue; the worker imports it and adds `@Processor` classes.
 */
@Module({})
export class QueueModule {
  static forRootAsync(options: {
    imports?: DynamicModule["imports"];
    inject?: unknown[];
    // Method syntax on purpose: lets callers type their injected arguments.
    useFactory(...args: unknown[]): QueueModuleOptions | Promise<QueueModuleOptions>;
  }): DynamicModule {
    const bull = BullModule.forRootAsync({
      imports: options.imports,
      inject: options.inject as never[],
      useFactory: async (...args: unknown[]) => {
        const { redisUrl } = await options.useFactory(...args);
        return { connection: redisConnection(redisUrl), defaultJobOptions: DEFAULT_JOB_OPTIONS };
      },
    });
    const queues = BullModule.registerQueue(...NAMES.map((name) => ({ name })));

    return {
      module: QueueModule,
      global: true,
      imports: [bull, queues],
      providers: [
        {
          provide: JOB_PRODUCER,
          inject: NAMES.map((name) => getQueueToken(name)),
          useFactory: (...instances: Queue[]) => new BullMqJobProducer(new Map(NAMES.map((n, i) => [n, instances[i]!]))),
        },
      ],
      exports: [JOB_PRODUCER, queues],
    };
  }
}
