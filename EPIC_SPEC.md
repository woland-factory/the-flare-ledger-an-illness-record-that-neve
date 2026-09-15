# EPIC SPEC: Pre-appointment reconstruction (signature moment)

## Quality differentiator (this EPIC is held to it)

**Least effort to a clinical record.** This app must demand less of a sick
person than any other route to a doctor-ready illness history, measured in
minutes per flare instead of entries per day.

**What it demands of THIS EPIC.** This is the moment the whole product exists
for: the user taps "Doctor visit coming up", and the app hands back a drafted
since-last-visit timeline they only correct, never compose. Every screen in
this flow is judged by "did this ask the user for one gram more than it had
to?" The draft must arrive already filled in from stored data; the correction
pass must be tap-to-fix, not re-entry; and the output must be one page a
rheumatologist can read across a desk. If the user has to write a paragraph,
re-type a date the app already knows, or assemble anything by hand, this EPIC
has failed its own differentiator.

---

## 1. Scope

### In scope
- **A new `Appointment` entity** (forward-only migration) holding a visit
  date, an optional specialty label, and a structured reconstruction
  snapshot (JSONB).
- **Creating an appointment** from a "Doctor visit coming up" action: the
  server deterministically drafts a timeline snapshot of the flares since
  the user's previous appointment (all recorded flares on the first), built
  only from stored `flares` and `treatments` rows. No model call anywhere.
- **Templated prose over the snapshot**: a data-built headline ("3 flares
  since March. Longest about 12 days. Naproxen started on day one, that
  flare was about half as long."), an honest coverage line ("Built from 3
  recorded flares, not a daily diary."), and compact per-flare lines, all
  produced by pure functions with exact, testable rules. Uncertainty stays
  hedged ("about 12 days"), never flattened into false precision.
- **The correction pass**: a screen where the user fixes any drafted value
  (dates with their precision, severity, treatments, the note) and adds a
  flare that was never logged, from inside the same screen. Every
  correction saves to the appointment snapshot via `PATCH`.
- **A one-page print view** per appointment: prints to a single clean page
  on A4 and Letter with print CSS, no app chrome, readable across a desk.
- **Entry points**: a quiet "Doctor visit coming up?" link on the home
  screen, and an appointments screen listing past visits with one primary
  create action and a designed empty state.
- Authorization, Zod validation, and rate limiting on every new route;
  designed empty, loading, and error states; the whole flow legible at
  390px; a mechanical copy sweep of every new user-visible string.
- **Non-goal guards extended**: the non-goal test also fails on any LLM
  marker in the app source, proving the reconstruction path is templated.

### Out of scope (later EPICs or never)
- The guided first-run overlay, PWA install, and the covenant nudge
  (**EPIC 5**). Do not build any onboarding here.
- The product-wide polish audit (**EPIC 6**).
- Editing ledger flares from the correction pass. Corrections live on the
  appointment snapshot only (see §3.2 and Assumptions); the ledger editor
  from EPIC 2 stays the way to change the underlying record.
- Sharing, emailing, or exporting the one-pager beyond printing it. The
  whole-record export from EPIC 3 is untouched.
- Deleting appointments. A wrong visit date or specialty is correctable via
  `PATCH`; a delete surface is not required by any criterion.

### Non-Goals (binding, a defect if built)
- **No AI-written narrative.** No LLM call, no gateway client, no
  key-entry surface, no "improve wording" button. All prose is templated
  over structured data by pure functions in `src/lib/reconstruction.ts`.
- **No calendar or weather ingestion.** Nothing in this flow reads any
  external source; the draft is built from this user's stored rows only.
- **No clinician portal.** No share link, no public route, no token access.
  The print view is a signed-in page the user prints themselves.
- **No scheduled prompts, reminders, streaks, charts, or dashboards**
  (standing product bans; the existing guard test must keep passing).

---

## 2. The signature moment (read before building)

The AMBITION BAR names this EPIC's deliverable as the product's signature:
the user walks in and reads one page aloud. Concretely, that means:

1. The headline is real, built from the user's own rows, and lands within
   seconds of tapping "Doctor visit coming up". On staging, the seeded demo
   user must produce exactly this headline on their first appointment:
   "3 flares recorded. Longest about 12 days. Naproxen started on day one,
   that flare was about half as long." (The existing seed data already
   supports it; verify, do not reshape the seed beyond what §3.9 allows.)
2. The user corrects, never composes. Every drafted value is editable in
   place with at most a tap and a small input. There is no blank text area
   asking them to describe their illness.
3. Coverage is stated plainly. The page says what it was built from and
   never pretends the gaps are absence of disease.

If an implementation choice trades any of these away for convenience, it is
the wrong choice.

---

## 3. Technical design

Build on the existing stack unchanged: Next.js App Router (RSC screens +
Route Handlers under `src/app/api/*`), PostgreSQL 16 with Prisma, Zod at
every boundary, cookie sessions resolved server-side on every protected
request, the in-process rate limiter, Sentry/Umami gated on env. Reuse the
existing helpers: `requireUser`, `guardMutation`, `errorResponse`,
`jsonResponse` (`src/lib/api.ts`); `getCurrentUser` for RSC pages;
`parseIsoDate`, `toIsoDate`, `todayUtc`, `addDays`, `daysBetween`,
`formatExact`, `formatMonthDay` (`src/lib/date.ts`); the hedged display
helpers (`src/lib/display.ts`); `serializeFlare` DTOs (`src/lib/serialize.ts`);
and the CSS vocabulary already in `globals.css` (`btn`, `btn-primary`,
`btn-secondary`, `btn-ghost`, `card`, `stack`, `row`, `pill`, `muted`,
`lede`, `empty`, `field`, `input`, `sheet`, `no-print`, `form-error`).

No new frameworks, no state library, no PDF library, no date library.
Printing is browser print with `@media print` CSS, exactly like
`/ledger/print`.

### 3.1 Files and modules

Create:
```
prisma/migrations/0003_appointments/migration.sql   # forward-only, §3.3
src/lib/reconstruction.ts        # snapshot types + draft builder + prose + correction apply
src/app/api/appointments/route.ts        # POST create-and-draft, GET list
src/app/api/appointments/[id]/route.ts   # GET one, PATCH corrections
src/app/(app)/appointments/page.tsx          # visits list + create (RSC)
src/app/(app)/appointments/[id]/page.tsx     # correction pass (RSC shell)
src/app/(app)/appointments/[id]/print/page.tsx  # the one-pager (RSC)
src/components/AppointmentCreator.tsx    # client: date + optional specialty, POST, redirect
src/components/SnapshotEditor.tsx        # client: timeline rows, edit sheet, add missed flare
tests/reconstruction.test.ts     # draft rules, prose determinism, hedging, bands, apply()
e2e/appointments.spec.ts         # API contract: create/draft/range/corrections/authz/limits
e2e/reconstruction.spec.ts       # UI flow, signature headline, print one-page, 390px
```

Modify:
```
prisma/schema.prisma            # Appointment model
src/lib/validation.ts           # appointmentCreateSchema, appointmentCorrectionSchema
src/app/(app)/home/page.tsx     # quiet link "Doctor visit coming up?" next to the ledger link
src/app/globals.css             # one-pager print styles (.onepage, compact print type)
tests/nonGoalGuard.test.ts      # add src/lib to ROOTS; add LLM mechanical markers
tests/copy.test.ts              # add src/lib/reconstruction.ts to ROOTS
tests/validation.test.ts        # cases for the two new schemas
README.md                       # one short section: the pre-appointment one-pager
```

`SnapshotEditor` may be split into smaller client components (a row, an edit
sheet, an add-flare sheet) if that reads better; the sheet interaction should
reuse the `sheet` / `sheet-scrim` pattern from `OnsetSheet.tsx`.

### 3.2 Snapshot: the appointment owns its account

The reconstruction snapshot is a self-contained JSONB document on the
appointment row. Drafting copies the relevant flare data into it; from then
on the snapshot is the single thing the correction pass edits and the
one-pager renders. Corrections never write back to `flares` or `treatments`
(the ledger stays the raw record; the snapshot is the account prepared for
one visit). A flare added during correction exists in the snapshot only.

```ts
// src/lib/reconstruction.ts
export type SnapshotTreatment = {
  name: string;                      // 1..120 chars
  startedOn: string | null;          // ISO date
  startedPrecision: "exact" | "approx" | null;
  helped: "yes" | "no" | "unsure" | null;
};

export type SnapshotFlare = {
  key: string;          // drafted: the source flare id; added: a server uuid
  source: "drafted" | "added";
  onsetDate: string;                 // ISO date
  onsetPrecision: "exact" | "approx";
  endDate: string | null;            // null = still going (open)
  endPrecision: "exact" | "approx" | null;
  peakSeverity: number | null;       // 1..5
  note: string | null;               // <= 300 chars, see drafting rule
  treatments: SnapshotTreatment[];   // <= 20
};

export type Snapshot = {
  version: 1;
  rangeStart: string | null;  // previous appointment's visit date, null on first
  truncated: boolean;         // true when the range held more than the cap
  flares: SnapshotFlare[];    // onset ascending, <= 50
};
```

Derived, never stored: a flare is open iff `endDate` is null; duration is
`daysBetween(onset, end) + 1` for closed flares (same formula as
`serializeFlare`). Storing no derived values means a corrected date can
never leave a stale duration or status behind.

A Zod `snapshotSchema` in `validation.ts` (or exported from
`reconstruction.ts`) validates the document shape; the server validates the
snapshot after every mutation before persisting it. `version: 1` makes any
later shape change a readable migration, not a guess.

### 3.3 Data model (forward-only migration `0003_appointments`)

```sql
CREATE TABLE appointments (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_date  date NOT NULL,
  specialty   text,
  snapshot    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_user_visit_idx
  ON appointments (user_id, visit_date DESC, created_at DESC);
```

Prisma model `Appointment` mirrors it (`@@map("appointments")`, `Json`
snapshot field, relation to `User` with cascade, the composite index). No
change to `flares` or `treatments`.

### 3.4 Drafting rules (deterministic, in `src/lib/reconstruction.ts`)

`buildDraftSnapshot(flares, rangeStart)` is a pure function; the route loads
the rows and passes them in, so the builder is unit-testable without a
database.

- **Previous appointment.** When creating an appointment with visit date V,
  the previous appointment is the caller's existing appointment with the
  greatest `visit_date <= V`, ties broken by `created_at` (latest wins).
  `rangeStart` = its `visit_date`. No such appointment: `rangeStart = null`
  (first visit, all-time draft).
- **Which flares are in range.** All-time when `rangeStart` is null.
  Otherwise a flare is included iff it is open (`end_date IS NULL`) or its
  `end_date >= rangeStart`: anything still active on or after the last
  visit day belongs in "since last visit". Query scoped
  `where: { userId: user.id }`, `include: { treatments: true }`, ordered
  `onsetDate asc, createdAt asc` (matches `loadUserFlares`). The range
  filter runs in the query, not in JS.
- **Cap.** The snapshot holds at most 50 flares. When the range has more,
  keep the 50 with the newest onsets (still stored onset-ascending) and set
  `truncated: true`; the coverage line then says so. This bounds the
  document, the correction pass, and the page.
- **Per-flare copy.** `key` = flare id, `source: "drafted"`, dates and
  precisions copied as ISO strings, `peakSeverity` copied, treatments
  copied as `SnapshotTreatment` (name, startedOn, startedPrecision, helped)
  in the same order `serializeFlare` produces (start ascending, unrecorded
  last), capped at 20.
- **Note drafting.** `note` = `impactNote` and `symptomNote` joined with a
  single space (skipping null/empty), truncated at 300 characters on a word
  boundary with a trailing ellipsis character when cut. The user can
  rewrite it in the correction pass; the one-pager needs a line, not an
  essay.

Determinism requirement: same input rows, same output snapshot, byte for
byte. No `Date.now()` inside the builder (the route passes `todayUtc()`
where needed), no randomness (added-flare keys are generated in the route,
not the builder).

### 3.5 Templated prose (pure functions, exact rules)

All in `src/lib/reconstruction.ts`, all pure, all unit-tested. These strings
are user-visible copy: they obey the copy bar (no em-dashes, positive,
short) and the file joins the copy-sweep ROOTS.

**`headlineText(snapshot, today)`** returns one to three short sentences,
joined with spaces:

1. **Count.** N = snapshot flares. With `rangeStart`:
   "3 flares since March." / "1 flare since March." The month renders via
   the month name of `rangeStart`, plus the year when it differs from
   `today`'s year ("since March 2025"). First visit (`rangeStart` null):
   "3 flares recorded." / "1 flare recorded." Zero flares: "A quiet stretch
   since March." / first visit: "A quiet stretch so far." (no further
   sentences in the zero case).
2. **Longest.** Over closed flares with a computable duration; omitted when
   there are none. Two or more closed: "Longest about 12 days." One closed:
   "It lasted about 12 days." The word "about" appears iff that flare's
   onset or end precision is `approx` (same rule as `durationTextFor`);
   exact-exact reads "Longest 12 days." Singular day: "1 day".
3. **Treatment timing contrast (the signature sentence).** Candidates are
   ordered pairs (A, B) of closed snapshot flares with durations >= 1 day
   sharing a treatment name (compared trimmed, case-insensitive), where in
   A the treatment's `startedOn` equals A's `onsetDate` (day one) and in B
   it has a recorded `startedOn` at least 2 days after B's onset, and
   A's duration < B's duration. Pick the candidate with the smallest ratio
   `durA / durB`; break ties by treatment name ascending, then A's onset
   ascending. Emit nothing when there is no candidate or the best ratio is
   above 0.85. Otherwise, with the treatment's stored casing from A:
   - ratio <= 0.30: "Naproxen started on day one, that flare was about a
     third as long."
   - ratio <= 0.60: "Naproxen started on day one, that flare was about
     half as long."
   - ratio <= 0.85: "Naproxen started on day one, that flare was
     noticeably shorter."
   The hedge word "about" in the fraction phrasing is deliberate: a ratio
   over hedged durations never claims exactness.

**`coverageText(snapshot)`**: "Built from 3 recorded flares, not a daily
diary." / "Built from 1 recorded flare, not a daily diary." When
`truncated`: append "Showing the newest 50." It never implies completeness
and appears on both the correction pass and the printed page.

**`flareRangeText(flare, today)`** (the per-flare line):
- Closed, exact-exact: "Sep 3 to Sep 9, 7 days."
- Any approx bound: "Around Sep 3 to around Sep 9, about 7 days." (the
  "around" attaches only to the approx bound; an exact onset with approx
  end reads "Sep 3 to around Sep 9, about 7 days.")
- Open: "Started around Sep 12, still going." (or "Started Sep 12, still
  going." when exact). Dates use `formatMonthDay`, adding the year via
  `formatExact` when the date's year differs from `today`'s.

**`treatmentLineText(t, flare)`**: "Naproxen from day one. Helped." /
"Naproxen from about day 3. Not sure." / "Rest, start not recorded.
Helped." Day k = `daysBetween(onset, startedOn) + 1`; "day one" when k is
1; "about" iff the start or the onset precision is approx. The helped word
reuses `helpedText`.

Severity reuses `severityText` ("Peak severity 4 of 5" / "Severity not
recorded").

### 3.6 API contracts

All handlers: session via `requireUser` (401 without one); mutations also
pass `guardMutation(user.id)` (429 in product voice); bodies and params
validated with Zod at the boundary; another user's appointment answers 404
("That page isn't here.") so existence never leaks; no note text, treatment
names, or email in logs.

**`POST /api/appointments`** creates and drafts in one step.
- Body (`appointmentCreateSchema`, strict):
  `{ visit_date: string, specialty?: string }`. `visit_date` must parse via
  `parseIsoDate` and lie between `today - 365` and `today + 365` days;
  `specialty` trimmed, 1..80 chars. Invalid: 400 "That date doesn't look
  right. Pick your visit date."
- Server: resolve `rangeStart` (§3.4), load the in-range flares, build the
  draft snapshot, validate it against `snapshotSchema`, insert the row.
- Returns 201 `{ appointment: AppointmentDTO }`.

**`GET /api/appointments`** lists the caller's visits, `visit_date desc,
created_at desc`, capped at the newest 50 (a handful per year in practice;
the cap keeps the read bounded). Returns 200
`{ appointments: AppointmentListItemDTO[] }` where the list item is
`{ id, visitDate, specialty, flareCount, createdAt }` (`flareCount` from the
snapshot; the full snapshot is not shipped in the list).

**`GET /api/appointments/:id`** returns 200
`{ appointment: AppointmentDTO }`:
`{ id, visitDate, specialty, snapshot, createdAt }`. Prose is derived
client/RSC-side from the snapshot with the shared pure functions, so it can
never go stale against the data.

**`PATCH /api/appointments/:id`** applies exactly one correction operation
per request (one tap, one save, optimistic UI). Body is
`appointmentCorrectionSchema`, a strict discriminated union on `op`:

- `{ op: "set_visit", visit_date?, specialty? (nullable) }`, at least one
  field. Same bounds as create. Changing the visit date does NOT redraft
  the snapshot; corrections already made are never thrown away.
- `{ op: "set_flare", key, onset_date?, onset_precision?, end_date?
  (nullable), end_precision?, peak_severity? (nullable), note? (nullable),
  treatments? }`, at least one field beyond `key`. Rules, enforced against
  the merged result: dates parse via `parseIsoDate` and are not after
  today; `end_date` null clears the end (the flare reads "still going");
  a set end needs `end_precision` and must be on/after onset with duration
  <= 730 days; a set `onset_date` needs `onset_precision`;
  `peak_severity` int 1..5 or null; `note` <= 300 chars or null;
  `treatments`, when present, replaces the flare's whole list (<= 20
  entries of `SnapshotTreatment` shape; each recorded `startedOn` parses,
  is not before onset and not after today). Unknown `key`: 400.
- `{ op: "add_flare", onset_date, onset_precision, end_date? (nullable),
  end_precision?, peak_severity?, note?, treatments? }`: same field rules.
  The server generates the `key` (`crypto.randomUUID()`), sets
  `source: "added"`, inserts, and re-sorts flares onset-ascending. When the
  snapshot already holds 50 flares: 400 "This timeline is at its limit of
  50 flares."
- `{ op: "remove_flare", key }`: allowed only for `source: "added"` entries
  (undo for a mistaken add); removing a drafted flare is not a correction,
  it is ledger editing, which lives in EPIC 2's editor. Drafted key: 400.

The apply logic is a pure function
`applyCorrection(snapshot, op, today): { ok: true, snapshot } | { ok: false, error }`
in `reconstruction.ts`, unit-tested directly; the route wraps it with auth,
ownership, rate limit, Zod, and persistence (validate the resulting
snapshot with `snapshotSchema`, write `snapshot` and `updated_at`). Returns
200 `{ appointment: AppointmentDTO }`. Malformed ops: 400 "That request
could not be read." Field-level failures use "That date doesn't look right.
Pick when it started." / "...when it ended." in the existing voice.

### 3.7 Screens and states (mobile-first, 390px baseline)

**Home (`/home`).** Add one quiet link, "Doctor visit coming up?", next to
"See your ledger", pointing at `/appointments`. Nothing else changes; the
one primary action on home stays "Start a flare".

**Visits (`/appointments`, RSC).** h1 "Before your visit". Primary action:
"Doctor visit coming up" opens `AppointmentCreator` (sheet pattern): a date
input defaulting to today, an optional specialty input with placeholder
"Rheumatology" (show, don't tell), submit "Draft my timeline". On success,
redirect to `/appointments/:id`. Below, past visits as tappable rows
("Oct 2, 2026", specialty when set, "3 flares"), newest first. Empty state
(designed): "One page for your doctor, drafted from your flares." with the
same primary button. Submitting gives a pressed/in-flight state within
100ms; failure shows the existing product-voice error with retry.

**Correction pass (`/appointments/[id]`, RSC shell + `SnapshotEditor`).**
- Header card: the headline (`headlineText`) as the lead, the coverage line
  (`coverageText`) muted beneath it. The visit date and specialty sit above
  in small text, editable (tap opens a small sheet -> `set_visit`).
- The timeline: one row per snapshot flare, onset-ascending, each showing
  `flareRangeText`, severity, treatment lines, and the note when present.
  Tapping a row opens an edit sheet with pre-filled inputs: onset date +
  an "Around then" toggle (precision), end date + toggle + a "Still going"
  clear, the 1..5 severity scale (reuse the pressed-state pattern from the
  interview), treatments (name, day, helped), and the note. Save issues one
  `PATCH set_flare`, updates optimistically, and re-renders the headline
  from the new snapshot at once (the prose is derived, so a corrected date
  visibly updates "Longest about..." without a reload). Rows added during
  correction carry a small "added" pill and offer "Remove" inside their
  sheet (`remove_flare`).
- "Add a missed flare" (`btn-secondary`) under the list opens the same
  sheet empty except onset defaulting to nothing selected -> `add_flare`.
- Footer primary action: "Print one page" links to
  `/appointments/[id]/print`.
- States: RSC loads the appointment server-side (signed-out redirects to
  `/signin`; another user's id renders Next's `notFound()`); every PATCH
  gives sub-100ms feedback and a product-voice inline error with retry on
  failure ("Check your connection and try again." / the 429 message). No
  layout jump while a sheet saves.

**The one-pager (`/appointments/[id]/print`, RSC).**
- On screen: a `no-print` row ("Back to corrections" link, "Print" button
  reusing `PrintButton`), then the page content inside a `.onepage`
  container: title "Flare timeline", subline with specialty and visit date
  ("Rheumatology visit, Oct 2, 2026." or "Visit on Oct 2, 2026."), prepared
  date ("Prepared Sep 15, 2026."), the headline in large type, then one
  compact block per flare (range line, severity, treatment lines, note),
  and the coverage line as the footer.
- Print CSS in `globals.css`: the existing `@media print` block already
  hides `.topbar` and `.no-print` and strips the container; add `.onepage`
  rules for print: body type ~12.5px, title ~20px, tight margins,
  `@page { margin: 12mm }`, `break-inside: avoid` per flare block, no
  shadows or cards, black on white. The page must fit a single A4 AND a
  single Letter page for a typical record (operationalized in §5: with the
  demo record, printed content height stays under 950 CSS px, which fits
  both paper sizes at 12mm margins). With many flares the type stays
  compact and blocks never split across pages.
- Empty snapshot: the headline's quiet-stretch line plus "Add a missed
  flare from the corrections page." and a way back. Never a blank page.
- Signed-out redirects to `/signin`; the page renders only the caller's
  appointment.

### 3.8 Copy (suggested strings, already swept)

Final wording is the implementer's, held to QUALITY BAR §7 and §8 (no
em-dashes, positive, short; sweep mechanically before done). Suggested:
- Home link: "Doctor visit coming up?"
- Visits screen: "Before your visit", "Doctor visit coming up",
  "Draft my timeline", empty state "One page for your doctor, drafted from
  your flares."
- Correction pass: "Your draft timeline", lede "Fix anything wrong. Then
  print one page.", "Add a missed flare", "Still going", "Around then",
  "Remove", "Print one page".
- One-pager: "Flare timeline", "Prepared Sep 15, 2026.", "Back to
  corrections", "Print".
- Prose examples are normative in §3.5.
- Errors reuse the existing voice: "Check your connection and try again.",
  "You're going quickly. Try again in a minute.", "That page isn't here.",
  "That date doesn't look right. Pick your visit date."

### 3.9 Seed and staging

The existing `SEED_DEMO` data already carries the signature pair (Naproxen
on day six in a 12-day flare, Naproxen on day one in a 6-day flare, plus an
open flare). Do not add a seeded appointment: the demo's first "Doctor
visit coming up" tap must draft all-time and produce the §2 headline live,
which is the differentiator shown within a minute on staging. Touch
`src/lib/seed.ts` only if a test proves the pair no longer fires the
contrast sentence, and then only minimally.

### 3.10 Guards (non-goal and copy)

- `tests/nonGoalGuard.test.ts`: add `"src/lib"` to `ROOTS`, and add
  MECHANICAL markers proving no LLM sits in any path:
  `/LLM_GATEWAY_URL|LLM_API_KEY|\bopenai\b|\banthropic\b|chat\/completions|\/v1\/messages/i`
  (label "LLM call in a no-LLM product"). The existing scheduling, chart,
  filter, and share markers must keep passing over the new files (in
  particular: no share/public/clinician route appears).
- `tests/copy.test.ts`: add `"src/lib/reconstruction.ts"` to `ROOTS` so the
  templated prose is swept like any shipped string.
- Determinism as a test: the same fixture rows produce byte-identical
  snapshots and headlines across runs (no clock, no randomness in the pure
  functions).

### 3.11 Security, performance, logging

- Every route resolves the session server-side and scopes every query by
  `userId`; appointment reads check ownership and answer 404 on a foreign
  id. There is no unauthenticated or cross-user path to a snapshot.
- Zod at every boundary, `.strict()` objects, one validated op per PATCH;
  the server re-validates the whole snapshot before persisting any change,
  so a crafted PATCH can never store an out-of-shape document.
- `POST` and `PATCH` go through `guardMutation` (per-user 429). Reads are
  bounded (list capped at 50, one row by id) and follow the house
  convention of the flares list: authorized, validated, not separately
  rate-limited.
- Drafting is two indexed queries (previous appointment via
  `appointments_user_visit_idx`, in-range flares via the existing flare
  indexes with a batched treatment include). Nothing here scales with
  another user's data, and the 50-flare cap bounds every render.
- No PII in logs: never log snapshot content, notes, treatment names,
  specialty, or email.
- No new env, no new secrets.

---

## 4. Ordered task list (each with acceptance criteria)

**T1. Migration + model + schemas.** `0003_appointments` per §3.3, the
Prisma `Appointment` model, `appointmentCreateSchema`,
`appointmentCorrectionSchema`, and `snapshotSchema` per §3.2 and §3.6.
- AC: `prisma migrate deploy` applies cleanly on an existing EPIC 1-3
  database; the composite index exists; both request schemas reject
  unknown fields, out-of-range dates, and a specialty over 80 chars
  (proved in `tests/validation.test.ts`).

**T2. Draft builder.** `buildDraftSnapshot` and the range/cap/note rules of
§3.4 as pure functions with unit tests.
- AC: given fixture flares, the builder includes exactly the open and
  end-on-or-after-rangeStart flares, all-time when `rangeStart` is null,
  orders onset-ascending, caps at 50 with `truncated: true`, drafts notes
  joined and word-truncated at 300, and is byte-deterministic across runs.

**T3. Templated prose.** `headlineText`, `coverageText`, `flareRangeText`,
`treatmentLineText` per the exact rules of §3.5, unit-tested.
- AC: a fixture shaped like the demo seed yields exactly "3 flares
  recorded. Longest about 12 days. Naproxen started on day one, that flare
  was about half as long."; the ratio bands switch at 0.30/0.60/0.85; no
  contrast sentence without a qualifying pair; hedging appears iff a bound
  is approx; zero-flare and since-month variants render as specified; the
  coverage line never implies completeness and reports truncation.

**T4. Create + list endpoints.** `POST /api/appointments` (resolve previous
visit, draft, persist) and `GET /api/appointments` per §3.6.
- AC (e2e API): POST with a valid date returns 201 with a drafted snapshot
  built from that user's flares only; a second appointment's draft covers
  exactly the flares open or ended on/after the first appointment's visit
  date; bad/missing/out-of-range `visit_date` -> 400; no session -> 401;
  flooding mutations -> 429; the list returns the caller's visits newest
  first with `flareCount` and no snapshot bodies.

**T5. Read + correction endpoints.** `GET` and `PATCH
/api/appointments/:id` with `applyCorrection` per §3.6.
- AC (unit): `applyCorrection` handles set_visit, set_flare (dates,
  precisions, still-going clear, severity, note, treatment replacement),
  add_flare (sorted insert, added source, 50-cap refusal), remove_flare
  (added-only) and rejects unknown keys, future dates, end-before-onset,
  and drafted-row removal.
- AC (e2e API): a PATCH persists into the stored snapshot and survives a
  re-GET; corrections are not lost when the visit date changes; a foreign
  appointment id answers 404 for GET and PATCH; malformed ops -> 400; no
  session -> 401; flooding -> 429.

**T6. Visits screen + home entry.** `/appointments`, `AppointmentCreator`,
and the home quiet link per §3.7.
- AC (e2e UI at 390px): from home, "Doctor visit coming up?" reaches the
  visits screen; creating a visit with the default date lands on the
  correction pass; the empty state is designed and positive; the create
  button shows an in-flight state; no horizontal scroll.

**T7. Correction pass.** `/appointments/[id]` + `SnapshotEditor` per §3.7.
- AC (e2e UI at 390px): the demo user sees the §2 headline and the coverage
  line; tapping a drafted flare, changing its end date, and saving updates
  the row and the headline without a reload and survives a full reload;
  "Add a missed flare" creates a row marked as added that persists; an
  added row can be removed; every save gives feedback within 100ms and a
  failed save shows a product-voice error with retry; touch targets >=
  44px; no horizontal scroll.

**T8. The one-pager.** `/appointments/[id]/print` + print CSS per §3.7.
- AC (e2e): the page shows the headline, per-flare blocks with hedged
  wording ("about 12 days"), and the coverage footer; with print emulation
  the topbar and `no-print` controls are hidden and each flare block has
  `break-inside: avoid`; for the demo record the printed content height
  stays under 950 CSS px at both 794px (A4) and 816px (Letter) widths, so
  it fits one page on both; signed-out redirects to `/signin`; an empty
  snapshot renders the quiet-stretch line and a way back, never a blank
  page.

**T9. Guards + README.** Extend `nonGoalGuard` and `copy` ROOTS/markers per
§3.10; add a short README section (the app drafts a one-page timeline
before a doctor visit; you correct it and print it), verified against how
the app actually runs.
- AC: the non-goal guard fails on any LLM marker, scheduler, chart, filter,
  or share path in `src/app`, `src/components`, or `src/lib`, and passes on
  the delivered tree; the copy sweep covers `reconstruction.ts` and passes;
  the README stays accurate and free of factory internals.

**Copy sweep (part of DONE, not a separate task).** Mechanically search
every added or edited user-visible string (screens, components,
`reconstruction.ts` prose, README example copy) for em/en dashes, the
banned vocabulary, and negative empty-state phrasing; fix every hit.

---

## 5. Test plan (which automated test proves each planner criterion)

| Planner criterion | Test | What it asserts |
|---|---|---|
| Create draws since previous appointment (all-time first), deterministically | Unit `tests/reconstruction.test.ts` + e2e API `appointments.spec.ts` | Builder range/cap/determinism on fixtures; POST #1 drafts all-time, POST #2 drafts only flares open or ended on/after visit #1's date; snapshot built from stored rows only |
| Headline is real and data-built; coverage stated plainly | Unit (exact strings, bands, variants) + e2e UI `reconstruction.spec.ts` | Demo fixture yields the §2 headline verbatim; coverage line "Built from N recorded flares, not a daily diary." visible on the correction pass and the print page |
| Correct any drafted value; add a missed flare; saves to the snapshot | Unit (`applyCorrection`) + e2e API + e2e UI | Every op validated and applied; PATCH persists across re-GET; UI edit survives reload; added flare appears, persists, and is removable |
| Print renders one clean page on A4 and Letter, no chrome | e2e with `emulateMedia({ media: "print" })` | Chrome and `no-print` hidden; `break-inside: avoid` per block; demo content height < 950px at 794px and 816px viewport widths |
| Uncertainty surfaces as hedged wording | Unit + e2e UI | "about N days" iff a bound is approx; "Around Sep 3" for approx dates; exact-exact renders unhedged; contrast sentence always fraction-hedged |
| Whole flow legible at 390px; routes authorized, validated, rate-limited | e2e UI at 390x844 + e2e API | No horizontal scroll on visits, correction, print; 401 without session on every API route; foreign id -> 404; bad input -> 400; flooded mutations -> 429 |
| No LLM in this path (Non-Goal guard) | `tests/nonGoalGuard.test.ts` | LLM markers (gateway env names, provider names, completion endpoints) fail the suite anywhere in `src/app`, `src/components`, `src/lib` |

Plus: `tests/validation.test.ts` covers both new schemas;
`tests/copy.test.ts` sweeps the new prose; the existing Vitest and
Playwright suites must stay green (in particular `nonGoalGuard`, `copy`,
`ledger`, `export`). Run both suites in the foreground to completion before
declaring success.

---

## 6. Assumptions (resolved, non-blocking)

- **Corrections and added flares live in the snapshot only.** The planner
  states "corrections save to the appointment snapshot", and the add
  happens "from inside the correction pass", so the whole pass edits the
  appointment's account, never the ledger. This also keeps the snapshot an
  honest record of what was handed to the doctor that day. Changing the
  underlying record remains EPIC 2's editor; two-way sync is deliberately
  not built.
- **Prose is derived, not stored.** The plan sketch mentions storing
  rendered text and a coverage note; storing them would go stale after
  every correction. The snapshot stores structure only and the pure
  functions render prose at read time, which is strictly more deterministic
  and keeps corrections instantly reflected in the headline.
- **`specialty` is included** (optional, <= 80 chars) because the plan's
  data model sketch names it and the one-pager header uses it; it is one
  optional input, never required.
- **Visit date bounds** are today +/- 365 days: enough to log a visit just
  past or a year ahead, tight enough to catch typos.
- **Snapshot cap of 50 flares** bounds the document and the page; the
  coverage line reports truncation honestly. Fifty flares since one visit
  is far past any realistic interval.
- **Reads are not separately rate-limited**, matching the delivered
  convention on `GET /api/flares` (authorized, validated, bounded);
  mutations use the existing per-user limiter. The planner's "rate-limited"
  criterion is read as the app-wide convention: every mutation limited,
  every route authorized and validated.
- **No appointment delete surface.** No criterion requires it and the
  correction ops fix every recoverable mistake (`set_visit`,
  `remove_flare` for adds). A delete can ride a later EPIC if the owner
  wants one.
- **"One page" is operationalized** as: demo-record content fits a single
  A4 and a single Letter page at 12mm margins (the concrete height/width
  assertions in T8), and per-flare blocks never split. A pathological
  50-flare snapshot prints compactly but may run long; the criterion's
  "clean one page" is guaranteed for the realistic records the product is
  built around.
