# syntax=docker/dockerfile:1.7
#
# One Dockerfile, three images:
#   --target web     Next.js standalone server            (small: only what the server traces)
#   --target server  NestJS api and worker, and migrations (same image, different command)
#
# Build from the repository root:
#   docker build -f infra/Dockerfile --target web    -t cvb-web .
#   docker build -f infra/Dockerfile --target server -t cvb-server .

# Override to pull from a mirror, e.g. --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22.22.0-alpine
ARG NODE_IMAGE=node:22.22.0-alpine

FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
# Same pnpm as "packageManager" in package.json (pnpm 12 ships as a native binary per platform).
RUN npm install -g pnpm@12.10.1 && pnpm --version
WORKDIR /repo

# 1. Keep only the workspaces the three apps need, so unrelated changes don't bust the cache.
FROM base AS pruned
COPY . .
RUN pnpm dlx turbo@2.11.7 prune @cvb/web @cvb/api @cvb/worker --docker

# 2. Install (cached on the lockfile alone), then build.
FROM base AS build
COPY --from=pruned /repo/out/json/ .
COPY --from=pruned /repo/.npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruned /repo/out/full/ .
# The web server's fallback route to the API inside the compose network (Caddy normally gets there first).
ENV API_INTERNAL_URL=http://api:4000
RUN pnpm turbo run build --filter=@cvb/web... --filter=@cvb/api... --filter=@cvb/worker...

# 3a. Web: the standalone server plus static assets.
FROM ${NODE_IMAGE} AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]

# 3b. Server: api (default), worker and migrations share one image.
FROM base AS server
ENV NODE_ENV=production STORAGE_DIR=/data/storage
COPY --from=build --chown=node:node /repo /repo
# Uploaded files; compose mounts a volume here (a new volume takes this owner).
RUN mkdir -p /data/storage && chown node:node /data/storage
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:4000/api/v1/health/live >/dev/null || exit 1
CMD ["node", "apps/api/dist/main.js"]
