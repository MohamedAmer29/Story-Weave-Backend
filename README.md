# AI Illustrated Story Backend

NestJS + TypeScript + PostgreSQL (TypeORM) + Redis (BullMQ) + Cloudinary +
Cloudflare Workers AI (FLUX.1 Schnell) backend for an AI illustrated story
platform.

Key capabilities:

- JWT authentication (access + refresh cookie), roles, IDOR protection
- Story creation / editing / sharing / public & private reading / search
- Story Context (era, year, location, civilization, theme + custom values)
- Story segmentation (1000-char pages, never split words, remainder rules)
- PDF upload & Arabic text extraction
- AI illustration queue (BullMQ) for story pages and covers
- Cloudinary image upload / delete
- Notifications (REST + WebSocket) and audit logs
- Admin dashboard endpoints
- Redis-backed rate limiting, OTP, public cache, and AI neuron accounting

## Project setup

```bash
npm install
```

## Running (local development)

```bash
# development (watch mode)
npm run start:dev

# production build
npm run build
npm run start:prod
```

## Tests

```bash
npm run test        # unit tests
npm run test:e2e    # end-to-end tests
npm run test:cov    # coverage
```

## Environment variables

Copy `.env.example` to `.env.local` (local) or set them via your deployment.
All secrets are read from the environment — never hardcode them.

Key groups:

| Group | Variables |
| ----- | --------- |
| Application | `NODE_ENV`, `PORT`, `API_PREFIX`, `FRONTEND_URL` |
| Database | `DATABASE_URL` (or `DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME`), `DATABASE_SYNCHRONIZE`, `DATABASE_LOGGING` |
| Redis | `REDIS_URL` (or `REDIS_HOST/PORT/PASSWORD`) |
| JWT / Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `AUTH_REFRESH_*`, `OTP_*` |
| Email | `SMTP_HOST/PORT/USER/PASS/FROM` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` |
| Cloudflare AI | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `AI_MODEL`, `AI_NEURON_*`, `AI_IMAGE_CONCURRENCY` |
| CORS / Swagger | `CORS_ORIGIN`, `CORS_ENABLED`, `CORS_CREDENTIALS`, `SWAGGER_ENABLED` |

> **Production safety:** The app refuses to start with
> `DATABASE_SYNCHRONIZE=true` or `DATABASE_LOGGING=true`. Use migrations.

---

# Production Deployment (Docker)

## Requirements

- Docker + Docker Compose
- A domain with HTTPS (reverse proxy / load balancer recommended)
- Cloudflare credentials (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`)
- Cloudinary credentials (`CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`)
- SMTP credentials for email
- A strong `JWT_SECRET`

## 1. Configure the environment

Create a `.env` file (or set real environment variables on the host).
**.env is gitignored — never commit real secrets.** Use `.env.example` as a
template and fill in real values.

```bash
cp .env.example .env
# edit .env and set: JWT_SECRET, DATABASE_PASSWORD, CLOUDINARY_*, CLOUDFLARE_*,
# SMTP_*, CORS_ORIGIN=https://your-frontend-domain.com
```

For production override at least:

```env
NODE_ENV=production
DATABASE_PASSWORD=change-me
JWT_SECRET=change-me-to-a-long-random-string
CLOUDFLARE_API_TOKEN=change-me
CLOUDINARY_CLOUD_NAME=change-me
CLOUDINARY_API_KEY=change-me
CLOUDINARY_API_SECRET=change-me
CORS_ORIGIN=https://your-frontend-domain.com
```

## 2. Build and start the stack

The Compose stack runs three containers: `app` (NestJS), `postgres`, `redis`.

```bash
docker compose build
docker compose up -d postgres redis   # start infrastructure
```

Confirm they are healthy:

```bash
docker compose ps
```

## 3. Run database migrations

Migrations are **not** run automatically — run them explicitly so the schema is
created before the app starts (the app uses `synchronize: false`).

```bash
docker compose run --rm migrate
```

This executes `npm run migration:run:prod` (compiled TypeORM migrations).

## 4. Start the application

```bash
docker compose up -d app
```

Or start everything with one command:

```bash
docker compose up -d --build
# then run the migration as a one-off:
docker compose run --rm migrate
```

The app listens on the published `PORT` (default `3000`) and is behind an
internal Docker network shared only with Postgres and Redis. Postgres and Redis
are **not** exposed to the host by default.

## 5. Health checks

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/health` | **Liveness** — is the process alive? |
| `GET /api/health/ready` | **Readiness** — reports `database` and `redis` status |

Example readiness response:

```json
{ "status": "ok", "checks": { "database": "ok", "redis": "ok" } }
```

The Compose `app` service has a healthcheck that waits until migrations/db/redis
are ready before reporting healthy.

## 6. Logs

```bash
docker compose logs -f app         # NestJS / BullMQ worker logs
docker compose logs -f postgres    # PostgreSQL logs
docker compose logs -f redis       # Redis logs
```

Logs are structured and include a correlation `requestId`; clients may supply
their own `X-Request-ID` header which is echoed and used in logs.

## 7. Graceful shutdown

```bash
docker compose stop app
```

On SIGTERM/SIGINT the application:

- stops accepting new BullMQ jobs and lets current jobs finish where practical
- closes the BullMQ worker, the shared Redis clients, TypeORM, and the HTTP server

## 8. Persistent storage

- **PostgreSQL**: stored in the `postgres_data` volume (survives restarts).
- **Redis**: `redis_data` volume with AOF persistence (BullMQ + neuron accounting).
- **Images**: uploaded/generated images live in Cloudinary, not the container.

> Containers are ephemeral. Never rely on the container filesystem for permanent
> story data.

## 9. Reproduction & upgrade

Migrate to new versions:

```bash
# build new image
docker compose build app
# bring down the app (keeps the database volume)
docker compose stop app
# start infrastructure if needed, then run migrations
docker compose up -d postgres redis
docker compose run --rm migrate
# start the new app
docker compose up -d app
```

## 10. Security notes

- App runs as a **non-root** user in the final image.
- No `.env` or secrets are baked into the image (see `.dockerignore`).
- Swagger is **disabled in production** by default. Force it on with
  `SWAGGER_ENABLED=true` only if you control the deployment.
- HSTS is only sent when `NODE_ENV=production`. Ensure production is served over
  HTTPS (reverse proxy recommended).
- JWT refresh cookies are `HttpOnly` and `Secure` in production (`SameSite=strict`).
- Rate limiting, OTP, and AI neuron accounting are **Redis-backed**, so they stay
  globally correct even if you scale to multiple app containers.

## 11. Database backup strategy

The Compose Postgres volume is **not** a backup. Back up the database regularly:

- **Frequency**: at least daily (more if write volume is high).
- **How** (logical dump from the Postgres container):

  ```bash
  docker compose exec postgres \
    pg_dump -U $DATABASE_USERNAME -d $DATABASE_NAME \
    --format=plain > backup_$(date +%F).sql
  ```

  Or a custom-format dump for compressed, restorable backups:

  ```bash
  docker compose exec postgres \
    pg_dump -U $DATABASE_USERNAME -d $DATABASE_NAME \
    --format=custom -f /tmp/backup.dump \
  ```

- **Retention**: keep e.g. 7 daily, 4 weekly, 6 monthly dumps off-host.
- **Restore**:

  ```bash
  # plain SQL
  docker compose exec -T postgres psql -U $DATABASE_USERNAME -d $DATABASE_NAME < backup.sql
  # custom format
  docker compose exec postgres pg_restore -U $DATABASE_USERNAME -d $DATABASE_NAME /tmp/backup.dump
  ```

- **Migration strategy**: track migrations in Git; run `migrate` before deploying
  a new app version. Back up before destructive migrations.

## 12. Troubleshooting

| Issue | Likely cause / fix |
| ----- | ------------------ |
| App keeps restarting / health `error` | Database or Redis not ready yet — check `docker compose ps` shows both `healthy`. |
| `Missing required environment variable` | A required var isn't set in `.env`. Check the startup log for the list (values are never printed). |
| Migration failure | Wrong `DATABASE_URL`/host or permissions; run `docker compose run --rm migrate` again after fixing. |
| Cloudflare config failure | `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` missing/invalid. |
| Cloudinary upload failure | `CLOUDINARY_*` missing/invalid. |
| PDF parsing failure | Unsupported/encrypted/embedded-font PDF; file over 10 MB limit. |
| Queue jobs stuck | Redis unavailable or worker not started — check worker logs. |
| `Cannot find module '@nestjs/platform-socket.io'` | Stale image; rebuild with `docker compose build`. |

---

## Scripts

```bash
npm run build          # compile to ./dist/src
npm run start:prod     # node dist/src/main.js
npm run migration:run  # dev migrations (TS data-source)
npm run migration:run:prod  # prod migrations (compiled data-source)
npm run test           # unit tests
npm run lint           # eslint (--fix)
```
