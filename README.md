# Flare Ledger

A record for episodic chronic illness that never asks you to check in on a
schedule. You press one button when a flare starts and answer one short
question about when it began, so a history of your flares builds up from a few
taps a month instead of a daily diary. Over time it becomes a doctor-ready
account of your illness that you correct rather than compose.

This repository is the walking skeleton: sign up, start a flare, set a fuzzy
onset, and read a minimal ledger. The flare-end interview, the one-page
pre-appointment timeline, and the guided first run arrive in later milestones.

## Run it locally

You need Docker with the Compose plugin. From the repository root:

```bash
git clone <this-repo-url> flare-ledger
cd flare-ledger
docker compose -f docker-compose.dev.yml up
```

The app comes up at http://127.0.0.1:3000. The first boot installs
dependencies inside the container and applies the database migrations
automatically, so give it a minute. The dev stack sets `SEED_DEMO=1`, which
loads a small demo history on first boot.

Sign in with the demo account to see real content right away:

- Email: `demo@flareledger.app`
- Password: `flare-demo-2026`

These credentials are for the local and staging demo only. They hold no real
person's data.

## Configuration

Copy `.env.example` to `.env` and adjust as needed. Every value has a safe
default or degrades gracefully when unset:

- `DATABASE_URL` points at Postgres. The compose files set it for you.
- `APP_URL` is the public base URL. Session cookies derive their `Secure`
  flag from it (or from `x-forwarded-proto` behind a proxy).
- `SEED_DEMO=1` loads the demo history on first boot.
- `SENTRY_DSN` enables error tracking when set.
- `UMAMI_URL` and `UMAMI_WEBSITE_ID` enable analytics when both are set.
- `RATE_LIMIT_*` tune the request limits.

Secrets come from the environment only. Never commit a real value.

## Run the tests

Unit and API tests (Vitest, backed by an in-process Postgres so nothing
external is required):

```bash
npm ci
npm test
```

End-to-end tests (Playwright) run against the production build in the official
Playwright container, so they need no local browser install:

```bash
./scripts/e2e.sh
```

The whole suite starts from a clean, in-process database on every run, so
repeated runs never clash over leftover state.

## Deploy

`docker-compose.yml` is the production stack and `docker-compose.staging.yml`
is the staging stack. Both build the app from `Dockerfile`, run a Postgres 16
service, apply migrations on boot, and expose the app on container port 80
behind a reverse proxy. They read `POSTGRES_PASSWORD` and the observability
values from the environment.

## Where the code lives

- `src/app` holds the screens (React Server Components) and the JSON API under
  `src/app/api`.
- `src/lib` holds the core modules: auth and sessions, the rate limiter,
  onset math, validation, serialization, and the demo seed.
- `src/components` holds the client components (the flare button, the onset
  sheet, the auth form).
- `prisma/schema.prisma` and `prisma/migrations` define the database. Schema
  changes are forward-only migrations.
- `tests` holds the Vitest suites and `e2e` holds the Playwright specs.
