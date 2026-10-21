import { Inject, Injectable, Module, type DynamicModule, type OnApplicationShutdown } from "@nestjs/common";
import { createDbClient, type CreateDbClientOptions, type DbClient } from "./client.js";

/** Injection token for the Prisma client: `@Inject(DB) private readonly db: DbClient`. */
export const DB = Symbol.for("cvb.DbClient");

@Injectable()
class DbLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.$disconnect();
  }
}

/** Provides one Prisma client per process and disconnects it on shutdown. Used by api and worker. */
@Module({})
export class DatabaseModule {
  static forRootAsync(options: {
    imports?: DynamicModule["imports"];
    inject?: unknown[];
    // Method syntax on purpose: lets callers type their injected arguments.
    useFactory(...args: unknown[]): CreateDbClientOptions | Promise<CreateDbClientOptions>;
  }): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: DB,
          inject: (options.inject ?? []) as never[],
          useFactory: async (...args: unknown[]) => createDbClient(await options.useFactory(...args)),
        },
        DbLifecycle,
      ],
      exports: [DB],
    };
  }
}
