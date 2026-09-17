# EPIC SPEC: First run, install, and the covenant nudge

## Quality differentiator (this EPIC is held to it)

**Least effort to a clinical record.** This app must demand less of a sick
person than any other route to a doctor-ready illness history, measured in
minutes per flare instead of entries per day.

**What it demands of THIS EPIC.** These are the lifecycle edges around the
core loop, and every one of them must protect the "least effort" promise
instead of taxing it. The guided first run has to walk a brand-new,
low-energy user to their first logged flare without a wall of text or a
setup form. Install has to be one tap the app offers at the right moment,
never a modal that blocks the core action. The covenant nudge exists
because a forgotten open flare quietly corrupts the record the user came
for, but it may cost the user exactly one calm question, once, and never
become the schedule this whole product refuses to be. If any surface here
makes the app feel like a tracker that wants attention, this EPIC has
betrayed its differentiator.

---

## 1. Scope

### In scope
- **A guided first run**: a skippable path of 2 to 4 imperative steps,
  anchored to the real Start-a-flare control and the onset sheet, that
  walks a brand-new user to one genuinely logged flare (their first
  success). It appears only while the user has no flares, and never again
  for a returning user. It never blocks the core action.
- **PWA installability**: a valid web app manifest, real icons, and a
  service worker that precaches the app shell and serves it offline. The
  app meets browser install criteria. An install prompt is offered at
  first success and is dismissible; once dismissed or installed it does
  not reappear.
- **The covenant nudge**: exactly one in-app prompt, "Is this flare still
  going?", surfaced for an open flare that has been open longer than a
  fixed quiet threshold (N days, §3.5). It offers to close the flare or
  keep it open, is recorded once per flare so it never repeats, and is
  evaluated only when the user opens the app, never on a timer or
  calendar. Closed flares and recent flares never prompt.
- Authorization, Zod validation, and rate limiting on the one new mutation
  route; designed empty/loading/error states carried over from the
  existing patterns; every new surface legible at 390px; a mechanical copy
  sweep of every new user-visible string, including the manifest and the
  offline page.
- **Non-goal guards extended**: the guard suite fails on any push,
  notification, email, or scheduling primitive anywhere in the app source
  AND in the new service worker.

### Out of scope (later EPICs or never)
- The product-wide polish/performance audit.
- Any change to the reconstruction/one-pager flow, the ledger, export, the
  flare editor, or the end-of-flare interview beyond the small hooks §3.7
  names on `FlareStarter` and the home screen.
- Rich onboarding (accounts setup wizard, condition picker, tours beyond
  the single first-success path).
- Offline **writing** or background sync. Offline means the shell loads
  and explains itself; creating or editing flares still needs the network.

### Non-Goals (binding, a defect if built)
- **No notification engine.** No `Notification` API, no `showNotification`,
  no `Notification.requestPermission`, no push subscription, no
  `PushManager`, no web-push. The service worker caches the shell only.
- **No scheduled email.** No mailer call, no `nodemailer`, no reminder
  email, nothing that contacts the central mailer.
- **No calendar-scheduled prompts.** Nothing here uses `setInterval`, a
  long `setTimeout`, `cron`, or any wall-clock trigger. The nudge is
  decided at page render from stored data, in response to a user visit.
- **No more than one unsolicited prompt per opened flare.** Once a flare
  has been nudged, it is never nudged again, whatever the user chose.
- **No streaks, daily check-ins, reminders, charts, trend lines, or
  correlation views** (standing product bans; the existing guard test
  must keep passing over the new files).

---

## 2. The covenant (read before building)

The product's whole thesis is that it never asks on a schedule. The nudge
is the one exception the plan allows, and it is allowed only because a
forgotten open flare silently damages the record the user is here to
build. Hold the line:

1. **It is user-triggered, not scheduled.** The nudge is computed in the
   home screen's server render when the user opens the app. There is no
   timer anywhere. If the user never opens the app, they are never nudged.
2. **It is once per flare, forever.** The first time a flare is surfaced
   for a nudge, that fact is written to the flare row. It is never
   surfaced again, no matter what the user does with the prompt.
3. **It is calm and answerable.** One short question, two plain choices,
   no red badges, no counts, no "you have N open flares" pressure. The
   whole point is to protect the record without becoming the nag the user
   fled.

If an implementation choice trades any of these away for engagement, it is
the wrong choice.

---

## 3. Technical design

Build on the existing stack unchanged: Next.js App Router (RSC screens +
Route Handlers under `src/app/api/*`), PostgreSQL 16 with Prisma, Zod at
every boundary, cookie sessions resolved server-side, the in-process rate
limiter, Sentry/Umami gated on env. Reuse the existing helpers:
`requireUser`, `guardMutation`, `errorResponse`, `jsonResponse`
(`src/lib/api.ts`); `getCurrentUser` for RSC pages; `todayUtc`,
`daysBetween`, `parseIsoDate` (`src/lib/date.ts`); `onsetText` and the
hedged display helpers (`src/lib/display.ts`); `serializeFlare`
(`src/lib/serialize.ts`); and the CSS vocabulary already in `globals.css`
(`btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `card`, `stack`,
`row`, `pill`, `muted`, `lede`, `sheet`, `sheet-scrim`, `sheet-handle`,
`no-print`, `form-error`).

No new dependencies. No PWA framework (`next-pwa`, Workbox, etc.): the
service worker is a small hand-written file. No state library, no timers.

### 3.1 Files and modules

Create:
```
prisma/migrations/0004_flare_nudge/migration.sql   # forward-only, §3.4
src/lib/covenant.ts               # QUIET_DAYS + pure nudge-selection logic
src/app/api/flares/[id]/nudge/route.ts   # POST: record the one nudge for a flare
src/components/FirstRun.tsx        # client: the guided first-success path
src/components/CovenantNudge.tsx   # client: the single "still going?" prompt
src/components/InstallPrompt.tsx   # client: dismissible add-to-home-screen offer
src/components/ServiceWorkerRegister.tsx  # client: registers /sw.js
public/manifest.webmanifest        # PWA manifest, §3.6
public/sw.js                       # service worker: precache + offline shell, §3.6
public/offline.html                # branded offline fallback, §3.6
public/icons/icon-192.png          # real PNG, §3.6
public/icons/icon-512.png          # real PNG, §3.6
public/icons/maskable-512.png      # real PNG, maskable safe zone, §3.6
public/apple-touch-icon.png        # real PNG, 180x180, §3.6
tests/covenant.test.ts             # QUIET_DAYS threshold + selection rules
e2e/firstrun.spec.ts               # guided path, skip, first-success gating
e2e/pwa.spec.ts                    # manifest/sw/icons/offline/install offer
e2e/covenant.spec.ts              # nudge fires once, close/keep, never repeats
```

Modify:
```
prisma/schema.prisma               # Flare.nudgedAt
src/app/layout.tsx                 # manifest + apple icons metadata; mount ServiceWorkerRegister
src/app/(app)/home/page.tsx        # flareCount -> FirstRun; nudge selection -> CovenantNudge; InstallPrompt
src/components/FlareStarter.tsx     # optional onStarted/onSaved hooks (§3.7)
src/app/globals.css                # first-run highlight, nudge card, install banner styles
tests/nonGoalGuard.test.ts         # push/email markers; scan public/sw.js
tests/copy.test.ts                 # sweep public/offline.html and manifest strings
README.md                          # short section: install, guided first run, the one gentle check
```

### 3.2 The database change (forward-only migration `0004_flare_nudge`)

One nullable column on `flares` records that a flare has been nudged once.
Null means "not yet nudged"; a timestamp means "nudged, never again".

```sql
ALTER TABLE flares ADD COLUMN nudged_at timestamptz;
```

Prisma model gains:
```prisma
nudgedAt DateTime? @map("nudged_at") @db.Timestamptz(6)
```

No index: the home screen already loads a bounded set of the user's open
flares (`take: 10`), and nudge selection runs over those rows in memory.
`serializeFlare` is unchanged; `nudgedAt` is internal and never shipped in
a DTO. No change to `treatments` or any other table.

### 3.3 First success and returning-user detection

"First success" = the user has at least one flare row. The home RSC adds a
count:
```ts
const flareCount = await prisma.flare.count({ where: { userId: user.id } });
```
- `flareCount === 0` -> a brand-new user who has never logged a flare;
  render `<FirstRun />` (the guided path) unless the user skipped it on
  this device.
- `flareCount >= 1` -> the user has succeeded at least once; never render
  `FirstRun` again. This is the durable "never for a returning user"
  guarantee, independent of any client storage.

Tapping "Start a flare" creates the flare immediately (existing
`POST /api/flares`), so `flareCount` becomes 1 the moment the user acts.
The guided path therefore self-limits: after the first flare exists, the
server stops rendering it.

### 3.4 The covenant nudge: selection logic (`src/lib/covenant.ts`)

Pure, unit-tested, no clock inside (the caller passes `today`). The nudge
targets a flare that has been **open for more than N days** and has not
been nudged before.

```ts
// src/lib/covenant.ts
export const QUIET_DAYS = 14;

export type NudgeCandidate = {
  id: string;
  onsetDate: Date;      // the flare's stored onset (UTC date)
  status: string;       // "open" | "closed"
  nudgedAt: Date | null;
};

// Returns the single flare to nudge on this visit, or null. Among the
// caller's open, never-nudged flares whose onset is more than QUIET_DAYS
// days before `today`, pick the one open longest (smallest onsetDate);
// break ties by id ascending for determinism.
export function selectCovenantNudge(
  flares: NudgeCandidate[],
  today: Date,
): NudgeCandidate | null;
```

Rules the function enforces (each a unit test in §5):
- **Threshold.** Eligible iff `daysBetween(onsetDate, today) > QUIET_DAYS`.
  Exactly `QUIET_DAYS` days is NOT eligible (strictly more than N).
- **Open only.** `status !== "open"` is never eligible. A closed flare is
  never nudged.
- **Once only.** `nudgedAt !== null` is never eligible.
- **One per visit.** Returns at most one flare, so the user is never
  swarmed even if several open flares qualify. The longest-open one wins.
- **Determinism.** Same inputs, same output; ties broken by id. No
  `Date.now()`, no randomness inside the function.

**Why onset-age, not last-activity:** the tension the plan names is the
never-closed flare. A flare whose onset is more than two weeks back and is
still marked open is the record-corrupting case, and it is the same signal
whether the user opened the app yesterday or not. Measuring from onset is
also the only reading that is deterministically testable end-to-end
(a test can backdate onset through the existing onset flow; it cannot
fast-forward the wall clock). "Quiet" is honored by the mechanic itself:
the prompt is passive (surfaced only on a visit), single, and dismissible,
never a scheduled ping. (An activity-based reading was considered and
rejected on both counts.)

`QUIET_DAYS = 14` is a single named constant, easy to tune in review. Two
weeks catches a forgotten short-illness flare without pestering a genuinely
long one, and the once-and-dismissible design makes an early ask harmless.

### 3.5 The nudge API (`POST /api/flares/[id]/nudge`)

Records that a flare has been nudged, so it is never surfaced again. Called
by `CovenantNudge` the moment the prompt is shown (mark-on-surface), which
guarantees "exactly one" even if the user ignores the prompt and leaves.

- Auth: `requireUser` (401 without a session).
- Rate limit: `guardMutation(user.id)` (429 in product voice).
- Params: the `[id]` must be an existing flare owned by the caller; a
  missing or foreign id answers 404 "That flare isn't here." (reuse the
  existing phrasing).
- No request body.
- Behavior: if `nudgedAt` is already set, return 200 unchanged
  (idempotent). Otherwise set `nudgedAt = todayUtc()` (or `new Date()`)
  and return 200 `{ ok: true }`. Setting it will bump `updatedAt`; that is
  fine because `nudgedAt` being non-null already excludes the flare from
  future selection.
- No PII in logs (no note text, no email).

No new read endpoint: selection happens in the home RSC over the open
flares it already loads.

### 3.6 PWA: manifest, service worker, icons, offline

**Manifest (`public/manifest.webmanifest`).** Valid JSON with, at minimum:
```json
{
  "id": "/",
  "name": "Flare Ledger",
  "short_name": "Flare",
  "description": "Log a flare in seconds. Build a record your doctor can read.",
  "start_url": "/home",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f6f7f9",
  "theme_color": "#2f6f6a",
  "lang": "en",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
`background_color` matches `--bg`, `theme_color` matches the existing
`viewport.themeColor`. All manifest strings obey the copy bar (swept per
§3.9).

**Icons.** Real PNG files, not SVG (browser install criteria want raster
192 and 512). Generate simple brand icons: a teal (`#2f6f6a`) field with a
white mark, 192x192, 512x512, a 512x512 maskable variant with the mark
inside the ~80% safe zone, and a 180x180 `apple-touch-icon.png`. They must
be valid PNGs that resolve with 200 and correct content type. (The
existing `images: { unoptimized: true }` config means these are served as
static files; adding raster app icons does not conflict with that setting,
which is about the Next image optimizer, not about shipping icons.)

**Service worker (`public/sw.js`).** Small and hand-written. It MUST NOT
reference any notification or push API. It:
- On `install`: precache a fixed shell list (`/offline.html`,
  `/manifest.webmanifest`, the three icon files) and `skipWaiting()`.
- On `activate`: clean up old caches by version key and `clients.claim()`.
- On `fetch`: for navigation requests (`request.mode === "navigate"`), try
  the network first, and on failure serve the cached `/offline.html`
  (this is the fetch handler that makes navigations survive offline and
  satisfies install criteria). For same-origin static assets under
  `/icons/` and the manifest, serve cache-first. Everything else falls
  through to the network. Keep it a few dozen lines.
- Version the cache name (e.g. `flare-shell-v1`) so a later change can
  invalidate it.

**Offline fallback (`public/offline.html`).** A tiny standalone HTML page,
no app chrome, product voice, positive phrasing: a short heading, one line
telling the user their record is safe and to reconnect, and a "Try again"
link that reloads. Swept for copy tells (§3.9). Never a browser error
page, never a raw stack.

**Registration (`src/components/ServiceWorkerRegister.tsx`).** A `"use
client"` component that, in a `useEffect`, checks
`"serviceWorker" in navigator` and calls
`navigator.serviceWorker.register("/sw.js")`. It renders nothing. It uses
no timer and no notification API. Mount it once in the root layout.

**Root layout wiring (`src/app/layout.tsx`).** Add `manifest:
"/manifest.webmanifest"` to the exported `metadata` (and the apple touch
icon via `icons: { apple: "/apple-touch-icon.png" }`). Keep the existing
`viewport.themeColor`. Render `<ServiceWorkerRegister />` inside `<body>`.

### 3.7 Screens, components, and states (mobile-first, 390px baseline)

**Home (`/home`).** The RSC computes `flareCount` (§3.3) and the nudge
candidate (§3.4) from the open flares it already loads, then renders:
- `<FirstRun />` **only** when `flareCount === 0`.
- `<CovenantNudge ... />` for the selected flare, if any, when
  `flareCount >= 1`. Pass the flare id and its onset text
  (`onsetText(serializeFlare(flare))`) so the prompt reads naturally.
- `<InstallPrompt />` on the home screen (it self-suppresses during first
  run and when not installable; see below).
The one primary action on home stays "Start a flare". Nothing else on the
home layout changes.

**First run (`src/components/FirstRun.tsx`, client).** A calm guide, not a
modal wall. Suggested shape: a compact card at the top of the home stack
with a two-item checklist that ticks itself off, plus a subtle highlight on
the primary action. It drives the real flow by rendering the existing
`FlareStarter` with hooks:
- Step 1 (unchecked): copy "Start a flare." The `FlareStarter` primary
  button is the real control; highlight it.
- Step 2 (after the flare is created and the onset sheet is open): copy
  "Say when it began." The onset sheet is the real control.
- Success (after onset saves): copy "That is your first flare. Close it
  when it ends." plus the install offer and a "Done" button.
- A "Skip" affordance is present at every step.

Mechanics:
- The home RSC passes `flareCount === 0` in; `FirstRun` captures whether
  to show **once** on mount (a `useRef`/`useState` initializer) so a later
  `router.refresh()` that flips the prop cannot yank the success step away
  mid-flow.
- `FlareStarter` gains two optional props: `onStarted?()` (called when the
  create resolves / the onset sheet opens) and `onSaved?()`. When
  `onSaved` is provided, `FlareStarter` calls it INSTEAD of its current
  `router.refresh()`, handing control of "what happens after the first
  onset is saved" to `FirstRun`. Its default behavior (no props) is
  unchanged, so every other place that renders `FlareStarter` keeps
  working. `FirstRun` uses `onStarted` to advance to Step 2 and `onSaved`
  to advance to Success.
- Skip or Done writes a local flag (`localStorage["fl_firstrun_done"] =
  "1"`) so it does not flash again before the server sees the new flare,
  then calls `router.refresh()` to reveal the normal home. On mount,
  `FirstRun` renders nothing if that flag is already set.
- The guided path never blocks "Start a flare": the primary control stays
  live and usable even if the user ignores the guide.

Accessibility: the guide is keyboard reachable, the highlight is not
color-only (add a ring/outline that meets contrast and a visible focus
state), and every control keeps its label.

**Covenant nudge (`src/components/CovenantNudge.tsx`, client).** Props:
`{ flareId: string, onsetText: string }`. A single `card` (not a modal
that blocks the screen), with:
- Heading: "Is this flare still going?" and a muted line echoing the
  onset ("Open since around Aug 20." via the passed text).
- Two choices: a primary "It ended" and a secondary "Still going".
- On mount, fire-and-forget `POST /api/flares/{flareId}/nudge` to record
  the single nudge (mark-on-surface). A failed mark is swallowed (the
  prompt simply may appear again on a later visit; it never errors in the
  user's face).
- "It ended" opens the existing end-of-flare interview for that flare
  (reuse `EndFlareButton`/`EndInterview`; on close, `router.refresh()`).
- "Still going" dismisses the card locally (it is already recorded, so it
  will not return). No further request needed.
- Feedback within 100ms on both taps (pressed state / immediate hide).

**Install prompt (`src/components/InstallPrompt.tsx`, client).** A single
dismissible banner offering to install, shown at first success and after:
- In a `useEffect`, listen for `beforeinstallprompt`; call
  `event.preventDefault()` and stash the event. Render nothing until an
  event is captured.
- Suppress while first run is active: do not render when
  `localStorage["fl_firstrun_done"]` is unset AND the user has no flares
  (pass a `firstRunActive` prop from home, or gate on the same
  `flareCount === 0` signal). The banner therefore first appears right
  after the first flare exists, i.e. at first success.
- The banner: one line ("Add Flare Ledger to your home screen.") a primary
  "Add" that calls the stashed `prompt()`, and a "Not now" dismiss.
- Dismiss or a successful install writes `localStorage["fl_install_dismissed"]
  = "1"`; the banner never returns after that. Also listen for
  `appinstalled` to hide it. If already running in standalone
  (`matchMedia("(display-mode: standalone)")`), never show it.
- No timer, no notification API.

**States (whole EPIC).**
- Empty: a brand-new user's home is the guided first run itself, which is a
  designed, positive surface telling them what to do first. No blank
  region.
- Loading: reuse the existing `(app)/loading.tsx` skeleton; no new white
  screens. The install and nudge cards hold their own layout.
- Error: the one nudge mutation fails quietly (mark-on-surface is
  best-effort); the end-of-flare interview keeps its existing product-voice
  error with retry. Offline navigation shows `offline.html`, not a browser
  error.

### 3.8 Security, performance, logging

- The one new mutation route resolves the session server-side, scopes the
  flare lookup by `userId`, and answers 404 on a missing or foreign id, so
  there is no cross-user path to mark another user's flare.
- `guardMutation` rate-limits the nudge POST per user. No new read route.
- Nudge selection runs over the bounded set of open flares already loaded
  by the home RSC; it adds one `count` query. No unindexed hot-path query,
  nothing that scales with another user's data.
- No PII in logs anywhere in the new code (no note text, no email, no
  flare content).
- No new env vars, no new secrets. The service worker and manifest are
  static and carry nothing sensitive.

### 3.9 Copy (suggested strings, already swept)

Final wording is the implementer's, held to QUALITY BAR §7 and §8 (no
em-dashes or en-dashes, positive and direct, short, no banned vocabulary,
no negative empty-state phrasing). Sweep mechanically before done, and
include the manifest and `offline.html` in the sweep. Suggested:
- First run checklist: "Start a flare.", "Say when it began.", success
  "That is your first flare. Close it when it ends.", "Skip", "Done".
- Covenant nudge: "Is this flare still going?", "It ended", "Still going".
- Install: "Add Flare Ledger to your home screen.", "Add", "Not now".
- Offline page: heading "Offline", body "Your ledger is safe. Reconnect to
  open it.", link "Try again".
- Reuse the existing voice for errors: "That flare isn't here.",
  "You're going quickly. Try again in a minute.", "Check your connection
  and try again."

Note the negative-phrase list in `tests/copy.test.ts` bans "nothing here",
"unable to", "something went wrong", "you don't have", "no flares yet".
Keep every new string clear of them. "Offline" as a heading is factual and
allowed; do not write "You are offline and something went wrong".

### 3.10 Guards (non-goal and copy)

- `tests/nonGoalGuard.test.ts`:
  - Add MECHANICAL markers so a push, notification, or email path fails the
    suite anywhere in `src/app`, `src/components`, `src/lib`:
    `/PushManager|pushManager|web-?push/i` (label "push subscription"),
    and `/nodemailer|central-mailer|X-Internal-Key/i` (label "email
    path"). The existing `new Notification|Notification.requestPermission|
    showNotification` marker already covers notifications; keep it.
  - Add a dedicated assertion that reads `public/sw.js` (and, if present,
    `public/offline.html`) and fails on any of
    `/PushManager|pushManager|showNotification|Notification|web-?push|
    setInterval|\bcron\b/i`. The service worker lives outside the scanned
    `src` ROOTS, so it needs this explicit check to prove "no push
    anywhere".
  - The existing scheduling (`setInterval`, long `setTimeout`, `cron`),
    charting, filter/share, and LLM markers must keep passing over the new
    files. In particular the covenant selection uses no timer, and the
    service worker no notification.
- `tests/copy.test.ts`: add a small block that reads
  `public/offline.html` and `public/manifest.webmanifest` and asserts they
  carry no em/en dash, no banned vocabulary, and no negative phrasing, so
  the manifest and offline strings are swept like shipped UI copy. Add
  `src/lib/covenant.ts` to the `.ts` ROOTS as well (it should carry no
  user-visible copy, but the sweep keeps that honest).

### 3.11 Seed and staging

No seed change. The seeded demo user already has flares, so:
- The guided first run never shows for the demo (correct: it is for a
  brand-new user; a fresh signup on staging gets it).
- The demo's open flare has an onset 3 days back, below `QUIET_DAYS`, so no
  covenant nudge fires for the demo on load (correct: the demo showcases
  the reconstruction differentiator, not a nag).
On staging, a brand-new signup lands on the guided first run and reaches a
first logged flare within a minute, and the app is installable. Both are
load-bearing for the QUALITY BAR first-run clause without any hand-crafted
input.

---

## 4. Ordered task list (each with acceptance criteria)

**T1. Migration + model.** `0004_flare_nudge` per §3.2 and the Prisma
`Flare.nudgedAt` field.
- AC: `prisma migrate deploy` applies cleanly on an existing EPIC 1-4
  database; `nudged_at` exists and defaults to null; `serializeFlare` and
  the existing flare tests still pass unchanged.

**T2. Covenant selection logic.** `src/lib/covenant.ts` with `QUIET_DAYS`
and `selectCovenantNudge` per §3.4, unit-tested.
- AC (unit): a flare open more than `QUIET_DAYS` days is selected; exactly
  `QUIET_DAYS` days is not; a closed flare is never selected; a flare with
  `nudgedAt` set is never selected; with several eligible open flares the
  longest-open one is returned and ties break by id; the function is
  byte-deterministic and uses no clock internally.

**T3. Nudge endpoint.** `POST /api/flares/[id]/nudge` per §3.5.
- AC (e2e API): first call on an owned flare returns 200 and sets
  `nudgedAt`; a second call is idempotent (200, still one timestamp); a
  foreign or missing id returns 404; no session returns 401; flooding
  returns 429. A re-read of the flare (via the existing GET) confirms the
  flare is now excluded from future nudge selection.

**T4. Covenant nudge UI.** `CovenantNudge` plus home wiring per §3.7.
- AC (e2e UI at 390px): for a signed-in user whose open flare has an onset
  more than `QUIET_DAYS` days back, the home screen shows exactly one
  "Is this flare still going?" card with "It ended" and "Still going";
  choosing "It ended" opens the end-of-flare interview; after the prompt
  is surfaced, reloading home shows no nudge for that flare (recorded
  once); a flare with a recent onset shows no nudge; a closed flare shows
  no nudge; no horizontal scroll; touch targets >= 44px.

**T5. Guided first run.** `FirstRun`, the `FlareStarter` hooks, and home
gating per §3.3 and §3.7.
- AC (e2e UI at 390px): a brand-new user (no flares) sees the guided path
  of 2 to 4 imperative steps anchored to the real Start-a-flare and onset
  controls; completing it logs one real flare and reaches the success
  state; the path is skippable at any step and does not block the primary
  action; after a first flare exists, reloading home never shows the guide
  again; a returning user (with flares) never sees it; no horizontal
  scroll.

**T6. PWA install + offline.** Manifest, icons, service worker,
registration, layout metadata, and `InstallPrompt` per §3.6 and §3.7.
- AC (e2e): `/manifest.webmanifest` is linked from the document and parses
  with `name`, `start_url`, `display: "standalone"`, and 192 + 512 PNG
  icons that each resolve 200; the service worker registers and controls
  the page; with the browser context offline, a navigation renders the
  cached offline shell rather than a browser error; after first success,
  an install offer appears (driven by a `beforeinstallprompt` event) and
  is dismissible, and once dismissed it does not reappear on reload.

**T7. Guards + README.** Extend `nonGoalGuard` and `copy` per §3.10; add a
short README section (install to home screen; the guided first run; the one
gentle check on a long-open flare), verified against how the app runs.
- AC: the non-goal guard fails on any push, notification, email, or
  scheduling primitive in `src/app`, `src/components`, `src/lib`, or
  `public/sw.js`, and passes on the delivered tree; the copy sweep covers
  the new components, the manifest, and `offline.html`, and passes; the
  README stays accurate and free of factory internals.

**Copy sweep (part of DONE, not a separate task).** Mechanically search
every added or edited user-visible string (components, `offline.html`, the
manifest, README example copy) for em/en dashes, the banned vocabulary,
and negative empty-state phrasing; fix every hit.

---

## 5. Test plan (which automated test proves each planner criterion)

| Planner criterion | Test | What it asserts |
|---|---|---|
| Guided first run: 2 to 4 imperative steps on real controls, to a first success; only until first success; never for a returning user | e2e `firstrun.spec.ts` | New user sees the guided path; completing it logs a real flare and hits success; skippable at any step; gone after a flare exists and for any user with flares; no horizontal scroll at 390px |
| Installable PWA (valid manifest, service worker, install criteria); shell loads offline; install prompt at first success, dismissible | e2e `pwa.spec.ts` | Manifest linked and valid with 192/512 PNG icons resolving 200; SW registers and controls the page; offline navigation serves the cached shell; install offer appears after first success and hides on dismiss and stays hidden |
| Open flare open > N quiet days surfaces exactly one nudge; close or keep; never repeats; never on a schedule; closed/recent never prompt | Unit `covenant.test.ts` + e2e `covenant.spec.ts` | Threshold at `QUIET_DAYS`, open-only, once-only, one-per-visit, deterministic (unit); UI shows one prompt with close/keep, records once, does not return after surfacing, and stays silent for recent and closed flares (e2e); no timer anywhere |
| No push, no email, no calendar-scheduled prompts (Non-Goal guard, verified) | `tests/nonGoalGuard.test.ts` | Push/notification/email/scheduling markers fail the suite across `src/app`, `src/components`, `src/lib`, and `public/sw.js`; the delivered tree passes |
| All new user-visible strings swept for banned copy tells | `tests/copy.test.ts` + manual sweep | Components, `offline.html`, and the manifest carry no em/en dash, banned vocabulary, or negative phrasing |

Plus: the existing Vitest and Playwright suites must stay green (in
particular `nonGoalGuard`, `copy`, `ledger`, `export`, `interview`,
`appointments`, `reconstruction`). Run both suites in the foreground to
completion before declaring success.

---

## 6. Assumptions (resolved, non-blocking)

- **"First success" = at least one flare row.** The server counts flares;
  zero means guide, one or more means done forever. This holds across
  devices and needs no extra column. A device-local `fl_firstrun_done` flag only
  prevents a flash before the server sees the new flare and records a skip
  pre-first-flare; the server count is authoritative for "returning user".
- **"N quiet days" is measured from onset**, `QUIET_DAYS = 14`, strictly
  greater than. Rationale and the rejected activity-based reading are in
  §3.4. It is the reading that is both faithful to the never-closed-flare
  tension and deterministically testable end-to-end.
- **Mark-on-surface** records the single nudge the moment the prompt is
  shown, so "exactly one / never repeats" holds even if the user ignores
  it and leaves. A failed mark is best-effort and simply risks one more
  appearance on a later visit, never an error.
- **One nudge per visit.** Even if several open flares qualify, only the
  longest-open is surfaced, so the calm-not-nag covenant holds. The
  non-goal ("no more than one per opened flare") is honored per flare by
  `nudgedAt`; the one-per-visit rule is the stricter, safer UX choice.
- **The service worker caches the shell only.** Offline means the app
  opens to a branded shell that explains itself; offline writing and
  background sync are out of scope and unbuilt.
- **Icons are real PNGs**, generated as simple brand marks, because
  browser install criteria want raster 192 and 512. This does not conflict
  with `images: { unoptimized: true }`, which governs the Next image
  optimizer, not static asset delivery.
- **No appointment/flare data model change beyond `nudgedAt`.** The nudge
  needs one nullable timestamp; nothing else in the schema moves.
- **`beforeinstallprompt` is simulated in e2e.** Headless Chromium does not
  fire it organically, so `pwa.spec.ts` dispatches a synthetic
  `beforeinstallprompt` (with a stub `prompt()` and `preventDefault`) to
  prove the offer renders after first success and dismisses correctly. The
  constituent install criteria (manifest, icons, SW with a fetch handler)
  are asserted directly.
