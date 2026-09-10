# EPIC SPEC — Walking skeleton: the button, onset, and staging deploy

## Quality differentiator (this EPIC is held to it)

**Least effort to a clinical record.** This app must demand less of a sick
person than any other route to a doctor-ready illness history, measured in
minutes per flare instead of entries per day.

**What it demands of THIS EPIC.** The one path this EPIC ships, starting a
flare, must cost the user the fewest possible taps and zero typing in the
common case. Pressing "Start a flare" records the flare on the first tap.
Setting the onset is a second tap for the two common answers ("Today", "A
few days ago"). Only "Around a date" asks for one date pick. No form, no
required text, no severity, no login friction beyond email and password.
Every screen in this EPIC is judged against "did it ask for one gram more
than it had to?"

---

## 1. Scope

### In scope
- Application scaffold: one deployable web service (mobile-first frontend +
  JSON API) plus a PostgreSQL database.
- Email + password auth: sign up, sign in, sign out, server-side sessions.
- Home screen with exactly one primary action, "Start a flare", plus the
  current open flare when one exists and a quiet link to the ledger.
- One-tap flare start that immediately asks "When did it start?" with fuzzy
  onset options (today / a few days ago / around a date), persisted per user.
- A minimal read-only ledger screen: a designed empty state, and when flares
  exist a simple chronological list (onset, status, duration for closed).
- Boundary input validation and rate limiting on mutations and auth.
- Designed empty, loading, and error states for the screens in this EPIC.
- Staging deploy scaffold: committed `Dockerfile` and
  `docker-compose.staging.yml`, a public healthcheck endpoint, and
  observability (Sentry + Umami) wired via env with graceful degradation.
- `SEED_DEMO=1` seeding: a demo user with a reconstruction-ready flare
  history so a stranger opening staging sees real content within a minute.

### Out of scope (build in later EPICs, not here)
- The flare-end interview and closing a flare from the UI (EPIC 2).
- The full ledger: flare detail, edit, treatment display, export, and the
  ledger's own perf pass (EPIC 3). This EPIC ships only the empty state plus
  a minimal capped list.
- Pre-appointment reconstruction and the one-page render (EPIC 4).
- The guided first-run overlay, PWA install, and the covenant nudge (EPIC 5).
- Any product-wide polish audit (EPIC 6).

### Non-Goals (binding — a defect if built)
- **No flare-end interview** in the UI. This EPIC never closes a flare
  through an interview flow.
- **No reconstruction** of any timeline, and no appointment entity.
- **No analytics views or charts** of the user's own data. (Umami product
  analytics is infra, not a user-facing chart.)
- **No scheduled prompts of any kind**: no reminders, no daily check-in, no
  streaks, no email or push. If a timer or cron that nudges the user appears
  anywhere, it is a defect.
- **No LLM** anywhere in this EPIC. No key entry surface, no model calls.

---

## 2. First-run and the quality bar (read before building)

The QUALITY BAR requires a first-run that lets a brand-new user understand
the product and reach the core action, and it requires a guided walkthrough.
The product plan assigns the **guided walkthrough overlay to EPIC 5**. Do not
build that overlay here. In this EPIC the bar is met by clarity, not by a
tour:
- The first screen states in one short line what the app does and shows one
  obvious action.
- The empty ledger names the first action in positive phrasing.
- The core action (start a flare, set onset) is reachable in one tap and is
  self-evident.

This is the correct reading of the bar-and-scope rule: the core action is
reachable without documentation, so nothing is being traded away. The 2-to-4
step guided path arrives in EPIC 5. Building it now is drift; omitting
first-run clarity is a defect. Deliver the clarity, not the overlay.

---

## 3. Technical design

### 3.1 Stack (concrete — build on this)
- **Runtime / language:** Node.js 20, TypeScript.
- **Framework:** Next.js (App Router). React Server Components render the
  screens (fast first meaningful render); Route Handlers under `app/api/*`
  serve the JSON API. One process, one Dockerfile, one container.
- **Database:** PostgreSQL 16. **Prisma** ORM with forward-only migrations
  committed under `prisma/migrations/`.
- **Validation:** Zod schemas at every API boundary.
- **Auth:** email + password. Passwords hashed with **argon2id**. Sessions
  are opaque, stored in a `sessions` table, referenced by an httpOnly,
  Secure, SameSite=Lax cookie. Session lookup on every protected request.
- **Rate limiting:** a small in-process fixed-window limiter module keyed by
  IP for auth and by user id for mutations. In-memory is acceptable for the
  single staging instance. Note in code that a shared store is a later
  concern; do not add Redis in this EPIC.
- **Observability:** `@sentry/nextjs` initialized only when `SENTRY_DSN` is
  set; the Umami script tag rendered only when `UMAMI_WEBSITE_ID` and
  `UMAMI_URL` are set. Both absent means the app runs normally.
- **Tests:** Vitest for unit and API-integration tests (against a disposable
  Postgres); Playwright for browser and mobile-viewport checks.

If the implementer has a strong reason to deviate from Next.js, the contract
below (routes, status codes, data model, env, deploy) is authoritative and
must be honored by whatever stack replaces it. Do not deviate on the
contract.

### 3.2 Files and modules to create (indicative tree)
```
Dockerfile
docker-compose.staging.yml
.env.example                      # placeholders only, tracked
.dockerignore
package.json / tsconfig.json / next.config.js
prisma/schema.prisma
prisma/migrations/**              # forward-only
prisma/seed.ts                    # SEED_DEMO demo user + history
src/lib/db.ts                     # Prisma client singleton
src/lib/auth.ts                   # hashing, session create/verify, current user
src/lib/rateLimit.ts              # in-process fixed-window limiter
src/lib/validation.ts             # Zod schemas (auth, onset)
src/lib/onset.ts                  # onset-choice -> {onset_date, onset_precision}
src/lib/observability.ts          # Sentry + Umami gating
src/app/api/health/route.ts
src/app/api/auth/signup/route.ts
src/app/api/auth/signin/route.ts
src/app/api/auth/signout/route.ts
src/app/api/me/route.ts
src/app/api/flares/route.ts       # POST create, GET list
src/app/api/flares/[id]/route.ts  # GET one, PATCH onset
src/app/(auth)/signin/page.tsx
src/app/(auth)/signup/page.tsx
src/app/(app)/home/page.tsx       # the button + open flare
src/app/(app)/ledger/page.tsx     # empty state + minimal list
src/components/*                   # button, onset sheet, states, skeletons
tests/**                           # vitest + playwright
```

### 3.3 Data model (forward-only migration)

This EPIC's app code reads and writes `users`, `sessions`, and `flares`
(onset and status). The `flares` end/severity columns and the `treatments`
table are created now and populated **only by the demo seed**, because the
acceptance criteria require a reconstruction-ready demo history and later
EPICs render it. Do not build UI flows that write end/severity/treatments in
this EPIC. Later EPICs add their own columns (`impact_note`, `symptom_note`,
`nudged_at`, appointments) in their own migrations.

**Migration `0001_init`:**

`users`
- `id` uuid pk
- `email` text unique, not null (stored lowercased)
- `password_hash` text not null
- `condition_label` text null  *(reserved; not edited in this EPIC)*
- `created_at` timestamptz not null default now()

`sessions`
- `id` uuid pk  *(the opaque session token; store a hash of it, not the raw)*
- `user_id` uuid fk -> users(id) on delete cascade, indexed
- `expires_at` timestamptz not null
- `created_at` timestamptz not null default now()

`flares`
- `id` uuid pk
- `user_id` uuid fk -> users(id) on delete cascade, **indexed** (hot path)
- `status` text not null default `'open'`  *(check in (`'open'`,`'closed'`))*
- `onset_date` date not null
- `onset_precision` text not null  *(check in (`'exact'`,`'approx'`))*
- `end_date` date null            *(seed only this EPIC)*
- `end_precision` text null        *(seed only this EPIC)*
- `peak_severity` smallint null    *(seed only this EPIC; scale 1..5)*
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- index on `(user_id, created_at desc)` for the ledger query

`treatments`  *(seed only this EPIC; no UI writes it here)*
- `id` uuid pk
- `flare_id` uuid fk -> flares(id) on delete cascade, indexed
- `name` text not null
- `started_on` date null
- `started_precision` text null
- `helped` text null  *(check in (`'yes'`,`'no'`,`'unsure'`))*
- `note` text null
- `created_at` timestamptz not null default now()

### 3.4 Onset semantics (`src/lib/onset.ts`)
Given the user's choice, the **server** derives the stored values. The client
never sends a computed onset_date for the fuzzy options.
- `today` -> `onset_date = <server today>`, `onset_precision = 'exact'`.
- `few_days_ago` -> `onset_date = <server today> - 3 days`,
  `onset_precision = 'approx'`. (The 3-day anchor is a documented default;
  it is shown to the user as "a few days ago", never as a hard date.)
- `around_date` -> requires `around_date` (ISO `YYYY-MM-DD`);
  `onset_date = around_date`, `onset_precision = 'approx'`.

"Today" must render as an exact date. The two approx options must render as
hedged text ("a few days ago", "around <month day>"), never as false
precision. Compute "today" from the server clock in UTC; document this so
tests are deterministic.

### 3.5 API contract

Envelope: JSON request and response. Errors return
`{ "error": { "message": "<product voice>" } }` with the status below. No
stack traces, no internal error strings, no PII in the body.

**Public routes (no session required):**
- `GET /api/health` -> `200 { "status": "ok" }`. Must not touch auth and
  must return 200 whenever the process is up (it may check the DB and return
  `503` if the DB is unreachable; 200 otherwise). Used by the compose
  healthcheck.
- `POST /api/auth/signup` `{ email, password }` -> `201`, sets session
  cookie. Validation: email is a valid address; password length 8..200.
  Duplicate email -> `409`. Rate-limited by IP.
- `POST /api/auth/signin` `{ email, password }` -> `200`, sets session
  cookie. Bad credentials -> `401` (do not reveal which field failed).
  Rate-limited by IP.

**Protected routes (valid session required; no session -> `401`):**
- `POST /api/auth/signout` -> `204`, clears the cookie and deletes the
  session row. Rate-limited.
- `GET /api/me` -> `200 { id, email, condition_label }`.
- `POST /api/flares` -> `201 { flare }`. Creates an open flare with a
  provisional onset (`onset_date = today`, `onset_precision = 'exact'`) so
  the flare is recorded on the first tap. Rate-limited by user.
- `PATCH /api/flares/:id` `{ onset_choice, around_date? }` -> `200 { flare }`.
  Sets the onset per §3.4. **This EPIC accepts only onset fields**; any other
  field in the body is rejected with `400`. The flare must belong to the
  caller, else `404`. Rate-limited by user.
- `GET /api/flares` -> `200 { flares: [...] }`. The caller's flares only,
  newest first, capped (default and max limit 50 in this EPIC). Indexed by
  `(user_id, created_at desc)`.
- `GET /api/flares/:id` -> `200 { flare }` for the owner, else `404`. Lets
  the onset sheet reload the persisted choice.

**Authorization rule:** every route except the three public routes above
loads the session server-side and returns `401` when it is missing or
expired. Ownership is checked on every `:id` route; a mismatch returns `404`
(do not confirm existence of another user's row). Hiding a UI control is
never the access check.

**Validation rule:** reject at the boundary with `400`:
- unknown `onset_choice`;
- `around_date` missing when choice is `around_date`, or not a valid
  `YYYY-MM-DD`, or in the future, or more than 730 days before today;
- malformed email, out-of-range password length;
- unexpected fields on the flare PATCH body.

**Rate-limit rule:** auth endpoints limited per IP (e.g. 10 requests / 60s);
mutations (`POST/PATCH/DELETE`) limited per user (e.g. 60 / 60s). Over the
limit returns `429` with a product-voice message. Values are configurable via
env with the defaults above.

### 3.6 Screens and states (mobile-first, 390px baseline)

**Sign in / Sign up.** Email + password only. One primary button. Inline
field errors in product voice. Labeled inputs, visible focus, keyboard
reachable.

**Home (`/home`).**
- New user (no flares): one short line of what the app does, and one obvious
  primary button "Start a flare". This doubles as the first-run clarity in
  §2.
- With an open flare: show the open flare (hedged onset text) prominently and
  a quiet link to the ledger. "Start a flare" stays available and starts a
  new flare.
- Pressing "Start a flare": optimistic pressed state within 100ms, navigate
  to the onset sheet immediately while `POST /api/flares` resolves.

**Onset sheet.** Title "When did it start?" Three tap targets: "Today", "A
few days ago", "Around a date". Choosing one of the first two is a single tap
that saves and dismisses. "Around a date" reveals a native date input, then
saves. The saved choice persists across reload (re-fetched via
`GET /api/flares/:id`). Every target is at least 44px.

**Ledger (`/ledger`).**
- Empty: a designed empty state that says what the screen is for and the
  first action, in positive phrasing, with a "Start a flare" button.
- Non-empty: a simple newest-first list. Each row shows onset (hedged when
  approx), status, and duration when closed. No detail navigation, no
  treatments, no export in this EPIC.

**Global states.**
- Loading: skeleton placeholders that hold the layout steady on home and
  ledger. No white screen, no lone spinner with no exit.
- Error: product-voice message with a retry affordance. No raw stack trace,
  no error code shown to the user.

**Copy rules.** Every visible string obeys QUALITY BAR §7 and §8: one obvious
action per screen, words cut to the minimum, positive phrasing, no em-dashes
or dash-asides, none of the banned LLM vocabulary. Sweep before done. Suggested
strings (final wording is the implementer's, held to the same bar):
- Home line: "Log a flare in seconds. Build a record your doctor can read."
- Primary action: "Start a flare".
- Onset title: "When did it start?"; options "Today" / "A few days ago" /
  "Around a date".
- Empty ledger: heading "Your flares will live here." body "Start one the
  moment it begins. It takes a tap." button "Start a flare".
- Generic error: "Check your connection and try again."

### 3.7 Observability, secrets, logging
- Initialize Sentry only when `SENTRY_DSN` is present; wire it into the
  backend (and the frontend where the framework supports it). Absent DSN:
  no init, no crash.
- Render the Umami script only when `UMAMI_WEBSITE_ID` and `UMAMI_URL` are
  present. Absent: no tag, no crash.
- Secrets come from env only. `.env` is untracked (add to `.gitignore` and
  `.dockerignore`). `.env.example` carries placeholder keys only:
  `DATABASE_URL`, `SESSION_SECRET` (if used for cookie signing), `SENTRY_DSN`,
  `UMAMI_URL`, `UMAMI_WEBSITE_ID`, `SEED_DEMO`, `RATE_LIMIT_*`.
- **No PII in logs.** Never log email addresses, passwords, session tokens,
  or request bodies containing them. Log a user by id only.

### 3.8 Deploy scaffold
- **`Dockerfile`:** multi-stage build producing a production start of the
  app. Runs DB migrations on start (or a documented pre-start step), then
  serves. Exposes the app port.
- **`docker-compose.staging.yml`:** two services, `app` and a `db`
  (Postgres 16 with a named volume). `app` depends on `db` being healthy,
  reads env from `.env`, and defines a healthcheck that polls
  `GET /api/health`. `docker compose -f docker-compose.staging.yml up` must
  build from the committed Dockerfile and serve the app end to end.
- Honor the `SEED_DEMO` convention: when `SEED_DEMO=1`, seeding runs on
  start (idempotently) so a fresh staging environment shows demo content.

### 3.9 Demo seed (`SEED_DEMO=1`)
Idempotent (safe to run repeatedly; keyed on the demo email). Creates:
- One demo user with known credentials documented in the README.
- At least **two closed past flares** with realistic onset and end dates and
  peak severity, spread across recent months, plus at least one **open**
  flare so the home screen shows a live state.
- Treatments on the closed flares that make the history reconstruction-ready,
  including one flare where a named treatment (for example naproxen) started
  on day one and that flare is noticeably shorter, so EPIC 4's headline has
  real source data.
The result: opening staging and signing in as the demo user shows real
flares in the ledger and an open flare on home within a minute, with no hand
input. The seed copy is user-visible in later EPICs; sweep it for banned
tells now.

---

## 4. Ordered task list (each with acceptance criteria)

**T1. Project scaffold and healthcheck.**
- Next.js + TypeScript app builds and starts. `GET /api/health` returns
  `200 { status: "ok" }` and is reachable without a session.
- AC: `docker compose -f docker-compose.staging.yml up` builds from the
  committed Dockerfile, brings up app + db, and the compose healthcheck goes
  healthy hitting `/api/health`.

**T2. Data model and migration.**
- `prisma/schema.prisma` and `0001_init` create `users`, `sessions`,
  `flares`, `treatments` per §3.3, with the indexes named there.
- AC: migration applies cleanly on an empty database; `flares(user_id)` and
  `(user_id, created_at desc)` indexes exist.

**T3. Auth and sessions.**
- Sign up, sign in, sign out with argon2id hashing and DB-backed sessions in
  an httpOnly Secure SameSite=Lax cookie.
- AC: a new user can sign up and sign in. `GET /api/me` returns the user with
  a valid session and `401` without one. Signout deletes the session and
  clears the cookie. Duplicate signup email returns `409`. Bad signin returns
  `401` without revealing the failing field.

**T4. Server-side authorization on every route.**
- All routes except `/api/health`, `/api/auth/signup`, `/api/auth/signin`
  require a valid session; `:id` routes check ownership.
- AC: an automated test hits every protected route with no session and gets
  `401`; hitting another user's flare id returns `404`.

**T5. Start a flare + fuzzy onset + persistence.**
- `POST /api/flares` records an open flare on first tap. The onset sheet sets
  the choice via `PATCH /api/flares/:id`; server derives onset per §3.4.
- AC: pressing "Start a flare" records a flare and immediately shows "When
  did it start?" with the three fuzzy options. After choosing and reloading,
  `GET /api/flares/:id` returns the persisted onset and the UI shows it.
- AC: "Today" stores exact; "A few days ago" and "Around a date" store
  approx and render hedged.

**T6. Boundary validation and rate limiting.**
- Zod validation on auth and onset; in-process limiter on auth (per IP) and
  mutations (per user).
- AC: malformed onset (unknown choice, missing/invalid/future `around_date`,
  unexpected field) returns `400`. Exceeding the auth or mutation limit
  returns `429`. Both messages are product voice.

**T7. Home, ledger, and designed states.**
- Home shows exactly one primary action and any open flare. Ledger shows a
  designed empty state, and a minimal newest-first list when flares exist.
  Loading skeletons and product-voice error states everywhere in this EPIC.
- AC: at a 390px viewport there is no horizontal scroll, the "Start a flare"
  target is at least 44px, and text is readable without zoom.
- AC: the empty ledger states the screen's purpose and the first action in
  positive phrasing (no "You don't have", "No ... yet", "Nothing here").
- AC: no screen in this EPIC shows a white screen, a lone dead-end spinner,
  or a raw stack trace.

**T8. Observability and secrets hygiene.**
- Sentry gated on `SENTRY_DSN`, Umami gated on `UMAMI_WEBSITE_ID` +
  `UMAMI_URL`. `.env.example` placeholders only; `.env` untracked.
- AC: with all observability env unset the app starts and serves normally
  (no crash). No secret appears in any tracked file. No email, password, or
  token appears in logs.

**T9. Demo seed.**
- `SEED_DEMO=1` seeds the demo user, closed past flares with treatments, and
  an open flare, idempotently, per §3.9.
- AC: on a fresh database with `SEED_DEMO=1`, signing in as the documented
  demo user shows at least two past flares in the ledger and an open flare on
  home, with no hand input, within a minute.

**T10. README for strangers.**
- `README.md`: what the app is (two or three plain sentences), how to run it
  (exact clone / env / `docker compose -f docker-compose.staging.yml up`
  commands verified against the committed compose file), the demo user
  credentials, where the code lives, and how to run the tests. No factory
  internals.
- AC: a stranger can follow the README to a running app and a green test run.

**Copy sweep (part of DONE, not a separate task).** Before finishing,
mechanically search every user-visible string added or edited (components,
pages, seed copy, error messages, `.env.example` comments if user-facing) for
`—`, `–`, the banned LLM vocabulary, and negative empty-state phrasing. Fix
every hit.

---

## 5. Test plan (which automated test proves each criterion)

| Acceptance criterion | Test type | What it asserts |
|---|---|---|
| Compose builds and serves; healthcheck 200 | Integration / CI | Build the image, `compose up`, poll `/api/health` until `200`; assert healthy |
| Sign up and sign in work | API (Vitest) | Signup then signin succeed; cookie set; `/api/me` returns the user |
| Every route rejects unauthenticated request (401) | API (Vitest) | Table-driven: each protected route with no cookie returns `401`; cross-user `:id` returns `404` |
| One primary action, tappable at 390px, no h-scroll | Playwright (390px) | `document.scrollWidth <= innerWidth`; "Start a flare" bounding box height and width >= 44px; exactly one primary button |
| Press records a flare and asks onset; persists on reload | Playwright | Click starts flare, onset sheet appears with three options; choose; reload; onset still shown; `GET /api/flares/:id` matches |
| Onset precision mapping | API (Vitest) | today->exact; few_days_ago->approx with today-3; around_date->approx with given date |
| Malformed onset rejected (400) | API (Vitest) | unknown choice, missing/invalid/future around_date, extra field each return `400` |
| Mutations and auth rate-limited (429) | API (Vitest) | Exceed configured limit -> `429`; auth per IP, mutation per user |
| Empty ledger: designed, positive phrasing | Playwright + lint | Empty state renders purpose + action; string scan finds no banned negative phrasing |
| SEED_DEMO shows real content | Integration | Seed a fresh DB; sign in as demo; ledger has >= 2 past flares, home has an open flare |
| Missing observability env degrades gracefully | Integration | Start with `SENTRY_DSN`/`UMAMI_*` unset; app serves; no crash; no Umami tag, no Sentry init |
| No secrets in tracked files; no PII in logs | Test + scan | Grep tracked files for secret patterns; assert logger never receives email/password/token |
| Loading and error states designed | Playwright | Force a slow/failing fetch; assert skeleton present (layout stable) and product-voice error with retry, no stack trace |
| Copy sweep | Lint/script | Scan user-visible strings for `—`, `–`, banned vocabulary, negative empty-state phrasing; zero hits |

Every criterion above must have a green automated test before the EPIC is
`success`. Run the full suite in the foreground to completion.

---

## 6. Assumptions (resolved, non-blocking)
- Single staging instance, so an in-process rate limiter and in-DB sessions
  are sufficient; a shared store is deferred (raise a `requested_task` only
  if multi-instance staging is later required).
- "Today" is computed from the server clock in UTC for determinism.
- The demo user credentials are documented in the README and are for staging
  demonstration only; they are not a secret and carry no real PII.
- The `flares` end/severity columns and `treatments` table exist for the
  reconstruction-ready seed and later EPICs; no EPIC 1 UI flow writes them.
