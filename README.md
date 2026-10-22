# CV Builder

Write your CV once, switch between 12 templates, and download a clean PDF or Word file. Accounts keep CVs in the cloud with version history, share links with analytics, CV import from PDF/Word, AI writing, ATS scores, job matching, an application tracker, interview prep, expert reviews, organisation accounts, portfolio sites and paid plans. Scope: [`docs/SCOPE.md`](docs/SCOPE.md).

This is a **pnpm + Turborepo monorepo**: a Next.js web app, a NestJS API and a NestJS worker, sharing typed packages. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) before adding code.

## What's inside

| Path | What |
| --- | --- |
| `apps/web` | Next.js: builder, My CVs, jobs and job feed, application tracker, interview prep, letters, sharing, expert marketplace, organisations (universities, agencies), portfolio sites, white label, English/Urdu/Arabic UI, pricing, account and admin ([README](apps/web/README.md)) |
| `apps/api` | NestJS HTTP API at `/api/v1`, Better Auth at `/api/auth` |
| `apps/worker` | NestJS BullMQ worker (email, CV import, reminders, digests, job alerts, expert order upkeep, agency bulk import, daily clean-up) |
| `apps/extension` | Chrome extension: save jobs, match score, form autofill ([README](apps/extension/README.md)) |
| `packages/domain` | Business rules: resume model, CV checks, plans and entitlements |
| `packages/contracts` | zod schemas for HTTP and queue payloads |
| `packages/templates` | The 12 CV templates, their catalog and print styles |
| `packages/db` | Prisma schema, migrations, client and Nest module |
| `packages/queue` | Job producer port, BullMQ adapter and Nest module |
| `packages/ai` | AI assistant port, Claude and Ollama (local AI) adapters, offline assistant |
| `packages/jobfeed` | Job board adapters (Remotive, Jooble, Adzuna) |
| `packages/storage` | File storage port (local disk now, S3-compatible later) |
| `packages/shared`, `config`, `ui` | Helpers, env validation, shared React UI |
| `packages/config-typescript`, `config-eslint` | Shared TS and ESLint configs |

## Requirements

- Node.js 22.12 or newer
- pnpm 12 (`npm install -g pnpm@12.10.1`; the exact version is pinned in `package.json`)
- Docker (for local Postgres and Redis), or your own Postgres 16 and Redis 7

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm services:up      # Postgres + Redis in Docker
pnpm db:migrate       # create tables
pnpm db:seed          # dev@cvbuilder.local and admin@cvbuilder.local, password "password123"
pnpm dev              # web http://localhost:3000 · api http://localhost:4000/api/v1 · worker
```

Sign in at http://localhost:3000/sign-in. Emails (verification, magic links, receipts) are printed in the worker's output until `SMTP_URL` is set.

Try the API as the seeded user (development only, `DEV_AUTH=true`):

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

- **Production:** one VPS running Docker Compose: Caddy (HTTPS) → web and API, plus the worker, Postgres and Redis. Images are built by `.github/workflows/deploy.yml` and pushed to GitHub Container Registry; the same workflow can pull and restart the server. Step-by-step setup: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- **CI:** `.github/workflows/ci.yml` runs lint, typecheck, tests, builds and migrations on every pull request.
