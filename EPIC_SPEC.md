# EPIC SPEC — Flare-end interview and close

## Quality differentiator (this EPIC is held to it)

**Least effort to a clinical record.** This app must demand less of a sick
person than any other route to a doctor-ready illness history, measured in
minutes per flare instead of entries per day.

**What it demands of THIS EPIC.** Closing a flare is the second and larger
of the two moments a user gives the app, so it is where "least effort" is
won or lost. The interview must be the shortest complete path from "it's
over" to a recorded flare: one question per step, taps over typing, every
uncertain answer expressible in a single tap ("a few days ago", "not
sure"), and every optional field skippable in one tap. A recovering user
with little energy must finish in well under a minute without reading a
paragraph or composing prose. Any step that asks for one gram more than the
record needs is a defect against this differentiator, not just the baseline
bar.

---

## 1. Scope

### In scope
- A **flare-end interview**: from an open flare, "This flare ended" opens a
  short branching flow of 2 to 5 steps, one question per step, fully usable
  at 390px. It captures end date with precision, peak severity, zero or more
  treatments, and optional impact and symptom notes, then closes the flare
  atomically.
- **Closing** a flare: sets status to `closed`, stores the end date and
  precision, and derives duration from onset and end. An already-closed
  flare cannot be closed again.
- **Uncertainty as first-class data**: fuzzy end dates and fuzzy treatment
  starts are stored with a precision flag and rendered as hedged text, never
  rounded into false precision. Severity and treatment-start may be left
  "not sure" and stored as absent.
- **Editing after the fact**: a flare edit surface where a closed flare can
  be reopened, its recorded fields corrected, and its treatments added,
  edited, and removed.
- New API routes for close, edit, reopen, and treatment CRUD, each
  authorized server-side, input-validated at the boundary, and rate-limited.
- Designed empty, loading, and error states for every new surface; mobile-
  first at 390px; a copy sweep of every new user-visible string.

### Out of scope (build in later EPICs, not here)
- The rich ledger presentation, per-flare read-only detail polish, export
  (JSON/CSV), and the ledger's perf pass belong to **EPIC 3**. This EPIC
  adds only the minimum ledger display needed to show closed-flare duration
  and reach the edit surface, plus the edit surface itself. Do not build
  export or list pagination here.
- Pre-appointment reconstruction and the one-page render (**EPIC 4**).
- The guided first-run overlay, PWA install, and the single covenant nudge
  (**EPIC 5**).
- The product-wide polish audit (**EPIC 6**).

### Non-Goals (binding — a defect if built)
- **No adaptive or LLM-driven interview.** The interview is a fixed,
  deterministic sequence of steps. No model call, no key-entry surface, no
  branching driven by anything other than the user's own answers (for
  example, skipping treatment detail when the user tried nothing).
- **No reminders or scheduled prompts of any kind.** No timer, cron, daily
  check-in, streak, or nudge may be introduced anywhere. (The single
  covenant nudge is EPIC 5's job, not this one.)
- **No severity charts, trend graphs, or correlation views.** Severity is
  stored and shown as a single value per flare, never plotted or correlated.
- **No new entities** beyond what the interview writes onto `flares` and
  `treatments`. No appointment, no export, no free-form journal.

---

## 2. First-run and the quality bar (read before building)

The QUALITY BAR requires a guided first run. The product plan assigns the
**guided walkthrough overlay to EPIC 5**; do not build it here. In this EPIC
the bar is met by the interview being self-evident, not by a tour:
- The trigger reads plainly ("This flare ended") and sits on the open flare.
- Each step asks exactly one question in one short line, with real controls
  and sensible defaults, so the user acts by looking, not by reading.
- Skipping an optional step is always one obvious tap.

Building the EPIC 5 overlay now is drift; shipping a confusing interview is
a defect. Deliver a self-evident flow, not an overlay.

---

## 3. Technical design

Build on the EPIC 1 stack unchanged: Next.js App Router (RSC screens +
Route Handlers under `src/app/api/*`), PostgreSQL 16 with Prisma and
forward-only migrations, Zod at every boundary, argon2id sessions looked up
server-side on every protected request, the in-process fixed-window rate
limiter, Sentry/Umami gated on env. Reuse the existing helpers rather than
re-inventing them: `requireUser` and `guardMutation` (`src/lib/api.ts`),
the JSON error envelope `errorResponse`/`jsonResponse`, the date math in
`src/lib/date.ts`, and the onset-derivation pattern in `src/lib/onset.ts`.

### 3.1 Files and modules

Create:
```
prisma/migrations/0002_*/migration.sql   # add flares.impact_note, flares.symptom_note
src/lib/interview.ts                      # derive end date + treatment start; close/edit input types
src/lib/treatment.ts                      # (optional) treatment-start derivation if not in interview.ts
src/app/api/flares/[id]/close/route.ts    # POST: submit the interview, close atomically
src/app/api/flares/[id]/treatments/route.ts       # POST: add one treatment
src/app/api/treatments/[id]/route.ts      # PATCH edit, DELETE remove one treatment
src/app/(app)/flares/[id]/edit/page.tsx   # the edit surface (RSC shell + client editor)
src/components/EndInterview.tsx           # the multi-step interview (client)
src/components/FlareEditor.tsx            # edit fields, reopen, treatment add/edit/remove (client)
src/components/EndFlareButton.tsx         # launches EndInterview from the open flare
tests/interview.test.ts                   # end-date + treatment-start derivation, duration hedging
tests/close.integration.test.ts          # close/reopen/edit + treatment CRUD API behavior
tests/nonGoalGuard.test.ts               # inspection guard for scheduled prompts / streaks / charts
e2e/interview.spec.ts                     # 390px interview walk + close + edit
```

Modify:
```
prisma/schema.prisma          # add impactNote, symptomNote to Flare
src/lib/validation.ts         # add close, flare-edit, and treatment Zod schemas (all .strict())
src/lib/serialize.ts          # include treatments + impact/symptom notes; expose end fields
src/lib/display.ts            # add endText(); hedge durationText() when precision is approx
src/app/api/flares/[id]/route.ts   # extend PATCH: edit end/severity/notes and reopen; GET includes treatments
src/app/(app)/home/page.tsx        # open-flare card gains "This flare ended"
src/app/(app)/ledger/page.tsx      # closed rows show hedged duration + end + link to edit
tests/copy.test.ts            # ROOTS already cover src/app + src/components; confirm new files are scanned
tests/serialize.test.ts       # extend for treatments + note fields
```

Do not introduce new frameworks, a state library, or a design system. Match
the existing plain-CSS class vocabulary (`btn`, `btn-primary`,
`btn-secondary`, `btn-ghost`, `card`, `stack`, `sheet`, `sheet-scrim`,
`field`, `input`, `pill`, `muted`, `form-error`) used by `OnsetSheet` and
the current screens.

### 3.2 Data model (forward-only migration `0002`)

The interview writes onto columns that already exist from `0001_init`
(`flares.status`, `end_date`, `end_precision`, `peak_severity`; the whole
`treatments` table). The only new columns are the two optional notes:

`flares`
- `impact_note` text null   *(how the flare affected the user; max 1000 chars)*
- `symptom_note` text null  *(symptoms the user noticed; max 1000 chars)*

Migration rules:
- Forward-only, additive, nullable columns. No backfill needed; existing
  rows (including the demo seed) remain valid.
- The migration must apply cleanly on a database already at `0001_init`.
- No `treatments` schema change: `name`, `started_on`, `started_precision`,
  `helped`, `note` already exist and are sufficient.

Value domains enforced at the API boundary (Zod), consistent with the
existing seed data so no CHECK migration is required:
- `flares.status` in (`'open'`, `'closed'`).
- `flares.end_precision` in (`'exact'`, `'approx'`), null only while open.
- `flares.peak_severity` integer 1..5, or null ("not sure").
- `treatments.started_precision` in (`'exact'`, `'approx'`), null when the
  user did not note a start.
- `treatments.helped` in (`'yes'`, `'no'`, `'unsure'`).

### 3.3 Interview semantics (`src/lib/interview.ts`)

The **server** derives every stored date from the user's choice; the client
never sends a computed date for a fuzzy option. Reuse `todayUtc`, `addDays`,
`parseIsoDate` from `src/lib/date.ts` and the `FEW_DAYS_ANCHOR = 3` /
`MAX_ONSET_DAYS_BACK = 730` constants pattern from `src/lib/onset.ts`.

**End date** (`deriveEnd(choice, aroundDate, onsetDate, today)`):
- `today` -> `end_date = <server today>`, `end_precision = 'exact'`.
- `few_days_ago` -> `end_date = <server today> - 3 days`,
  `end_precision = 'approx'` (shown as "a few days ago", never a hard date).
- `around_date` -> requires `around_date` (ISO `YYYY-MM-DD`);
  `end_date = around_date`, `end_precision = 'approx'`.
- Reject (`400`) when: unknown choice; `around_date` missing/invalid/in the
  future; **end date is before the flare's onset date**; end date is more
  than 730 days after onset (almost certainly a typo).

**Treatment start** (`deriveTreatmentStart(choice, aroundDate, onsetDate, onsetPrecision, today)`):
- `flare_onset` -> `started_on = onset_date`, `started_precision = onsetPrecision`
  (the treatment began with the flare; it inherits the flare's own
  certainty).
- `few_days_in` -> `started_on = onset_date + 3 days`,
  `started_precision = 'approx'` (shown as "a few days in", covers answers
  like "about day 3" without false precision).
- `around_date` -> requires a valid `YYYY-MM-DD` not before onset and not in
  the future; `started_precision = 'approx'`.
- `unsure` -> `started_on = null`, `started_precision = null` (shown as
  "start not recorded"; uncertainty stored as absence, never invented).
- Reject (`400`) on unknown choice or an out-of-range `around_date`.

**Duration** stays as in `serializeFlare`: `daysBetween(onset, end) + 1`,
so a same-day flare reads as one day. It is derived, never stored.

### 3.4 Hedged rendering (`src/lib/display.ts`)

Uncertainty must reach the screen as hedged wording:
- Add `endText(flare)`: `'Ended ' + formatExact` when `end_precision` is
  `exact`; `'Ended around ' + formatMonthDay` when `approx`; null while open.
- Change `durationText` (or add `durationTextFor(flare)`) so duration reads
  `about N days` when **either** onset or end precision is `approx`, and
  `N days` only when both are exact. This keeps EPIC 4's headline honest.
- Treatment start renders via a helper: `Started at the flare's onset` /
  `Started a few days in` / `Started around <month day>` /
  `Start not recorded`, chosen from `started_precision` and the stored date.
- `helped` renders as `Helped` / `Didn't help` / `Not sure`.
- Never show `peak_severity` as a chart. Show it as one value with a word
  anchor, for example `Peak severity 4 of 5`. Null renders `Severity not
  recorded`.

### 3.5 Serialization (`src/lib/serialize.ts`)

- Extend `FlareDTO` with `impactNote: string | null`,
  `symptomNote: string | null`, and an optional `treatments?: TreatmentDTO[]`.
- Add `serializeTreatment(t)` -> `{ id, name, startedOn (iso|null),
  startedPrecision, helped, note }`.
- `serializeFlare` includes `treatments` only when the caller passed a flare
  loaded with its treatments (the list endpoint stays lean; detail/edit
  includes them). Treatments, when present, are ordered by `started_on`
  ascending with nulls last, then `created_at`.

### 3.6 API contract

Envelope unchanged: JSON in and out; errors are
`{ "error": { "message": "<product voice>" } }` with no stack traces, no
internal strings, no PII. Every route below loads the session server-side
via `requireUser` and returns `401` when it is missing or expired. Every
`:id` route checks ownership and returns `404` on a mismatch (never confirm
another user's row exists). Every mutation calls `guardMutation(user.id)`
and returns `429` when over the per-user limit. Treatment ownership is
checked by joining the treatment to its flare and comparing `flare.userId`.

**`POST /api/flares/:id/close`** — submit the interview, close atomically.
Body (`.strict()`):
```
{
  end_choice: "today" | "few_days_ago" | "around_date",
  end_around_date?: "YYYY-MM-DD",
  peak_severity?: 1..5 | null,
  impact_note?: string (<=1000),
  symptom_note?: string (<=1000),
  treatments?: Array<{
    name: string (1..120),
    start_choice: "flare_onset" | "few_days_in" | "around_date" | "unsure",
    start_around_date?: "YYYY-MM-DD",
    helped: "yes" | "no" | "unsure",
    note?: string (<=1000)
  }>   // 0..20 items
}
```
- `409` when the flare is already `closed` (the guard for "cannot be closed
  again").
- `400` on any invalid field per §3.3 (bad end choice, end before onset,
  future date, invalid treatment start, oversize strings, unknown fields,
  more than 20 treatments).
- On success `200 { flare }` with the flare serialized **including its
  treatments**, `status: "closed"`, and derived `durationDays`.
- The whole write (flare fields + all treatments) happens in **one Prisma
  transaction** so a partial close is impossible.

**`PATCH /api/flares/:id`** — extend the existing handler to a partial edit.
Accept a `.strict()` schema whose fields are all optional but at least one
present:
- `onset_choice` / `around_date` — the existing onset edit, unchanged.
- `end_choice` / `end_around_date` — re-set the end date on a closed flare.
- `peak_severity` (1..5 or null), `impact_note`, `symptom_note`.
- `reopen: true` — set `status = 'open'` and **clear** `end_date` and
  `end_precision` (the flare is active again; duration returns to null).
  Keep severity, notes, and treatments (they remain valid observations).
- Reject (`400`) editing end/severity/notes on an `open` flare that is not
  simultaneously being closed (end fields belong to a closed flare); reject
  unknown fields; reject `reopen` combined with `end_*`.
- Preserve the current onset-only behavior exactly: a body of
  `{ onset_choice, around_date? }` still works so `OnsetSheet` is untouched.
- `200 { flare }` (with treatments) on success, `404` on ownership miss.

**`GET /api/flares/:id`** — extend to load and serialize the flare's
treatments so the edit surface can render and reload them. Still `404` for a
non-owner.

**`POST /api/flares/:id/treatments`** — add one treatment to an owned flare.
Body (`.strict()`): `{ name, start_choice, start_around_date?, helped,
note? }` (same field rules as above). `201 { treatment }`. `404` if the
flare is not the caller's.

**`PATCH /api/treatments/:id`** — edit one treatment. Body (`.strict()`,
all optional, at least one present): `{ name?, start_choice?,
start_around_date?, helped?, note? }`. Ownership via the parent flare.
`200 { treatment }`, `404` on mismatch.

**`DELETE /api/treatments/:id`** — remove one treatment. `204` on success,
`404` on mismatch. Rate-limited (it is a mutation).

**`GET /api/flares`** — unchanged contract (owner's flares, newest first,
capped at 50). It stays lean and does **not** embed treatments.

### 3.7 Screens and states (mobile-first, 390px baseline)

**Home (`/home`).** The open-flare card gains one clear action, "This flare
ended", visibly primary within that card. It launches the interview.
"Adjust onset" stays as the quiet secondary. Pressing "This flare ended"
gives a pressed state within 100ms and opens the interview immediately.

**End interview (`EndInterview.tsx`).** A step sheet reusing the
`sheet`/`sheet-scrim` dialog pattern from `OnsetSheet`, `role="dialog"`,
`aria-modal`, focus moved to the step heading on each step, closable by
scrim or a "Close" control (closing before the final step discards, and the
flare stays open). One question per step, a quiet "Step N of M" indicator,
a "Back" affordance after step 1. Steps:
1. **End date** — "When did it end?" Three taps: "Today", "A few days ago",
   "Around a date" (reveals a native date input capped at today). One tap
   advances.
2. **Peak severity** — "How bad did it get?" A 1..5 control with word
   anchors at the ends (for example "Mild" to "Severe") and a "Not sure"
   option that stores null. One tap advances.
3. **Treatments** — "What did you try?" Start with two choices: "Add a
   treatment" and "I didn't try anything". Adding one asks, on a compact
   sub-form: a name (placeholder shows a real example such as "Naproxen"),
   "When did you start it?" ("When the flare began" / "A few days in" /
   "Around a date" / "Not sure"), and "Did it help?" ("Helped" / "Didn't
   help" / "Not sure"). Added treatments list above the form with a remove
   control; "Add another" repeats; "Done" advances. This is the branching
   step: choosing "I didn't try anything" records zero treatments and skips
   straight to step 4.
4. **Notes (optional)** — "Anything else to remember?" Two optional
   multiline fields: "How it affected you" (impact) and "Symptoms you
   noticed" (symptom). Primary "Save and close"; secondary "Skip and close"
   leaves both empty. Submitting sends one `POST /api/flares/:id/close` with
   everything collected, shows an in-flight state within 100ms, and on
   success returns to home where the flare now reads closed.

The interview is 4 steps, inside the 2-to-5 bound, and collapses to 3 when
the user tries nothing. It never asks the same thing twice and never
requires typing except a treatment name the user chose to add.

**Flare edit (`/flares/:id/edit`).** The edit surface for correcting a
flare after the fact. An RSC shell loads the flare (with treatments) and
renders `FlareEditor`:
- Edit end date (fuzzy, same control), peak severity, impact and symptom
  notes; save via `PATCH /api/flares/:id`.
- A "Reopen this flare" action for a closed flare (`PATCH { reopen: true }`),
  and for an open flare a path back into the close interview.
- Treatments list with add (`POST`), edit (`PATCH`), and remove (`DELETE`)
  per row, each with optimistic feedback within 100ms and a product-voice
  error on failure.
- Reachable from the ledger row and from the home open-flare card.

**Ledger (`/ledger`).** Minimal additions only (rich presentation is EPIC
3): each closed row shows hedged duration ("Lasted about 6 days") and end
("Ended around Sep 10"), and each row links to its edit surface. Keep the
existing empty state and newest-first list. Do not add export, pagination
controls, filters, or treatment expansion here.

**Global states (every new surface).**
- **Loading**: skeletons or in-place spinners that hold the layout steady on
  the edit page and during interview submission. No white screen, no
  dead-end spinner.
- **Empty**: the treatments step's "before you add anything" state names the
  action positively ("Add a treatment"). The edit page's no-treatments state
  says what the section is for and offers "Add a treatment".
- **Error**: product-voice message with a retry affordance on every failed
  fetch. Never a raw stack trace or status code. A `409` (already closed)
  reads as a plain sentence and routes the user to the flare rather than
  dead-ending.

### 3.8 Copy rules

Every new visible string obeys QUALITY BAR §7 and §8: one obvious action per
step, words cut to the minimum, positive phrasing, no em-dashes or
dash-asides, none of the banned LLM vocabulary. Sweep before done (§4 of the
task list). Suggested strings (final wording is the implementer's, held to
the same bar):
- Trigger: "This flare ended".
- Step titles: "When did it end?", "How bad did it get?", "What did you
  try?", "Anything else to remember?".
- Treatment step: "Add a treatment" / "I didn't try anything";
  "When did you start it?" ("When the flare began" / "A few days in" /
  "Around a date" / "Not sure"); "Did it help?" ("Helped" / "Didn't help" /
  "Not sure").
- Notes step: "How it affected you", "Symptoms you noticed",
  "Save and close", "Skip and close".
- Edit page: "Edit flare", "Reopen this flare", "Add a treatment",
  "Remove", "Save".
- Ledger closed row: "Lasted about 6 days", "Ended around Sep 10".
- Generic error: "Check your connection and try again."
- Already-closed message: "This flare is already closed. You can edit it."

### 3.9 Security, secrets, logging

- Authorization on every new route server-side, per §3.6. Hiding the "This
  flare ended" button is never the access check.
- Zod `.strict()` validation at every boundary: types, enum membership,
  string length caps (name <=120, notes <=1000), array cap (<=20
  treatments), date format and range. Unknown fields rejected with `400`.
- `guardMutation` on every `POST`/`PATCH`/`DELETE`. Values stay
  env-configurable with the EPIC 1 defaults.
- No secrets added; no new env required. No PII in logs: never log note
  text, treatment names, or email. Log a user or flare by id only.

---

## 4. Ordered task list (each with acceptance criteria)

**T1. Migration and model.** Add `flares.impact_note` and
`flares.symptom_note` (nullable text) in `0002`, and the Prisma fields.
- AC: `0002` applies cleanly on a DB already at `0001_init`; the demo seed
  and existing rows remain valid; `impactNote`/`symptomNote` are readable and
  writable through Prisma.

**T2. Interview derivation library.** `src/lib/interview.ts` with
`deriveEnd` and `deriveTreatmentStart` per §3.3, plus the hedged
`endText`/duration helpers in `src/lib/display.ts` per §3.4.
- AC: unit tests prove end mapping (today->exact; few_days_ago->approx,
  today-3; around_date->approx), the onset-guard (end before onset ->
  error), treatment-start mapping including `unsure`->null, and that
  duration reads "about N days" when either precision is approx and "N days"
  when both are exact.

**T3. Close endpoint.** `POST /api/flares/:id/close` submits the interview
and closes atomically per §3.6.
- AC: closing an open flare sets `status="closed"`, stores end
  date/precision, severity, notes, and any treatments in one transaction,
  and returns the flare with derived duration and its treatments.
- AC: closing an already-closed flare returns `409`; an invalid payload
  (bad end choice, end before onset, future date, oversize string, unknown
  field, >20 treatments) returns `400`; no session returns `401`; another
  user's flare id returns `404`; over the mutation limit returns `429`.

**T4. Edit, reopen, and treatment CRUD.** Extend `PATCH /api/flares/:id`
(edit end/severity/notes, reopen) and `GET /api/flares/:id` (include
treatments); add `POST /api/flares/:id/treatments`, `PATCH
/api/treatments/:id`, `DELETE /api/treatments/:id` per §3.6.
- AC: a closed flare can be reopened (`status="open"`, end fields cleared,
  duration null, treatments kept); its end/severity/notes can be corrected;
  a treatment can be added, edited, and removed, each reflected on reload.
- AC: the legacy onset-only PATCH body still works unchanged.
- AC: every new route rejects an unauthenticated request with `401`, a
  cross-user id with `404`, an over-limit mutation with `429`, and an
  invalid or unknown-field body with `400`.

**T5. The interview UI.** `EndFlareButton` on the home open-flare card and
`EndInterview` implementing the 4-step flow per §3.7, at 390px.
- AC: from an open flare, "This flare ended" opens an interview of 2 to 5
  steps, one question per step, with no horizontal scroll at 390px and touch
  targets at least 44px.
- AC: the user can answer "a few days ago" for the end and "a few days in"
  (or "not sure") for a treatment start in a single tap; after closing, the
  ledger shows the flare closed with hedged duration and end.
- AC: choosing "I didn't try anything" closes with zero treatments and skips
  the treatment detail sub-form.

**T6. The edit surface.** `/flares/:id/edit` with `FlareEditor` per §3.7,
reachable from the ledger and home.
- AC: opening a closed flare's edit surface shows its recorded fields and
  treatments; reopening, correcting a field, and adding/editing/removing a
  treatment each persist and survive reload.
- AC: designed loading, empty (no treatments), and error states; no white
  screen, no raw stack trace; an already-closed conflict reads in product
  voice.

**T7. Ledger and display polish (minimal).** Closed rows show hedged
duration and end and link to edit, reusing the new display helpers.
- AC: at 390px the ledger has no horizontal scroll; a closed flare with an
  approx onset or end reads "about N days", an exact-exact flare reads "N
  days".

**T8. Non-Goal guard.** `tests/nonGoalGuard.test.ts` inspects the source and
asserts the paradigm the app rejects was not introduced.
- AC: the test fails if the codebase gains a scheduled prompt, reminder,
  streak, daily check-in, cron/`setInterval`-driven nudge, or a
  severity/trend/correlation chart. It scans app and component source for
  those markers and passes on the current tree.

**Copy sweep (part of DONE, not a separate task).** Mechanically search
every user-visible string added or edited (new components, the edit page,
error messages, step copy) for `—`, `–`, the banned LLM vocabulary, and
negative empty-state phrasing ("You don't have", "No ... yet", "Nothing
here", "Unable to", "Something went wrong"). Fix every hit. Confirm
`tests/copy.test.ts` scans the new files (its ROOTS already include
`src/app` and `src/components`).

---

## 5. Test plan (which automated test proves each criterion)

| Acceptance criterion | Test type | What it asserts |
|---|---|---|
| Migration applies on top of 0001; rows valid | Integration (Vitest) | Apply migrations to an empty DB; seed; read/write `impactNote`/`symptomNote` |
| End-date and treatment-start derivation | Unit (Vitest) | today->exact; few_days_ago->approx today-3; around_date->approx; end-before-onset->error; treatment `unsure`->null |
| Duration hedging | Unit (Vitest) | approx onset or end -> "about N days"; exact+exact -> "N days" |
| Close writes everything atomically | API (Vitest) | POST close returns closed flare with end fields, severity, notes, treatments, and derived duration |
| Already-closed cannot close again | API (Vitest) | Second POST close returns `409`; flare unchanged |
| Close rejects invalid payloads | API (Vitest) | Bad end choice, end<onset, future date, oversize string, unknown field, >20 treatments each -> `400` |
| Reopen clears end and keeps treatments | API (Vitest) | PATCH `{reopen:true}` -> `status="open"`, end null, duration null, treatments preserved |
| Field edit and treatment CRUD persist | API (Vitest) | PATCH flare fields; POST/PATCH/DELETE treatment; GET reflects each change |
| Legacy onset PATCH still works | API (Vitest) | `{onset_choice, around_date?}` still updates onset and rejects extra fields |
| Every new route authorized | API (Vitest) | Table-driven: each new route with no session -> `401`; cross-user id -> `404` |
| Mutations rate-limited | API (Vitest) | Exceeding the per-user limit on close/edit/treatment routes -> `429` |
| Interview usable at 390px, 44px targets | Playwright (390px) | Open interview; `scrollWidth <= innerWidth`; step controls >= 44px; one question visible per step |
| Fuzzy answers in one tap; hedged after close | Playwright | Choose "a few days ago" end and "a few days in" treatment; close; ledger shows "about N days" and hedged end |
| Skip treatments branch | Playwright | "I didn't try anything" closes with zero treatments; treatment sub-form never shown |
| Edit surface reopen + treatment edit | Playwright | Reopen a closed flare; add/edit/remove a treatment; reload shows the change |
| Designed loading/empty/error states | Playwright | Force a slow/failed submit; skeleton/in-flight state holds layout; product-voice error with retry; no stack trace |
| Non-Goal guard | Inspection (Vitest) | Source scan finds no scheduler, reminder, streak, daily check-in, or trend/correlation chart |
| Copy sweep clean | Lint/script (Vitest) | New user-visible strings carry no `—`/`–`, banned vocabulary, or negative empty-state phrasing |

Every criterion above must have a green automated test before the EPIC is
`success`. Run the full Vitest and Playwright suites in the foreground to
completion.

---

## 6. Assumptions (resolved, non-blocking)

- The close flow is a dedicated `POST /api/flares/:id/close` rather than a
  mode of PATCH, so the "already closed -> 409" guard and the atomic
  treatment write live in one obvious place. `PATCH /api/flares/:id` remains
  the partial-edit and reopen route. This refines the plan's "PATCH edits or
  closes" sketch without changing behavior; the authoritative EPIC scope
  fixes the behavior, not the URL.
- "A few days ago" (end) and "a few days in" (treatment) both anchor to the
  existing 3-day default, stored `approx` and shown hedged, never as a hard
  date. This reuses `FEW_DAYS_ANCHOR` for one documented constant.
- Peak severity keeps the 1..5 scale from the seed; "not sure" stores null.
  No new scale, no chart.
- The edit surface (`/flares/:id/edit`) is EPIC 2's minimal edit view. The
  rich read-only flare detail, ledger presentation, and export are EPIC 3;
  this EPIC does not build them.
- Reopening clears the end date and precision because a reopened flare is
  active again; severity, notes, and treatments are kept as recorded
  observations.
- No new environment variables and no LLM are introduced.
