# CV Builder

Write your CV once, switch between 12 templates, and download a clean A4 PDF. Growing into a job-seeker SaaS: see [`docs/SCOPE.md`](docs/SCOPE.md).

**Live:** https://fawadeqbal.github.io/cu-builder/

This is a **pnpm + Turborepo monorepo**: a Next.js web app, a NestJS API and a NestJS worker, sharing typed packages. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) before adding code.

## What's inside

| Path | What |
| --- | --- |
| `apps/web` | Next.js editor, template gallery, PDF export ([README](apps/web/README.md)) |
| `apps/api` | NestJS HTTP API at `/api/v1` |
| `apps/worker` | NestJS BullMQ worker (email, CV import; AI and exports next) |
| `packages/domain` | Business rules: resume model, CV checks, plans and entitlements |
| `packages/contracts` | zod schemas for HTTP and queue payloads |
| `packages/templates` | The 12 CV templates, their catalog and print styles |
| `packages/db` | Prisma schema, migrations, client and Nest module |
| `packages/queue` | Job producer port, BullMQ adapter and Nest module |
| `packages/shared`, `config`, `ui` | Helpers, env validation, shared React UI |
| `packages/config-typescript`, `config-eslint` | Shared TS and ESLint configs |

## Requirements

- Node.js 22.12 or newer
- pnpm (version pinned in `package.json`; `corepack enable` picks it up)
- Docker (for local Postgres and Redis), or your own Postgres 16 and Redis 7

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm services:up      # Postgres + Redis in Docker
pnpm db:migrate       # create tables
pnpm db:seed          # dev user + example CV
pnpm dev              # web http://localhost:3000 · api http://localhost:4000/api/v1 · worker
```

Only working on the editor? `pnpm dev:web` needs no database.

Try the API as the seeded user (development only):

```bash
curl -H "x-dev-user: dev@cvbuilder.local" http://localhost:4000/api/v1/resumes
```

## Everyday commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Runs every app in watch mode (packages rebuild on change) |
| `pnpm build` | Builds packages then apps, cached by Turborepo |
| `pnpm check` | Lint + typecheck + tests across the repo |
| `pnpm db:migrate` | Create and apply a migration after editing `schema.prisma` |
| `pnpm db:studio` | Browse the database |
| `pnpm --filter @cvb/api <script>` | Run a script in one workspace |

## Deployment

- **Web:** GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`), as a static export until accounts ship.
- **API and worker:** container-ready Node processes (`pnpm --filter @cvb/api build && node apps/api/dist/main.js`); hosting is chosen in Phase 1.
- **CI:** `.github/workflows/ci.yml` runs lint, typecheck, tests, builds and migrations on every pull request.
