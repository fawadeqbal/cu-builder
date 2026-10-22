# Deploying CV Builder on a VPS

Everything runs on one Linux server with Docker Compose:

```
              ┌──────────── VPS ─────────────────────────────────────────────┐
 browser ───▶ │ Caddy :443 ──/api/*──▶ api :4000 ──▶ Postgres   Redis ◀── worker │
   HTTPS      │      └──── else ────▶ web :3000                   ▲           │
              │                         api and worker share the storage volume │
              └────────────────────────────────────────────────────────────────┘
```

| Service | Image | Notes |
| --- | --- | --- |
| `caddy` | `caddy:2.10.2-alpine` | HTTPS certificates from Let's Encrypt, security headers, routes `/api/*` to the API |
| `web` | `ghcr.io/<owner>/cu-builder-web` | Next.js standalone server |
| `api` | `ghcr.io/<owner>/cu-builder-server` | NestJS API and Better Auth |
| `worker` | same image, `node apps/worker/dist/main.js` | Emails, CV import, daily clean-up |
| `migrate` | same image, `pnpm --filter @cvb/db db:deploy` | Runs once per deploy, before the API starts |
| `postgres` | `postgres:16.10-alpine` | Data in the `pgdata` volume |
| `redis` | `redis:7.4-alpine` | Queues, append-only file in `redisdata` |

Files: `infra/Dockerfile`, `infra/docker-compose.prod.yml`, `infra/Caddyfile`, `infra/deploy.sh`, `infra/backup.sh`, `infra/.env.production.example`.

## 1. Server

A 2 vCPU / 4 GB VPS (Hetzner, DigitalOcean, Contabo…) with Ubuntu 24.04 is plenty to start.

```bash
# as root on the new server
adduser deploy && usermod -aG sudo deploy
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

Point DNS at the server: an `A` record for `cvbuilder.example.com` (and `www`) to the server's IP.

## 2. App folder

```bash
sudo mkdir -p /opt/cv-builder && sudo chown deploy: /opt/cv-builder
cd /opt/cv-builder
# copy the infra folder from the repository (scp, or a sparse git checkout)
scp -r infra/* deploy@<server>:/opt/cv-builder/
cp .env.production.example .env.production
nano .env.production       # fill in every value (see below)
chmod 600 .env.production
```

Required values:

| Variable | How to get it |
| --- | --- |
| `DOMAIN`, `APP_URL`, `API_CORS_ORIGINS` | Your domain (`APP_URL=https://<domain>`) |
| `ACME_EMAIL` | Email for Let's Encrypt notices |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 48` |
| `ADMIN_EMAILS` | Your email; that account becomes an admin when it signs up |
| `SMTP_URL`, `EMAIL_FROM` | Any SMTP provider (Postmark, Resend, SES, Brevo, Mailgun). Without it emails are only logged |

Optional: `GOOGLE_*`, `LINKEDIN_*` (sign-in buttons appear when set) and `STRIPE_*` (checkout is disabled without them).

## 3. Images

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds `cu-builder-web` and `cu-builder-server` and pushes them to GitHub Container Registry (`ghcr.io/<owner>/…`, tagged `latest` and the commit SHA).

The packages are private by default. Either make them public (GitHub → your profile → Packages → package → Package settings → Change visibility), or log the server in once with a token that has `read:packages`:

```bash
echo <token> | docker login ghcr.io -u <github-user> --password-stdin
```

Building on the server instead (no registry):

```bash
git clone https://github.com/fawadeqbal/cu-builder.git /opt/cv-builder/src
cd /opt/cv-builder/src
docker build -f infra/Dockerfile --target web    -t ghcr.io/fawadeqbal/cu-builder-web:latest .
docker build -f infra/Dockerfile --target server -t ghcr.io/fawadeqbal/cu-builder-server:latest .
```

## 4. First start

```bash
cd /opt/cv-builder
./deploy.sh                       # pulls images, migrates, starts everything
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api worker
```

Open `https://<domain>`, create your account with the email in `ADMIN_EMAILS`, and `/admin` is yours. Caddy fetches the certificate on the first request (give DNS a few minutes).

## 5. Automatic deploys

To let the workflow restart the server after each build:

1. Create an SSH key for GitHub Actions: `ssh-keygen -t ed25519 -f gh-deploy -N ""`, and append `gh-deploy.pub` to `/home/deploy/.ssh/authorized_keys` on the server.
2. In the repository: **Settings → Environments → New environment** `production`, then add secrets `VPS_HOST`, `VPS_USER` (`deploy`) and `VPS_SSH_KEY` (contents of `gh-deploy`).
3. **Settings → Secrets and variables → Actions → Variables**: `DEPLOY_ENABLED=true` (and `VPS_APP_DIR` if not `/opt/cv-builder`).

Each push to `main` then builds, pushes, and runs `IMAGE_TAG=<sha> ./deploy.sh` on the server. To roll back, run `IMAGE_TAG=<older sha> ./deploy.sh`. Migrations only move forward, so roll back code, not schema.

GitHub Pages is no longer used (the app now needs a server). Disable it under **Settings → Pages** if it was on.

## 6. Third-party settings

| Service | Setting |
| --- | --- |
| Google Cloud OAuth client | Authorized redirect URI `https://<domain>/api/auth/callback/google` |
| LinkedIn app (Sign In with LinkedIn using OpenID Connect) | Redirect URL `https://<domain>/api/auth/callback/linkedin` |
| Stripe | Webhook endpoint `https://<domain>/api/v1/billing/webhooks/stripe` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`; copy its signing secret to `STRIPE_WEBHOOK_SECRET`. Enable the Customer Portal (Settings → Billing → Customer portal). |
| Email | SPF, DKIM and DMARC records for the sending domain, as your SMTP provider describes |
| Anthropic (optional) | `ANTHROPIC_API_KEY` for AI writing, interviews and research; without it a built-in offline assistant answers |
| Job boards (optional) | Remotive works without a key (credit it and link to postings, as the feed does). Jooble: request a key at jooble.org/api/about → `JOOBLE_API_KEY`. Adzuna: create an app at developer.adzuna.com → `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY` (two letters, e.g. `gb`); Adzuna also powers the salary ranges |
| Link analytics | Put Cloudflare (or any proxy that sends `CF-IPCountry` / `X-Country-Code`) in front of Caddy to see viewer countries; without it countries are blank |
| Browser extension | Build with `pnpm --filter @cvb/extension build` and publish `apps/extension/dist` to the Chrome Web Store; people point it at `https://<domain>` and paste a key from Account → Browser extension |

## 6b. Portfolio sites and custom domains

Personal websites are served at `<slug>.<PORTFOLIO_DOMAIN>`; partners (white label) and paid users can connect their own domains. Caddy issues certificates on demand, after asking the API whether it serves the host (`GET /api/v1/public/domains/allowed?domain=`: only the app's own host, published portfolio sub-domains and verified custom domains get one).

1. Pick a domain for sites (it can be the main one or a separate one, e.g. `cvbuilder.app`) and add a **wildcard DNS record** `*.cvbuilder.app → <server IP>` (A record).
2. In `.env.production` set `PORTFOLIO_DOMAIN=cvbuilder.app`. Optionally set `CUSTOM_DOMAIN_TARGET` (the host people CNAME their domains to; default: the app's host) and `CUSTOM_DOMAIN_IPV4` (the server's public IPv4, for apex domains that can't use a CNAME).
3. The web container gets `APP_URL`, `PORTFOLIO_DOMAIN` and `API_INTERNAL_URL` from `docker-compose.prod.yml`; its proxy (`apps/web/src/proxy.ts`) rewrites a site's host to `/p/<slug>` and serves the normal app on partner domains.
4. Custom domains: the owner enters the domain in My website (or Organisation → Branding), adds the CNAME or A record shown, then presses **Check DNS**. Once verified, the first HTTPS visit gets a certificate automatically.

Without `PORTFOLIO_DOMAIN`, sites are still available at `https://<domain>/p/<slug>`.

## 7. Backups and upkeep

```bash
crontab -e
# nightly database dump at 02:30, 14 days kept in /opt/cv-builder/backups
30 2 * * * /opt/cv-builder/backup.sh >> /opt/cv-builder/backups/backup.log 2>&1
```

Copy `backups/` off the server too (for example `rclone` to object storage). Restore:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_restore -U cvb -d cvb --clean --if-exists < backups/cvb-<stamp>.dump
```

Uploaded CV files live in the `storage` volume and are deleted after 7 days by the worker; trashed CVs are purged after 30 days. Both jobs run daily at 03:17 server time.

Useful commands:

```bash
compose() { docker compose -f docker-compose.prod.yml --env-file .env.production "$@"; }
compose ps                         # health of every service
compose logs -f --tail=100 api     # API logs
compose exec postgres psql -U cvb  # database shell
compose restart worker
```

## 8. Scaling later

- More worker throughput: `WORKER_CONCURRENCY`, or `compose up -d --scale worker=3`.
- Move Postgres to a managed database and set `DATABASE_URL`; move files to S3-compatible storage by adding an adapter to `@cvb/storage`.
- Several API instances need shared files (S3) first; sessions are already in Postgres.
