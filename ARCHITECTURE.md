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
│   ├── web/            Next.js app (builder, dashboard, sharing, pricing, account, admin)
│   ├── api/            NestJS HTTP API (/api/v1)
│   └── worker/         NestJS standalone worker (BullMQ consumers)
├── packages/
│   ├── domain/         Business rules: resume model, quality checks, plans and entitlements
│   ├── contracts/      zod schemas for HTTP DTOs and queue jobs
│   ├── shared/         Framework-free helpers: Result, typed errors, guards, strings
│   ├── config/         Validated environment schemas for the Node apps
│   ├── db/             Prisma schema, migrations, client factory, Nest DatabaseModule
│   ├── queue/          JobProducer port, BullMQ adapter, Nest QueueModule
│   ├── storage/        FileStorage port: local disk adapter (S3-compatible later), in-memory double
│   ├── extract/        Text from CV files (PDF, DOCX, ODT, RTF, HTML, text) and file-type sniffing
│   ├── ai/             Assistant port: task prompts, JSON parsing, no-invention guard, Claude adapter, offline fallback
│   ├── templates/      CV templates (React), template catalog, print stylesheet
│   ├── ui/             Shared React icons and small components
│   ├── config-typescript/  @cvb/tsconfig: base, library, react-library, nestjs, nextjs
│   └── config-eslint/      @cvb/eslint-config: base, next, nest
├── docs/               SCOPE.md, DEPLOYMENT.md and future ADRs
├── infra/              Dockerfile, production compose, Caddyfile, deploy and backup scripts
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
- `extract` imports no internal package (only its file readers); `api` and `worker` use it, `web` never does.
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
| `@cvb/domain` | Business rules | `CV` types, `emptyCV`, `normalizeCV`, `sampleCV`, `cvChecks`, `cvStrength`, `stepState`, `parseResumeText` (import), `cvToText` (TXT export), `atsReport` (ATS score), `matchJob`/`addKeyword` (job match), `diffCV`/`applyChanges` (reviewable edits), `guardNumbers`/`creditBalance`/`AI_TASKS` (AI rules), `DEFAULT_COLUMNS`/`positionBetween`/`remindersFor`/`progressSince` (tracker), `compareOffers`/`NEGOTIATION_TEMPLATES`/`fillTemplate` (offers), `QUESTION_BANK`/`questionsFor`/`roleFamily`/`sessionSummary` (interviews), `summariseViews`/`deviceFromUserAgent`/`referrerHost` (link analytics), product analytics (`touchFromUrl`/`channelOf`/`normalisePath`/`nextSession` attribution and sessions, `isBot`/`deviceClass`/`browserFamily`/`resolveCountry`, `resolvePeriod`/`alignSeries`/`comparison` periods, `funnel`/`funnelBreakdown`, `buildCohorts`, `monthlyCents`/`mrrMovement` MRR), `SERVICES`/commission/order transitions/coaching slots (expert services), `orgCan`/seats/CSV invites/`cohortMetrics`/`lowConfidenceFields` (organisations), slug, domain and colour-contrast rules (portfolio, white label), `applyRegionPreset`/`regionRules`/direction detection (regional formats), `PLANS`, `FEATURES`, `can`, `LIMITS`, `canUseTemplateTier`, `OFFERS`, `effectivePlan` | tsup |
| `@cvb/contracts` | Boundary shapes | Resume, version, share-link (+ view analytics), import, billing, account, admin, analytics, tracker, feed, interview and API-token schemas; `ApiErrorSchema`, `PaginationQuerySchema`, `QUEUES`, `JOBS`, job payload schemas | tsup |
| `@cvb/config` | Environment | `ApiEnvSchema`, `WorkerEnvSchema`, `loadEnv` | tsup |
| `@cvb/db` | Persistence | `createDbClient`, Prisma model types and enums, `planToDomain`/`planToDb`; `@cvb/db/nest`: `DatabaseModule`, `DB` token | Prisma generate + tsc |
| `@cvb/queue` | Background jobs | `JobProducer`, `JOB_PRODUCER`, `BullMqJobProducer`, `InMemoryJobProducer`, `parseJob`; `@cvb/queue/nest`: `QueueModule` | tsup |
| `@cvb/ai` | AI writing | `Assistant` (improve bullet, summary, rewrite, skills, tailor, cover letter, interview, STAR, company brief), `LlmAssistant` over a `TextModel` port, `OfflineAssistant`, `ASSISTANT`; `@cvb/ai/anthropic`: `AnthropicTextModel` | tsup |
| `@cvb/jobfeed` | Job board adapters | `JobFeedProvider` port; `RemotiveProvider` (no key), `JoobleProvider`, `AdzunaProvider` (+ `salaryRange`); `JobFeed` (merge, dedupe, survive a failing board); `createJobFeed(config)`, `JOB_FEED` | tsup |
| `@cvb/extract` | CV file text | `sniff` (file type from bytes), `extractText` (PDF via unpdf with page count, DOCX via mammoth, ODT, RTF, HTML, text), `markupToText`, `rtfToText`, `ExtractError`, `hasReadableText`; used by the worker (imports) and the API (free ATS check) | tsup |
| `@cvb/storage` | Files | `FileStorage`, `FILE_STORAGE`, `LocalDiskStorage`, `InMemoryStorage` | tsup |
| `@cvb/templates` | CV rendering | `CVDocument`, all templates; `@cvb/templates/catalog`: `TEMPLATES`, `TIERS`, `ACCENTS`, `templateMeta`, `applyOverrides`; `@cvb/templates/styles.css` (A4 and US Letter sheets) | tsup + CSS copy |
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
| Auth | **Better Auth** (`modules/auth/better-auth.ts`) is mounted at `/api/auth` and owns sign-up, sign-in (password, magic link, Google, LinkedIn), sessions, email verification, password reset, account deletion and the admin plugin, storing everything in our Prisma tables. The global `AuthGuard` turns the session cookie into an `AuthUser` (role from the database, plan from `EntitlementsService`); `@Public()` opts out, `@Roles("admin")` restricts, `@CurrentUser()` / `@OptionalUser()` inject. The `x-dev-user` header works only with `DEV_AUTH=true` outside production. |
| Plan gating | The effective plan is `effectivePlan()` over the base plan, live subscriptions and running passes. Services call `can()`, `LIMITS` and the template catalog's tier; denial throws `PlanRequiredError` (402), which the web app turns into an upgrade prompt. |
| Rate limits | `@nestjs/throttler` globally (300/min per IP), tighter on analytics, share-link password attempts and the free tools; Better Auth's own limiter in production. 429s carry the `RATE_LIMITED` code. Daily allowances (free AI tools) use the `UsageQuota` port with a Redis adapter. |
| Tracing | `x-request-id` on every request and response, included in error bodies and logs. |
| Health | `GET /health/live` (process up), `GET /health/ready` (Postgres and Redis reachable). |
| Versioning | All routes under `/api/v1`. Breaking changes go to `/api/v2` alongside v1. |

### 4.3 Endpoints

All under `/api/v1` except Better Auth (`/api/auth/*`).

| Area | Routes |
| --- | --- |
| Health | `GET health/live`, `GET health/ready` (public) |
| Account | `GET session` (public: user or null), `GET me`, `PATCH me`, `GET me/export` (all data as JSON), `GET auth-providers` (public) |
| Resumes | `GET resumes`, `POST resumes`, `GET/PATCH/DELETE resumes/:id`, `POST resumes/:id/duplicate`, `GET resumes/trash`, `POST resumes/:id/restore`, `GET/POST resumes/:id/versions`, `POST resumes/:id/versions/:versionId/restore` |
| Sharing | `GET/POST resumes/:id/share-links`, `PATCH/DELETE share-links/:id`, `GET share-links/:id/analytics`, `GET public/r/:slug`, `POST public/r/:slug/unlock` and `POST public/r/:slug/ping` (public) |
| Import | `POST imports` (multipart: PDF, Word, ODT, RTF, text, HTML, JSON ≤ 5 MB; LinkedIn data export ZIP ≤ 25 MB, stored with only its CV files), `GET imports`, `GET imports/:id` |
| Free tools (public) | `POST public/ats-check` (multipart file or JSON text, optional job advert; no AI, nothing stored, 10/hour per IP), `GET public/ai/usage`, `POST public/ai/write-summary`, `POST public/ai/improve-bullet` (same assistant and guards as `ai/*`; 3 a day per visitor, counted in Redis by hashed IP) |
| AI | `GET ai/credits`, `POST ai/improve-bullet`, `POST ai/write-summary`, `POST ai/rewrite`, `POST ai/suggest-skills`, `POST ai/linkedin-profile` (metered by credits, throttled) |
| Jobs | `GET/POST jobs`, `POST jobs/import` (read a posting from a link, SSRF-safe), `GET/PATCH/DELETE jobs/:id`, `POST jobs/:id/match`, `POST jobs/:id/tailor` |
| Tracker | `GET/PUT tracker/board`, `GET/POST applications`, `GET/PATCH/DELETE applications/:id`, `POST applications/:id/move`, `POST applications/:id/share-link`, `POST applications/:id/brief` (AI), `GET/POST reminders`, `PATCH/DELETE reminders/:id` |
| Job feed | `GET feed`, `GET/PUT feed/preferences`, `POST feed/save`, `GET feed/salary` |
| Interviews | `GET interviews/bank`, `GET/POST interviews/sessions`, `GET/DELETE interviews/sessions/:id`, `POST interviews/sessions/:id/answer`, `GET/POST interviews/stories`, `POST interviews/stories/from-bullet`, `PATCH/DELETE interviews/stories/:id` |
| Expert services | `GET services/catalog`, `GET services/included`, `GET experts`, `GET experts/:id`, `GET experts/:id/slots`, `GET/PUT expert/me`, `GET expert/orders`, `POST expert/payouts/connect|refresh` (Stripe Connect), `GET/POST orders`, `GET orders/:id`, `GET/POST orders/:id/messages`, `GET orders/:id/calendar` (.ics), `POST orders/:id/{cancel,start,deliver,complete,revision,dispute}`, `PUT orders/:id/notes`; admin `GET/PATCH admin/experts`, `GET admin/orders`, `POST admin/orders/:id/{refund,resolve,assign,payout}` |
| Review comments | `GET review/resumes/:id` (read-only CV for owner, assigned expert or org reviewer: `reviewAccess()`), `GET/POST resumes/:id/comments`, `PATCH/DELETE comments/:id` |
| Organisations | `GET/POST orgs`, `GET/PATCH/DELETE orgs/:id`, `GET orgs/:id/members`, `PATCH/DELETE orgs/:id/members/:memberId`, `GET/POST orgs/:id/invites`, `POST orgs/:id/invites/bulk` (CSV, `dryRun`), `DELETE orgs/:id/invites/:inviteId`, `GET orgs/:id/cohort`, `GET orgs/:id/cohort.csv`, `GET public/join/:code`, `POST join/:code`, `GET/POST orgs/:id/candidates`, `GET/PATCH/DELETE orgs/:id/candidates/:candidateId`; admin `GET admin/orgs`, `PATCH admin/orgs/:id` |
| White label | `GET/PUT orgs/:id/branding`, `PUT orgs/:id/branding/domain`, `POST orgs/:id/branding/domain/verify`, `GET public/branding?host=`, `GET public/domains/allowed` (Caddy on-demand TLS `ask`), `GET public/domains/resolve` |
| Portfolio | `GET/PUT/DELETE portfolio`, `PUT portfolio/domain`, `POST portfolio/domain/verify`, `GET portfolio/messages`, `PATCH/DELETE portfolio/messages/:id`, `GET public/sites/:slug`, `GET public/sites/by-host`, `POST public/sites/:slug/contact` |
| Extension keys | `GET/POST tokens`, `DELETE tokens/:id` (`Authorization: Bearer cvb_…` then works on every signed-in route) |
| Cover letters | `GET/POST cover-letters`, `POST cover-letters/draft`, `GET/PATCH/DELETE cover-letters/:id`, `GET public/l/:slug` (public) |
| Billing | `GET billing/offers?currency=usd\|pkr` (public), `GET billing/status`, `POST billing/checkout` (offer, currency), `POST billing/portal`, `POST billing/webhooks/:provider` (public, raw body, signature-checked, idempotent); admin `GET admin/prices`, `PUT/DELETE admin/prices/:offer/:currency` |
| Talent search | `GET/PUT/DELETE talent/profile` (opt-in "Let recruiters find me"), agencies: `GET orgs/:id/talent?q&location&role&cursor`, `GET orgs/:id/talent/contacts`, `GET orgs/:id/talent/:profileId`, `POST orgs/:id/talent/:profileId/contact` (20 per member per day, once a week per organisation and person) |
| Templates | `GET templates/settings` (public: admin overrides) |
| Analytics | `POST events` (public, batched, throttled; drops bots and Do Not Track / Global Privacy Control); admin `GET admin/analytics/overview\|funnel\|acquisition\|revenue\|usage?range=7d\|30d\|90d\|12m\|custom&from&to&compare&source&medium&campaign&device&country&locale&currency` |
| Trust | `GET public/stats` (real counts, null under thresholds, cached 10 min), `GET/PUT/DELETE reviews/me`, `GET public/reviews` (approved, paginated), `GET public/site-settings` (WhatsApp help number); admin `GET admin/reviews`, `PATCH admin/reviews/:id`, `GET/PUT admin/site-settings` |
| Admin | `GET admin/metrics`, `GET admin/users`, `PATCH admin/users/:id`, `GET admin/templates`, `PATCH admin/templates/:templateId` (role admin) |

--- | --- | --- |
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
├── email/            EmailProcessor + EmailSender port (SMTP adapter, console adapter without SMTP_URL) + templates
├── resume-import/    ResumeImportProcessor + ResumeParser port (unpdf / mammoth → parseResumeText) + ImportResults port
├── maintenance/      Daily job scheduler: empties 30-day trash, deletes week-old uploads, expired tokens, analytics events older than 13 months
├── notifications/    Reminder emails (every 15 min), Monday digest, daily/weekly job alerts from @cvb/jobfeed
├── services/         Expert orders: due/overdue warnings, auto-complete after 7 days, payouts
├── candidates/       Agency bulk import: parse each uploaded CV, flag low-confidence fields
├── config/           WorkerConfigModule (WorkerEnvSchema)
└── worker.module.ts  DatabaseModule + QueueModule + one module per queue
```

Rules:

- A processor only **parses the job** with `parseJob()` (same contract the producer used) and **calls a port**. Business logic lives in domain code or a service, not in the processor.
- Jobs must be **idempotent**: pass a deterministic `jobId` when enqueuing (`welcome-<userId>`) and make handlers safe to run twice.
- Expected permanent failures throw BullMQ's `UnrecoverableError` (no retries). Everything else retries with exponential backoff (`DEFAULT_JOB_OPTIONS`: 3 attempts).
- Scale by running more worker processes; concurrency per process comes from `WORKER_CONCURRENCY`.

Queues today: `email`, `resume-import`, `maintenance`, `notifications`, `services`, `candidate-import`.

---

## 6. The web app (Next.js)

A Next.js server (`output: "standalone"`) on the same origin as the API: Caddy sends `/api/*` to the API, and in development the web server rewrites `/api/*` to `API_INTERNAL_URL`. Same origin means the Better Auth session cookie just works.

```
web/src/
├── app/                 Routes: / (landing), /builder (guest builder), /app (My CVs), /edit/[id], /templates,
│                        /r/[slug], /pricing, /account, /account/billing, /admin, /sign-in, /sign-up, password
│                        pages; free tools /ats-checker, /tools, /tools/summary-generator,
│                        /tools/bullet-improver; /cv-examples and /cv-examples/[slug]; sitemap.ts, robots.ts,
│                        opengraph-image.tsx
├── components/          Builder (the editor), dialogs (Share, History, Upgrade), dashboard, auth, billing, admin
└── lib/
    ├── document.ts      DocumentController port: useGuestDocument (localStorage) and useCloudDocument (API)
    ├── api.ts           fetch client for /api/v1, typed by @cvb/contracts, ApiError with stable codes
    ├── queries.ts       TanStack Query hooks and keys
    ├── auth-client.ts   Better Auth React client (magic link, admin plugins)
    ├── access.ts        usePlan(), isUnlocked(), hasFeature() over @cvb/domain
    ├── catalog.ts       useCatalog(): template catalog with admin overrides
    ├── pdf.ts, docx.ts  Client-side PDF (modern-screenshot + jsPDF, text layer, links) and Word exports
    ├── guest-migration.ts  Moves a guest's CV into the account after sign-in
    ├── handoff.ts       Opens a CV from a public page (example, ATS check) in the guest builder or the account
    ├── examples/        CV example data (typed with the domain CV; fictional people and companies)
    └── seo.ts           siteUrl() from APP_URL, JSON-LD builders (WebApplication, FAQPage, landingJsonLd)
```

- **One editor, two stores.** `Builder` only knows a `DocumentController`. Guests get browser storage; signed-in users get autosave to the API (debounced), an offline queue in `localStorage` that flushes when the connection returns, polling for changes from other devices, and a "newer version on another device" choice when both sides changed (last write wins).
- **Gating never dead-ends.** Locked templates stay previewable (a "trying" state that isn't saved); downloads, Word/TXT, share links and extra CVs open the `UpgradeDialog`, which links to pricing (or sign-up for guests). The API enforces the same rules.
- **Analytics** are first-party and privacy-first (`lib/analytics.ts` → `POST /events`, page views from `components/analytics/AnalyticsTracker`); see §7.1. The admin reports live at `/admin/analytics` and are drawn with the small chart kit in `components/charts`.

---

## 7. Data

- **Postgres** via **Prisma 7** with the `prisma-client` generator (ESM) and the `pg` driver adapter.
- Tables and columns are `snake_case` (`@@map`/`@map`); TypeScript uses `camelCase`.
- The CV body is a `Json` column validated by `ResumeDataSchema` on the way in and passed through `normalizeCV` on the way out, so older documents never break templates.
- Soft deletes (`deletedAt`) for user content; `ResumeVersion` rows for restore points.
- Migrations live in `packages/db/prisma/migrations`, are created with `pnpm db:migrate` and applied in deploys with `pnpm db:deploy`. Never edit an applied migration; add a new one.
- Money and credits are append-only (`CreditLedger`); balances are derived.

### 7.1 Product analytics

First-party: events go to our own API and stay in our Postgres. There is no third-party tracker, no cookie and no IP address stored.

**What is collected**

| Where | What |
| --- | --- |
| Browser (`lib/analytics.ts`) | A random id per browser (localStorage), a 30-minute session id (a new UTM campaign starts a new session), the page path with ids and secret slugs replaced (`/r/:slug`, `/edit/:id`; `normalisePath`), no query string except UTM tags; first-touch and session attribution (utm_source/medium/campaign/term/content, the referring site's domain, the landing path); interface language; the currency prices were shown in; a country guessed from the time zone; event props from the catalog |
| API (`AnalyticsService`) | Device class (mobile/tablet/desktop) and browser family from the User-Agent, which is not stored; the country from `cf-ipcountry` / `x-vercel-ip-country` when a proxy sets it, else the browser's guess. Bots, scripts and headless browsers are dropped (`isBot`) |
| Server-side events | `signed_up` (Better Auth hook), `purchase_completed`, `subscription_started` / `_renewed` / `_cancelled`, `payment_failed`, `payment_refunded` (billing webhooks, through the `AnalyticsRecorder` port), `import_finished` (worker). They use `u:<userId>` as their anonymous id |

**What is not collected**: names, emails, CV or letter text, job titles, free text, IP addresses, full referrer URLs, full User-Agents, query strings. Browsers sending Do Not Track or Global Privacy Control send nothing at all (and the API drops such requests too).

**Tables**: `analytics_events` (indexed columns for session, path, referrer, UTM, device, browser, country, locale, currency; `props` JSON for the rest), `analytics_visitors` (one row per browser: first-touch attribution and the account it was linked to), `users.acquisition` (first touch, copied once), `mrr_movements` (append-only MRR changes per subscription and currency), and the billing tables.

**Identity stitching**: the first event a browser sends while signed in links its anonymous id to the account (`analytics_visitors.user_id`, never moved afterwards) and, if the browser was seen before the account existed (or within the hour after), copies its first touch onto `users.acquisition`. Reports count people as `COALESCE(user, linked user, browser)`, so funnels carry across sign-up and devices.

**Reports** (`modules/analytics`, admin only): one SQL aggregate query per need behind the `AnalyticsReportsRepository` port; funnels, cohorts, MRR and period comparison in `@cvb/domain`; results cached five minutes. Dimension filters are person-level first touch (the account's acquisition, else the browser's first visit); the currency filter applies to money only. Revenue reads billing records (subscriptions with amount and interval, `mrr_movements`, invoices/payments/refunds/failed payments in `billing_events`, passes, expert orders), never browser events, and never adds currencies together. Yearly plans count as a twelfth per month; trials don't count; past-due still counts until cancelled.

**Retention**: raw events are deleted after 13 months by the daily maintenance job (a year plus a month: the 12-month report stays complete, though its comparison with the year before only covers what is left); anonymous visitors not seen for 13 months go too. Deleting an account nulls the user id on its events and visitors.

**No rollup table yet** (decision): at current volumes the reports read raw events through time-range indexes (`created_at`, `(name, created_at)`, `(anonymous_id, created_at)`, `(user_id, created_at)`), and the five-minute cache absorbs repeat views. Add a daily rollup (per day × event × dimensions, written by the worker) when the 12-month reports get slow, roughly past a few million events; the report port won't change.

**Adding an event**
1. Add it to `ANALYTICS_EVENT_CATALOG` in `packages/contracts/src/analytics.ts` with a label, group, `client: true` if browsers send it, and the `feature` it counts towards in the usage report.
2. Call `track("name", props)` in the web app (props: ids from our own catalog and small enums, never personal data), or `AnalyticsRecorder.record("name", { userId, props })` in the API.
3. If a report needs it as a step or a column, add it to the query in `prisma-analytics-reports.repository.ts` and to the domain helper or service.

**Sample data**: `pnpm db:seed:analytics` writes about 180 days of clearly marked fake activity for local checks (`--clear` removes it, `--dry-run` writes nothing); it refuses to run with `NODE_ENV=production`.

---

## 8. Patterns catalogue

| Pattern | Where | Why |
| --- | --- | --- |
| Ports and adapters (hexagonal) | Repositories, `JobProducer`, `EmailSender`, `ResumeParser`, `ImportResults`, `FileStorage`, `PaymentGateway`, `TemplateCatalog`, `MaintenanceStore`; on the web, `DocumentController` | Swap infrastructure, test without it |
| Repository | `*Repository` + Prisma adapter | Keeps queries out of use cases |
| Dependency injection | Nest providers with symbol tokens | Explicit wiring at the composition root |
| Strategy | Email senders, payment gateways (Stripe, local wallets), document stores (guest, cloud) | Pick an implementation per environment or market |
| Query service (CQRS-lite) | `AdminService` | Reports that join across features read Prisma directly instead of bending repositories |
| Idempotent receiver | `BillingEvent` table keyed by provider event id | Payment webhooks can arrive twice |
| Facade | `EntitlementsService` | One call answers "what plan does this user have right now" |
| Registry | Template catalog + `COMPONENTS` map | Add templates without touching consumers |
| Factory | `createDbClient`, `redisConnection`, `DatabaseModule.forRootAsync`, `QueueModule.forRootAsync` | One way to build shared infrastructure |
| Adapter / anti-corruption | `planToDomain`/`planToDb`, `toRecord`, `toDto` | Database and HTTP shapes never leak into the domain |
| Specification / policy | `can()`, `canUseTemplateTier()`, `LIMITS` | Entitlements as data, testable in isolation |
| Result type | `@cvb/shared` `Result` | Expected failures without exceptions where it reads better |
| Null object / placeholder | `UnavailableGateway` (local payments), `ConsoleEmailSender`, `StaticTemplateCatalog` | Ship the wiring before the provider |

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
| End to end | Playwright | Guest build → sign-up with migration → autosave → gating → share link + public page → Word/PDF → import → admin (script kept outside the repo for now; to move into `apps/web/e2e`) |
| Contract | Type-level check in `contracts/src/resume.ts` | Schema and domain type can never drift |

`pnpm check` runs lint, typecheck and tests across the repo; CI runs the same plus a build and `prisma migrate deploy` against a fresh Postgres.

---

## 11. Running locally

```bash
cp .env.example .env
pnpm install
pnpm services:up          # Postgres + Redis (Docker)
pnpm db:migrate           # apply migrations
pnpm db:seed              # dev@cvbuilder.local (Premium) and admin@cvbuilder.local, password "password123"
pnpm db:seed:analytics    # optional: ~180 days of sample analytics data for /admin/analytics
pnpm dev                  # web :3000, api :4000, worker
```

Open http://localhost:3000 and sign in, or create an account (emails are printed by the worker when `SMTP_URL` is empty). With `DEV_AUTH=true`, scripts can also call the API as a user:

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
| 9 | Better Auth for accounts | Library, not a service: our database, our domain, plugins for magic links and admin; Prisma adapter |
| 10 | Own VPS: Docker Compose + Caddy | One server runs everything (web, api, worker, Postgres, Redis); automatic HTTPS; images from GHCR. See docs/DEPLOYMENT.md |
| 11 | PDF and Word built in the browser | The preview is the PDF (same DOM), no headless browser to host; the API gates what's saved, the client gates downloads |
| 12 | Locked templates are previewable, not savable | Scope promise ("people should always see what they would get") without a loophole in stored data |
| 13 | ATS score and job match are deterministic domain code; AI only writes | Instant, free and testable scoring; AI cost goes where it adds value, and every AI edit is reviewed (diffs, pick-one suggestions) |
| 14 | AI behind an `Assistant` port with an offline implementation | Works without a key (development, tests, demos); Claude models chosen per task tier (fast vs smart) by config |
| 15 | Credits charged only on success, allowance before purchased packs | Fair metering; append-only ledger with the pool in the reason |
| 16 | Job boards behind a `JobFeedProvider` port; Remotive on by default | No key needed to start; Jooble and Adzuna switch on with keys; one failing board never breaks the feed; ten-minute cache per query |
| 17 | Fractional card positions on the tracker board | A move writes one row (the midpoint of its neighbours), so drag and drop stays cheap and conflict-free |
| 18 | Link analytics store a daily visitor hash, never raw IPs | Unique-viewer counts without keeping personal data; bots are counted but don't trigger emails |
| 19 | Browser extension uses personal access tokens (hashed) | No third-party cookies; revocable per device; the extension computes match scores locally with the same domain code |
| 20 | Expert payments: platform charges, pays experts on completion (Stripe Connect transfers) | Refunds and disputes are settled before money leaves the platform; commission is explicit per order; dev gateway marks orders paid when Stripe isn't configured (DEV_AUTH only) |
| 21 | One `reviewAccess()` policy for experts and career-office reviewers | Every route that shows someone else's CV asks the same question; comments are anchored to CV lines, not page positions |
| 22 | Organisation seats raise the member's plan through entitlements | No separate licence logic in features: `can(plan, …)` keeps working, the plan source says "organization" |
| 23 | Host-based routing (Next proxy) + Caddy on-demand TLS for portfolio and white-label domains | One deployment serves the app, `<slug>.PORTFOLIO_DOMAIN` sites and verified custom domains; certificates only for domains the API vouches for |
| 24 | In-house i18n (en/ur/ar) with logical CSS everywhere; CV direction separate from UI language | No dependency; RTL layouts mirror via `ms/me/ps/pe/start/end`; a CV can be RTL while the UI is English and vice versa |
| 25 | First-party analytics in our Postgres; reports from raw events (no rollup yet); revenue from billing tables | No third-party tracker or cookie banner; one source of truth for money; a rollup can be added behind the same port when volume needs it |

New significant decisions get a short ADR in `docs/adr/NNN-title.md` and a row here.
