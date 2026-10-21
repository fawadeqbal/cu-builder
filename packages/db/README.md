# @cvb/db

Postgres schema and migrations (Prisma 7, `prisma-client` generator, `pg` driver adapter).

- `createDbClient({ url })`: the only way to build a client.
- Model types and enums re-exported from the generated client; `planToDomain` / `planToDb` mappers.
- `@cvb/db/nest`: `DatabaseModule.forRootAsync()` provides the client under the `DB` token and disconnects on shutdown.

Scripts: `db:migrate` (create + apply), `db:deploy` (apply in CI/prod), `db:seed`, `db:studio`. The root `.env` provides `DATABASE_URL`.
