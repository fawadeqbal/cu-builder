# CV Builder Architecture

How the code is organised, why, and the rules that keep it maintainable as the product grows through the four phases in [`docs/SCOPE.md`](docs/SCOPE.md).

---

## 1. Principles

1. **Business rules live in one place and depend on nothing.** `@cvb/domain` holds the resume model, CV quality checks and plan entitlements. It has no framework, database or UI imports, so the web app, the API and the worker all apply exactly the same rules.
2. **Depend on ports, not technologies.** Use cases talk to interfaces (`ResumesRepository`, `JobProducer`, `EmailSender`, `ResumeParser`). Prisma, BullMQ, an email provider or an AI vendor are adapters plugged in at the composition root and can be swapped without touching business code.
3. **One contract per boundary.** Every shape that crosses HTTP or a queue is a zod schema in `@cvb/contracts`. The API validates requests with it, the worker validates jobs with it, and the web app types its calls with it. A breaking change fails the build on both sides.
4. **Shared code lives in packages, never copied.** If two apps need it, it goes into a package with a clear purpose and a public entry point.
5. **Modules own a feature end to end.** In the API, a feature module contains its controller, service, repository port and adapter. Features talk to each other only through exported services.
6. **Fail fast and explicitly.** Environment is validated at start-up (`@cvb/config`), payloads at every boundary (`@cvb/contracts`), and expected failures are typed errors (`@cvb/shared`) that map to one API error shape.

### SOLID, concretely

| Principle | Where it shows up |
| --- | --- |
| **S**ingle responsibility | Controllers only translate HTTP ↔ use case. Services hold use cases. Repositories only persist. Processors only adapt a queue job to a use case. |
| **O**pen/closed | New templates: add a component and a catalog entry, nothing else changes. New email provider, AI model or payment gateway: add an adapter class and bind it in the module. |
| **L**iskov substitution | `InMemoryResumesRepository` and `PrismaResumesRepository` honour the same `ResumesRepository` contract; tests run the real service against the fake. |
| **I**nterface segregation | Small ports per need (`EmailSender.send`, `ResumeParser.parse`, `JobProducer.enqueue`) instead of one "infrastructure service". |
| **D**ependency inversion | Services depend on tokens (`RESUMES_REPOSITORY`, `JOB_PRODUCER`, `EMAIL_SENDER`); concrete classes are chosen in `*.module.ts`. |

---

## 2. Repository layout

```
cu-builder/
├── apps/
│   ├── web/            Next.js app (editor, template gallery, PDF export)
│   ├── api/            NestJS HTTP API (/api/v1)
│   └── worker/         NestJS standalone worker (BullMQ consumers)
├── packages/
│   ├── domain/         Business rules: resume model, quality checks, plans and entitlements
│   ├── contracts/      zod schemas for HTTP DTOs and queue jobs
│   ├── shared/         Framework-free helpers: Result, typed errors, guards, strings
│   ├── config/         Validated environment schemas for the Node apps
│   ├── db/             Prisma schema, migrations, client factory, Nest DatabaseModule
│   ├── queue/          JobProducer port, BullMQ adapter, Nest QueueModule
│   ├── templates/      CV templates (React), template catalog, print stylesheet
│   ├── ui/             Shared React icons and small components
│   ├── config-typescript/  @cvb/tsconfig: base, library, react-library, nestjs, nextjs
│   └── config-eslint/      @cvb/eslint-config: base, next, nest
├── docs/               SCOPE.md and future ADRs
├── docker-compose.yml  Postgres + Redis for local development
├── turbo.json          Task graph and caching
└── pnpm-workspace.yaml
```

### Dependency rules

Arrows mean "may import". Anything not drawn is forbidden.

```
                ┌──────────────┐
                │    shared    │  (no internal deps)
                └──────▲───────┘
                       │
                ┌──────┴───────┐
                │    domain    │
                └──▲───▲───▲───┘
                   │   │   │
        ┌──────────┘   │   └───────────┐
 ┌──────┴─────┐ ┌──────┴─────┐ ┌───────┴─────┐
 │ contracts  │ │ templates  │ │     db      │
 └──▲─────▲───┘ └─▲──────▲───┘ └──▲───────▲──┘
    │     │       │      │        │       │
 ┌──┴───┐ │       │   ┌──┴──┐     │       │
 │queue │ │       │   │ ui  │     │       │
 └──▲───┘ │       │   └──▲──┘     │       │
    │     │       │      │        │       │
 ┌──┴─────┴───────┴──────┴────────┴───────┴──┐
 │          apps: web · api · worker          │
 └────────────────────────────────────────────┘
```

- `domain` imports only `shared`.
- `contracts` imports `domain` (to prove schemas match domain types) and `zod`.
- `db`, `queue`, `templates`, `ui` import `domain`/`contracts`/`shared` as needed, never each other except where drawn.
- Apps import packages through their **public entry point** (`@cvb/db`, `@cvb/db/nest`), never `src/` or `dist/` paths; ESLint enforces this.
- `web` never imports `db`, `queue` or `config` (server-only). `api` and `worker` never import `ui`; `api` imports only `@cvb/templates/catalog` (no React).
- Apps never import from each other.

---

## 3. Packages

| Package | Responsibility | Key exports | Built with |
| --- | --- | --- | --- |
| `@cvb/shared` | Generic building blocks | `Result`, `ok`/`err`, `AppError` family (`NotFoundError`, `PlanRequiredError`…), `assertNever`, `slugify`, `wordCount` | tsup (ESM) |
| `@cvb/domain` | Business rules | `CV` types, `emptyCV`, `normalizeCV`, `sampleCV`, `cvChecks`, `cvStrength`, `stepState`, `PLANS`, `FEATURES`, `can`, `LIMITS`, `canUseTemplateTier` | tsup |
| `@cvb/contracts` | Boundary shapes | `ResumeDataSchema`, `CreateResumeSchema`, `UpdateResumeSchema`, `ResumeSchema`, `ApiErrorSchema`, `PaginationQuerySchema`, `QUEUES`, `JOBS`, job payload schemas | tsup |
| `@cvb/config` | Environment | `ApiEnvSchema`, `WorkerEnvSchema`, `loadEnv` | tsup |
| `@cvb/db` | Persistence | `createDbClient`, Prisma model types and enums, `planToDomain`/`planToDb`; `@cvb/db/nest`: `DatabaseModule`, `DB` token | Prisma generate + tsc |
| `@cvb/queue` | Background jobs | `JobProducer`, `JOB_PRODUCER`, `BullMqJobProducer`, `InMemoryJobProducer`, `parseJob`; `@cvb/queue/nest`: `QueueModule` | tsup |
| `@cvb/templates` | CV rendering | `CVDocument`, all templates; `@cvb/templates/catalog`: `TEMPLATES`, `TIERS`, `ACCENTS`, `templateMeta`; `@cvb/templates/styles.css` | tsup + CSS copy |
| `@cvb/ui` | Shared React UI | Icons, `TierBadge` | tsup |
| `@cvb/tsconfig` | TS settings | `base`, `library`, `react-library`, `nestjs`, `nextjs` | — |
| `@cvb/eslint-config` | Lint rules | `base`, `next`, `nest` | — |

All packages are **ESM**, ship `dist/` with type declarations, and declare exact dependency versions. Turborepo builds them in dependency order before any app.

---

## 4. The API (NestJS)

### 4.1 Layers inside a feature module

```
modules/resumes/
├── resumes.controller.ts        HTTP adapter: route → ZodPipe(contract) → service → DTO
├── resumes.service.ts           Use cases: list, get, create, update, duplicate, remove
├── resumes.repository.ts        Port: ResumesRepository interface + RESUMES_REPOSITORY token
├── prisma-resumes.repository.ts Adapter: Prisma implementation
├── in-memory-resumes.repository.ts  Test double
├── resumes.service.test.ts      Unit tests against the test double
└── resumes.module.ts            Wiring: binds the port to the adapter
```

Request flow:

```
HTTP ─▶ RequestIdMiddleware ─▶ AuthGuard ─▶ Controller ─▶ ZodPipe(contract)
                                                    │
                                                    ▼
                                    Service (use case, domain rules)
                                       │                    │
                                       ▼                    ▼
                         Repository port          JobProducer port
                                       │                    │
                                       ▼                    ▼
                               Prisma adapter         BullMQ adapter ─▶ Redis ─▶ Worker
                                       │
                                       ▼
                                   Postgres
Errors anywhere ─▶ AppExceptionFilter ─▶ { error: { code, message, details, requestId } }
```

### 4.2 Cross-cutting pieces

| Concern | Implementation |
| --- | --- |
| Configuration | `AppConfigModule` validates env with `ApiEnvSchema` once; inject `APP_CONFIG`. |
| Validation | `new ZodPipe(Schema)` on `@Body`, `@Query`, `@Param`, using `@cvb/contracts`. |
| Errors | Throw `AppError` subclasses from `@cvb/shared`; `AppExceptionFilter` maps codes to HTTP status (e.g. `PLAN_REQUIRED` → 402). Never throw raw HTTP exceptions from services. |
| Auth | Global `AuthGuard`; `@Public()` opts out; `@CurrentUser()` injects `AuthUser`. Phase 1 replaces the development header sign-in with real sessions; nothing else changes. |
| Plan gating | Services call `can()`, `LIMITS` and `canUseTemplateTier()` from `@cvb/domain`; denial throws `PlanRequiredError`. |
| Tracing | `x-request-id` on every request and response, included in error bodies and logs. |
| Health | `GET /health/live` (process up), `GET /health/ready` (Postgres and Redis reachable). |
| Versioning | All routes under `/api/v1`. Breaking changes go to `/api/v2` alongside v1. |

### 4.3 Endpoints today

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/health/live` | Public |
| GET | `/api/v1/health/ready` | Public |
| GET | `/api/v1/me` | Signed-in user and plan |
| GET | `/api/v1/resumes?cursor&limit` | Cursor pagination |
| POST | `/api/v1/resumes` | Enforces plan resume limit and template tier |
| GET | `/api/v1/resumes/:id` | Owner only |
| PATCH | `/api/v1/resumes/:id` | `snapshot: true` stores the previous version |
| POST | `/api/v1/resumes/:id/duplicate` | |
| DELETE | `/api/v1/resumes/:id` | Soft delete |

---

## 5. The worker

A NestJS **application context** (no HTTP server) that runs one `@Processor` per queue.

```
worker/src/
├── email/            EmailProcessor + EmailSender port (ConsoleEmailSender adapter today)
├── resume-import/    ResumeImportProcessor + ResumeParser port (placeholder until Phase 1)
├── config/           WorkerConfigModule (WorkerEnvSchema)
└── worker.module.ts  DatabaseModule + QueueModule + one module per queue
```

Rules:

- A processor only **parses the job** with `parseJob()` (same contract the producer used) and **calls a port**. Business logic lives in domain code or a service, not in the processor.
- Jobs must be **idempotent**: pass a deterministic `jobId` when enqueuing (`welcome-<userId>`) and make handlers safe to run twice.
- Expected permanent failures throw BullMQ's `UnrecoverableError` (no retries). Everything else retries with exponential backoff (`DEFAULT_JOB_OPTIONS`: 3 attempts).
- Scale by running more worker processes; concurrency per process comes from `WORKER_CONCURRENCY`.

Planned queues: `ai` (writing, tailoring, scoring), `export` (DOCX), `notifications` (reminders, digests), `billing-webhooks`.

---

## 6. The web app (Next.js)

- Imports templates (`@cvb/templates`), styles (`@cvb/templates/styles.css`), rules (`@cvb/domain`) and UI (`@cvb/ui`).
- `src/lib/cv.ts` is the storage adapter (browser `localStorage` today). Phase 1 replaces it with an API client typed by `@cvb/contracts`; components keep calling the same functions.
- `src/lib/access.ts` decides what the visitor can use, delegating to `@cvb/domain`.
- Still a static export (GitHub Pages) until accounts ship; then it moves to a server deployment.

---

## 7. Data

- **Postgres** via **Prisma 7** with the `prisma-client` generator (ESM) and the `pg` driver adapter.
- Tables and columns are `snake_case` (`@@map`/`@map`); TypeScript uses `camelCase`.
- The CV body is a `Json` column validated by `ResumeDataSchema` on the way in and passed through `normalizeCV` on the way out, so older documents never break templates.
- Soft deletes (`deletedAt`) for user content; `ResumeVersion` rows for restore points.
- Migrations live in `packages/db/prisma/migrations`, are created with `pnpm db:migrate` and applied in deploys with `pnpm db:deploy`. Never edit an applied migration; add a new one.
- Money and credits are append-only (`CreditLedger`); balances are derived.

---

## 8. Patterns catalogue

| Pattern | Where | Why |
| --- | --- | --- |
| Ports and adapters (hexagonal) | Repositories, `JobProducer`, `EmailSender`, `ResumeParser` | Swap infrastructure, test without it |
| Repository | `*Repository` + Prisma adapter | Keeps queries out of use cases |
| Dependency injection | Nest providers with symbol tokens | Explicit wiring at the composition root |
| Strategy | Email senders, parsers; later AI providers and payment gateways | Pick an implementation per environment or market |
| Registry | Template catalog + `COMPONENTS` map | Add templates without touching consumers |
| Factory | `createDbClient`, `redisConnection`, `DatabaseModule.forRootAsync`, `QueueModule.forRootAsync` | One way to build shared infrastructure |
| Adapter / anti-corruption | `planToDomain`/`planToDb`, `toRecord`, `toDto` | Database and HTTP shapes never leak into the domain |
| Specification / policy | `can()`, `canUseTemplateTier()`, `LIMITS` | Entitlements as data, testable in isolation |
| Result type | `@cvb/shared` `Result` | Expected failures without exceptions where it reads better |
| Null object / placeholder | `NotYetAvailableParser`, `ConsoleEmailSender` | Ship the wiring before the provider |

---

## 9. Conventions

**Naming**
- Packages `@cvb/<name>`; apps `@cvb/web|api|worker`.
- Files `kebab-case.ts`; React components `PascalCase.tsx`; tests next to the file as `*.test.ts`.
- Nest: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.repository.ts` (port), `prisma-<feature>.repository.ts` (adapter).
- Injection tokens are `Symbol.for("cvb.<area>.<Name>")` constants in UPPER_SNAKE_CASE next to their interface.

**TypeScript**
- `strict`, `noUncheckedIndexedAccess` (packages and Node apps), ESM everywhere.
- Node apps use `NodeNext` resolution: relative imports end in `.js`.
- No `any`; prefer `unknown` + parsing. Types come from schemas (`z.output`) or domain types, not hand-copied.

**Errors and logging**
- Throw `AppError` subclasses for expected failures; let the filter shape responses.
- Log with Nest's `Logger` and include the request or job id.

**Dependencies**
- Exact versions; each package declares what it uses. Native build scripts are allow-listed in `pnpm-workspace.yaml` (`allowBuilds`).

---

## 10. Testing

| Level | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | `domain`, `contracts`, `shared`, `config`, `queue`; API services with in-memory repositories; worker processors with fake ports |
| Integration | Vitest + Postgres/Redis (CI services) | Prisma adapters and queue round-trips (to add per feature) |
| End to end | Playwright | Web flows: build, preview, download, templates (to add in Phase 1) |
| Contract | Type-level check in `contracts/src/resume.ts` | Schema and domain type can never drift |

`pnpm check` runs lint, typecheck and tests across the repo; CI runs the same plus a build and `prisma migrate deploy` against a fresh Postgres.

---

## 11. Running locally

```bash
cp .env.example .env
pnpm install
pnpm services:up          # Postgres + Redis (Docker)
pnpm db:migrate           # apply migrations
pnpm db:seed              # dev user + example CV
pnpm dev                  # web :3000, api :4000, worker
```

Call the API as the seeded user during development:

```bash
curl -H "x-dev-user: dev@cvbuilder.local" http://localhost:4000/api/v1/resumes
```

---

## 12. Adding things

**A new API feature** (e.g. share links)
1. Domain rules (if any) in `packages/domain`, with tests.
2. Request/response schemas in `packages/contracts`.
3. Prisma model + migration in `packages/db`.
4. `apps/api/src/modules/share-links/`: repository port + Prisma adapter, service, controller, module, tests with an in-memory repository.
5. Register the module in `app.module.ts`.

**A new background job**
1. Add the queue to `QUEUES` and its payload schema to `JOBS` in `packages/contracts/src/jobs.ts`.
2. Enqueue from a service through `JOB_PRODUCER`.
3. Add `apps/worker/src/<queue>/` with a port, an adapter, a processor and a module; import it in `worker.module.ts`.

**A new CV template**
1. Component in `packages/templates/src/<Name>Template.tsx` using helpers from `shared.tsx`, sections wrapped in `<Block step>`.
2. Styles in `packages/templates/src/styles.css`, coloured with `var(--cv-accent)`.
3. Entry in `catalog.ts` and in `COMPONENTS` (`index.tsx`).

**A new external provider** (email, AI, payments)
1. Define or reuse the port interface.
2. Add an adapter class; bind it in the owning module (choose by config if several).
3. Keep the provider SDK inside the adapter file.

---

## 13. Decisions log

| # | Decision | Reason |
| --- | --- | --- |
| 1 | pnpm + Turborepo | Strict dependency isolation, fast cached builds, simple config |
| 2 | Next.js (web), NestJS 12 (api, worker) | Modular DI and decorators for the backend; the existing app stays on Next |
| 3 | ESM-only packages and apps | Nest 12, Prisma 7 and modern tooling are ESM-first |
| 4 | Prisma 7 + Postgres, `pg` driver adapter | Typed queries, migrations, no binary engine |
| 5 | BullMQ + Redis for background work | Retries, scheduling, rate limits; first-class Nest support |
| 6 | zod contracts shared across boundaries | One source of truth for validation and types |
| 7 | Business rules in a framework-free package | Same rules in browser, API and worker; trivial to test |
| 8 | Development header sign-in until Phase 1 auth | Lets features be built now; disabled in production by config |

New significant decisions get a short ADR in `docs/adr/NNN-title.md` and a row here.
