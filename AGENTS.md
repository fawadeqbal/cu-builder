# Notes for coding agents

Read `ARCHITECTURE.md` first. The rules that matter most:

- Business rules go in `packages/domain` (no framework imports). Boundary shapes go in `packages/contracts` (zod).
- In the API, follow the feature-module layout: controller → service → repository port → Prisma adapter, wired in `<feature>.module.ts`. Inject ports by token; never import Prisma or BullMQ in a service.
- Throw `AppError` subclasses from `@cvb/shared` for expected failures; don't throw HTTP exceptions from services.
- Import packages by their entry point (`@cvb/db`, `@cvb/db/nest`), never `src/` or `dist/`.
- Node apps are ESM with `NodeNext`: relative imports end in `.js`.
- Pin exact dependency versions; allow native build scripts in `pnpm-workspace.yaml` → `allowBuilds`.
- Before finishing: `pnpm check` and `pnpm build` must pass.

`apps/web` is Next.js 16: see `apps/web/AGENTS.md` for its version-specific notes.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
