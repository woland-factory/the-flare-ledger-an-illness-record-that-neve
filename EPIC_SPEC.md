# EPIC SPEC — The ledger and export

## Quality differentiator (this EPIC is held to it)

**Least effort to a clinical record.** This app must demand less of a sick
person than any other route to a doctor-ready illness history, measured in
minutes per flare instead of entries per day.

**What it demands of THIS EPIC.** The ledger and export are where the effort
already spent turns into something the user can carry out the door. The user
put minutes into each flare; this EPIC must return the whole multi-year
record with zero extra composition. Browsing is scan-only (the whole flare
readable in a row, no drilling required to see duration, severity, and what
helped), and export is one tap to a file a doctor or a spreadsheet opens
cleanly. Anything that makes the user assemble, reformat, or hand-copy their
own history is a defect against this differentiator, not just the baseline
bar. The record is theirs and portable, or the promise is broken.

---

## 1. Scope

### In scope
- **A chronological ledger** of every flare, newest-first, that does not slow
  as flares accumulate. Each row is scannable: onset to end, duration, peak
  severity, and the key treatments, without opening the flare.
- **Reaching every flare**: the ledger is paginated (keyset "Load older") so
  a multi-year record lists all flares while each query stays bounded and
  index-backed. First page renders server-side for a fast first paint.
- **Flare detail, editable**: tapping a row opens the flare's full interview
  data (end, duration, severity, every treatment with start and whether it
  helped, impact and symptom notes), all correctable. This reuses the edit
  surface delivered in EPIC 2; this EPIC confirms it renders the complete
  record and is reached from every ledger row.
- **Export of the whole record**:
  - `GET /api/export?format=json` returns a structured JSON document of all
    the user's flares and treatments.
  - `GET /api/export?format=csv` returns a flat CSV, one row per treatment
    (a flare with no treatments still gets a row), safe to open in a
    spreadsheet.
  - A **printable full-record view** (`/ledger/print`) that renders the whole
    record cleanly with print CSS and no app chrome.
- An **export surface** on the ledger: subordinate to the list, offering
  Download JSON, Download CSV, and Print, with product-voice feedback and
  error handling.
- Designed empty, loading, and error states for every new or changed surface;
  mobile-first at 390px with no horizontal scroll; a copy sweep of every new
  user-visible string.

### Out of scope (build in later EPICs, not here)
- **Pre-appointment reconstruction** and the one-page since-last-visit
  timeline with its data-built headline and correction pass (**EPIC 4**). The
  printable output here is a plain full-record printout. It does NOT
  synthesize a headline, does NOT scope to "since last visit", and does NOT
  create an appointment or a correction pass. Building any of that here is
  drift into EPIC 4's signature moment.
- The guided first-run overlay, PWA install, and the covenant nudge
  (**EPIC 5**).
- The product-wide polish audit (**EPIC 6**).
- A settings screen and profile/condition editing beyond what already exists
  (`GET /api/me`); the plan houses export in settings, but this EPIC places
  the export actions on the ledger and does not build a settings screen.

### Non-Goals (binding — a defect if built)
- **No filtering dashboards.** No filter controls, no search box, no
  faceting, no "flares by condition/severity/date-range" pickers. The ledger
  is one newest-first list plus "Load older".
- **No charts, graphs, or trend/correlation views** of any kind (severity
  over time, treatment effectiveness plots, calendars). Severity stays a
  single value per flare, shown as text.
- **No cross-user or shared views.** Every query is scoped to the signed-in
  user. No public links, no share tokens, no clinician view.
- **No new entities.** No appointment, no saved export, no report record. The
  ledger and export read the existing `flares` and `treatments` only.
- **No reminders, scheduled prompts, streaks, or nudges** anywhere (the
  standing product paradigm ban; the covenant nudge is EPIC 5's job).
- **No LLM.** Export and print are deterministic serialization of stored
  data. No model call, no key-entry surface.

---

## 2. First-run and the quality bar (read before building)

The QUALITY BAR requires a guided first run; the plan assigns that overlay to
**EPIC 5**. Do not build it here. In this EPIC the bar is met by the surfaces
being self-evident:
- The ledger's existing empty state already says what the screen is for and
  offers the first action (start a flare). Keep it, and keep it positive.
- Export actions read plainly ("Download JSON", "Download CSV", "Print") and
  are visibly subordinate to the list, so a user sees their record first and
  the way to carry it out second.

Building the EPIC 5 overlay now is drift. A confusing ledger or an export a
spreadsheet chokes on is a defect. Deliver a self-evident, scan-only ledger
and a clean file.

---

## 3. Technical design

Build on the existing stack unchanged: Next.js App Router (RSC screens +
Route Handlers under `src/app/api/*`), PostgreSQL 16 with Prisma, Zod at
every boundary, argon2id sessions looked up server-side on every protected
request, the in-process fixed-window rate limiter, Sentry/Umami gated on env.
Reuse the existing helpers rather than re-inventing them: `requireUser`,
`guardMutation`, `errorResponse`/`jsonResponse` (`src/lib/api.ts`); the DTOs
and `serializeFlare`/`serializeTreatment` (`src/lib/serialize.ts`); the
hedged text helpers `onsetText`, `endText`, `durationTextFor`,
`treatmentStartText`, `helpedText`, `severityText`, `statusText`
(`src/lib/display.ts`); the date helpers in `src/lib/date.ts`; and the plain
CSS class vocabulary already used by the ledger and editor (`btn`,
`btn-primary`, `btn-secondary`, `btn-ghost`, `card`, `stack`, `row`, `pill`,
`muted`, `lede`, `empty`, `field`, `input`, `section-label`, `link-quiet`).

The DTO layer already carries everything this EPIC displays: `FlareDTO`
includes `peakSeverity`, `durationDays`, `impactNote`, `symptomNote`, and an
optional `treatments[]`; the display helpers already hedge duration and end.
This EPIC adds no new stored fields. The work is the ledger presentation,
pagination, and the export/print outputs.

### 3.1 Files and modules

Create:
```
src/lib/csv.ts                          # RFC-4180 CSV rows + formula-injection guard; flaresToCsv()
src/lib/export.ts                       # build the JSON export payload; shared flare-load query
src/app/api/export/route.ts             # GET: json | csv download of the whole record
src/app/(app)/ledger/print/page.tsx     # printable full-record view (RSC), print CSS, no chrome
src/components/LedgerPager.tsx          # "Load older" client control that appends pages
src/components/ExportActions.tsx        # client: download JSON/CSV + print, with error state
tests/csv.test.ts                       # quoting, injection guard, one-row-per-treatment, zero-treatment
tests/export.test.ts                    # JSON payload shape; scoped-to-one-user builder behavior
e2e/ledger.spec.ts                      # enriched rows, pagination, 390px, row -> detail link
e2e/export.spec.ts                      # JSON/CSV download valid + only own data; print view; 401; 429
```

Modify:
```
src/lib/validation.ts       # add flareListQuerySchema (limit, before) and exportQuerySchema (format)
src/lib/display.ts          # add keyTreatmentsText(treatments) for the compact row summary
src/lib/rateLimit.ts        # add exportLimit() config (env-tunable) reusing checkRateLimit
src/app/api/flares/route.ts # GET: keyset pagination (limit, before) + include treatments + nextCursor
src/app/(app)/ledger/page.tsx  # enrich rows (severity + key treatments); first page + pager; export section
src/app/(app)/loading.tsx      # confirm the ledger skeleton holds layout (already route-level)
src/app/globals.css         # @media print rules; any row/export-section classes needed
README.md                   # document export formats, the print view, pagination; keep it stranger-readable
tests/copy.test.ts          # ROOTS already cover src/app + src/components; confirm new files are scanned
```

Do not introduce new frameworks, a state library, a chart library, a CSV
package, or a design system. CSV is a few lines of quoting; write it in
`src/lib/csv.ts`.

### 3.2 Data model

**No migration.** Every field the ledger and export read already exists
(`flares.status/onset*/end*/peak_severity/impact_note/symptom_note`, the
whole `treatments` table). The `flares` table already has the
`(user_id, created_at desc)` index that backs newest-first pagination, and
`treatments` has its `flare_id` index that backs the batched treatment load.
Adding a migration here is drift.

### 3.3 Ledger query and keyset pagination

The ledger must list all flares without a query that slows as the record
grows, and without an N+1 over treatments.

**Ordering.** Newest-first by `created_at` descending, exactly as today,
backed by the existing `(user_id, created_at desc)` index. (Ordering by
onset would need a new index and can reorder backdated flares; keep
`created_at desc` for consistency with EPIC 1/2 and the index. Onset-based
sorting is out of scope.)

**Treatments per row.** Load with a single batched relation query, not a
per-row lookup: `include: { treatments: true }` on the `findMany`. Prisma
issues one `IN (...)` query against the `treatments.flare_id` index, so the
cost is two indexed queries regardless of row count. Never query treatments
inside a row loop.

**Page size.** `PAGE = 25` rows per page (a constant in the ledger/route).

**First page (server-rendered).** The ledger RSC queries the first page
directly for a fast first paint: `take: PAGE + 1` (the extra row only tells
us whether more exist; it is not rendered). If `PAGE + 1` rows come back,
render `LedgerPager` seeded with the cursor of the last shown row.

**"Load older" (client).** `LedgerPager` calls the extended
`GET /api/flares?limit=25&before=<cursor>`, appends the returned rows, and
updates the cursor from `nextCursor`. When `nextCursor` is null, hide the
button. Each press gives a pressed/in-flight state within 100ms and a
product-voice error with a retry on failure.

**Cursor.** An opaque string `"<createdAtIso>_<id>"` returned as
`nextCursor`. The server keyset predicate is
`created_at < cursorDate OR (created_at = cursorDate AND id < cursorId)`,
ordered `created_at desc, id desc`, so ties on `created_at` never drop or
duplicate a row. An unparseable `before` is rejected `400`.

### 3.4 Extended list endpoint (`GET /api/flares`)

This EPIC deliberately changes EPIC 2's "lean, no treatments" list contract:
the ledger row needs key treatments, and the batched relation load is cheap.

- Auth server-side via `requireUser`; no session -> `401`.
- Query params validated with `flareListQuerySchema` (see §3.7):
  - `limit`: optional integer 1..50, default 25.
  - `before`: optional cursor string; invalid format -> `400`.
- Returns `200 { flares: FlareDTO[] /* with treatments */, nextCursor: string | null }`.
- `flares` are the caller's only, newest-first, keyset-paginated per §3.3,
  each serialized with its treatments (ordered by `serializeFlare`).
- `nextCursor` is the cursor of the last returned row when a further page
  may exist, else null.
- It is a read: no `guardMutation`. It stays fast (two indexed queries).

### 3.5 Export endpoint (`GET /api/export?format=json|csv`)

One endpoint, two serializations, the **whole** record (not the 50/paged
cap — export must be complete).

- Auth server-side via `requireUser`; no session -> `401`.
- `format` validated with `exportQuerySchema`: must be `"json"` or `"csv"`.
  Missing or unknown -> `400` in product voice.
- Light per-user export rate limit via `exportLimit()` + `checkRateLimit`
  keyed `export:<userId>`; over the limit -> `429` with the existing
  "You're going quickly. Try again in a minute." message. Generous default
  (for example 30/hour), env-tunable, degrading like the other limits.
- Loads all of the caller's flares **with treatments**, ordered
  `onset_date asc` (a record reads best oldest-first as a timeline), scoped
  `where: { userId: user.id }`. This is the only place ordering differs from
  the ledger, and it is intentional.

**JSON (`format=json`).** Built in `src/lib/export.ts`, reusing
`serializeFlare` so the shape matches the API:
```json
{
  "version": 1,
  "exportedAt": "<server ISO timestamp>",
  "account": { "email": "<user email>", "conditionLabel": "<label|null>" },
  "flares": [ /* FlareDTO with treatments, onset-ascending */ ]
}
```
- `Content-Type: application/json; charset=utf-8`.
- `Content-Disposition: attachment; filename="flare-ledger-<YYYY-MM-DD>.json"`.
- The document must `JSON.parse` cleanly and contain only this user's flares.

**CSV (`format=csv`).** Built in `src/lib/csv.ts`. One header row, then one
row per treatment; a flare with zero treatments produces a single row with
the treatment columns empty. Columns, in order:
```
onset_date, onset_precision, end_date, end_precision, duration_days,
peak_severity, status, impact_note, symptom_note,
treatment_name, treatment_started_on, treatment_started_precision,
treatment_helped, treatment_note
```
- **RFC 4180 quoting.** A field containing a comma, double-quote, CR, or LF
  is wrapped in double-quotes with internal quotes doubled. Rows joined with
  `\r\n`.
- **Formula-injection guard (security).** Any field whose first character is
  `=`, `+`, `-`, `@`, tab, or CR is prefixed with a single quote `'` before
  quoting, so a spreadsheet does not execute it. Treatment names and notes
  are user-controlled, so this is mandatory, not optional.
- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition: attachment; filename="flare-ledger-<YYYY-MM-DD>.csv"`.
- The file must open in a spreadsheet with columns aligned and contain only
  this user's data.

No PII in logs on either path: never log note text, treatment names, or
email; log the user by id only.

### 3.6 Printable view (`/ledger/print`)

A clean, print-optimized rendering of the whole record. RSC under the `(app)`
group so it inherits auth.

- Server-side: `getCurrentUser()`; if absent, `redirect("/signin")`. Load all
  the user's flares with treatments, onset-ascending, scoped by `userId`.
- Renders each flare as a compact block: onset-to-end line, hedged duration,
  severity (`severityText`), each treatment (`treatmentStartText` +
  `helpedText`), and impact/symptom notes when present. Reuse the display
  helpers so hedging stays honest ("about 6 days", never a false hard date).
- On-screen controls (a "Print" button and a "Back to ledger" link) carry a
  `no-print` class. Print CSS (`@media print` in `globals.css`) hides the app
  nav/chrome and the `no-print` controls, sets readable typography, and adds
  `break-inside: avoid` per flare so a flare is not split across pages.
- The "Print" button is a tiny client component (or `ExportActions`' print
  action) calling `window.print()`; the page also prints correctly straight
  from the browser.
- Empty record: a positive line ("Start a flare to build your record.") and a
  link back, never a blank page.
- This view is a plain full-record printout. It has no headline synthesis, no
  since-last-visit scoping, no correction pass. Those are EPIC 4.

### 3.7 Validation (`src/lib/validation.ts`)

Add, `.strict()` where the shape is an object:
- `flareListQuerySchema`: `{ limit?: coerced int 1..50, before?: string }`.
  Coerce `limit` from the query string; reject out-of-range. `before` is a
  string the route parses into `{createdAt, id}`; a malformed cursor -> `400`.
- `exportQuerySchema`: `{ format: z.enum(["json","csv"]) }`. Missing/unknown
  -> `400`.

Query params arrive as strings; coerce and validate at the boundary, and
reject unknown/extra params rather than ignoring them.

### 3.8 Display helper (`src/lib/display.ts`)

Add `keyTreatmentsText(treatments: TreatmentDTO[]): string | null`:
- Returns null for an empty list (the row simply omits the line).
- Prioritizes treatments marked `helped === "yes"`, then the rest in the
  order `serializeFlare` already produced (start-ascending, unrecorded last).
- Shows up to 3 names joined by ", "; if more remain, appends " +N more".
- Names only (no start/helped detail) to keep the row scannable. Example:
  `"Naproxen, Rest"` or `"Naproxen, Rest, Prednisone +2 more"`.

Reuse the existing helpers for everything else; do not duplicate hedging or
severity logic.

### 3.9 Screens and states (mobile-first, 390px baseline)

**Ledger (`/ledger`).** Keep the existing empty state and newest-first list.
Each closed or open row, tappable to `/flares/:id/edit`, shows in a scannable
stack:
- Onset line (`onsetText`), bold.
- End line (`endText`) when closed, or the open pill.
- Duration (`durationTextFor`) when closed ("Lasted about 6 days").
- Severity (`severityText`) as a muted line ("Peak severity 4 of 5" /
  "Severity not recorded").
- Key treatments (`keyTreatmentsText`) as a muted line when present.
- The status pill stays.
No horizontal scroll at 390px; touch target for the whole row >= 44px.
Below the list, a subordinate **export section**: a small `card` titled
"Export your record" holding `ExportActions` (Download JSON, Download CSV,
Print). It never competes with the list for attention.

**Load older.** `LedgerPager` renders a single "Load older flares" button
after the list when more pages exist; pressing appends the next page and
updates the cursor; it disappears when the record is exhausted.

**Export actions (`ExportActions.tsx`, client).** Download uses `fetch` to
the export endpoint, and on a 2xx builds a blob URL and triggers the download
(so a failure is catchable), then revokes the URL. On a non-2xx it shows an
inline product-voice error with a retry ("Check your connection and try
again."; a `429` reads "You're going quickly. Try again in a minute."). Each
button gives a pressed/in-flight state within 100ms. "Print" navigates to
`/ledger/print` (or opens it and calls `window.print()`).

**Flare detail (`/flares/:id/edit`).** Already delivered in EPIC 2 and
already renders the full interview data editably (end, duration, severity,
treatments with start + helped, impact/symptom notes). This EPIC confirms
each ledger row links to it and that the complete record is visible and
correctable there. Do not rebuild it; if a field from the interview is not
shown, add only that.

**Global states (every new/changed surface).**
- **Loading**: the ledger's route-level skeleton (`loading.tsx`) holds the
  layout on first load; `LedgerPager` and `ExportActions` show in-place
  in-flight states, never a white screen or a dead-end spinner.
- **Empty**: the existing ledger empty state stays (positive, says what to do
  first). The print view's empty state is positive and offers a way back.
- **Error**: product-voice message with a retry on every failed fetch (pager,
  export). Never a raw stack trace or status code.

### 3.10 Copy rules

Every new visible string obeys QUALITY BAR §7 and §8: one obvious action,
words cut to the minimum, positive phrasing, no em-dashes or dash-asides,
none of the banned LLM vocabulary. Sweep before done. Suggested strings
(final wording is the implementer's, held to the same bar):
- Export section: "Export your record", "Download JSON", "Download CSV",
  "Print".
- Pager: "Load older flares".
- Print view: "Your flare record", "Back to ledger", "Print",
  "Start a flare to build your record." (empty).
- Errors: "Check your connection and try again." and, on a limit,
  "You're going quickly. Try again in a minute." (reuse the existing
  strings; do not invent new error voices).
- Ledger rows reuse the existing hedged helpers ("Started around Sep 10",
  "Ended around Sep 21", "Lasted about 6 days", "Peak severity 4 of 5").

### 3.11 Security, secrets, logging

- Authorization on every new route server-side: the extended list, the export
  endpoint, and the print page all resolve the session and scope every query
  by `userId`. A hidden button is never the access check.
- Every export and list query is `where: { userId: user.id }`; there is no
  code path that reads another user's flares or treatments.
- Zod validation at every boundary: list `limit`/`before`, export `format`.
  Reject unknown/extra query params with `400`.
- CSV formula-injection guard on every user-controlled field (§3.5). This is
  the output-encoding half of security hygiene for a downloadable file.
- Export rate-limited per user; the list endpoint is a bounded read.
- No new secrets, no new required env (the export limit has a safe default).
  No PII in logs: never log note text, treatment names, or email.

---

## 4. Ordered task list (each with acceptance criteria)

**T1. List pagination + treatments.** Extend `GET /api/flares` with keyset
pagination and batched treatments per §3.3–3.4; add `flareListQuerySchema`.
- AC: `GET /api/flares` returns the caller's flares newest-first with their
  treatments and a `nextCursor`; passing `before=<nextCursor>` returns the
  next page with no overlap and no gap; the final page returns
  `nextCursor: null`.
- AC: `limit` outside 1..50 and a malformed `before` each return `400`; no
  session returns `401`; the response never contains another user's flare.

**T2. Ledger presentation + pager.** Enrich the ledger rows (severity + key
treatments), render the first page server-side, and add `LedgerPager` and
`keyTreatmentsText` per §3.3, §3.8, §3.9.
- AC: each row shows onset to end, duration, peak severity, and key
  treatments without opening the flare; a closed flare with an approx bound
  reads "about N days", an exact-exact flare reads "N days".
- AC: with more than one page of flares, "Load older flares" appends the next
  page and disappears when the record is exhausted; first meaningful render
  shows real rows within about one second (SSR first page, two indexed
  queries).
- AC: at 390px the ledger has no horizontal scroll and each row is tappable
  to its detail.

**T3. Export endpoint (JSON + CSV).** `GET /api/export?format=json|csv` per
§3.5, with `src/lib/export.ts`, `src/lib/csv.ts`, `exportQuerySchema`, and
`exportLimit()`.
- AC: `format=json` returns a document that `JSON.parse`s and contains every
  one of the caller's flares with treatments and nothing from any other user;
  `format=csv` returns a header plus one row per treatment (and one row for a
  treatment-less flare) that opens correctly in a spreadsheet.
- AC: a field beginning with `=`, `+`, `-`, or `@` is neutralized in the CSV;
  fields with commas/quotes/newlines are RFC-4180 quoted.
- AC: missing/unknown `format` -> `400`; no session -> `401`; over the export
  limit -> `429`. Correct `Content-Type` and attachment `Content-Disposition`
  on both formats.

**T4. Printable view.** `/ledger/print` per §3.6 with print CSS in
`globals.css`.
- AC: the print view renders the whole record with hedged duration/end,
  severity, treatments, and notes; app chrome and on-screen controls are
  hidden in print; a flare is not split across pages.
- AC: it is authorized (a signed-out request redirects to sign-in) and shows
  only the caller's data; an empty record shows a positive line and a way
  back, never a blank page.
- AC: it introduces no headline synthesis, no since-last-visit scoping, and
  no appointment entity (EPIC 4 boundary held).

**T5. Export surface + states.** The ledger export section and
`ExportActions` per §3.9, with designed loading and error states.
- AC: from the ledger a user downloads JSON and CSV and reaches the print
  view; each action gives feedback within 100ms; a failed export shows a
  product-voice error with a retry, never a stack trace or raw status.
- AC: the export section is visibly subordinate to the list; at 390px there is
  no horizontal scroll.

**T6. Detail confirmation.** Confirm each ledger row links to
`/flares/:id/edit` and that surface shows the complete interview record,
editable (reusing EPIC 2's editor). Add only a missing field, if any.
- AC: tapping a flare opens its detail with end, duration, severity, every
  treatment (start + helped), and impact/symptom notes, all editable; a
  correction persists and survives reload.

**T7. Non-Goal guard.** Ensure `tests/nonGoalGuard.test.ts` still passes and
extend it to assert this EPIC added no filtering dashboard, chart/graph
library, or cross-user read.
- AC: the guard fails if the tree gains a chart/graph/plot library import, a
  ledger filter/search/facet control, or a share/public/cross-user read path,
  and passes on the delivered tree.

**Copy sweep (part of DONE, not a separate task).** Mechanically search every
user-visible string added or edited (the export section, pager, print view,
error messages, any new row copy) for `—`, `–`, the banned LLM vocabulary,
and negative empty-state phrasing ("You don't have", "No ... yet", "Nothing
here", "Unable to", "Something went wrong"). Fix every hit. Confirm
`tests/copy.test.ts` scans the new files (its ROOTS already include
`src/app` and `src/components`).

**README (part of DONE).** Update `README.md` so a stranger learns the ledger
lists the whole record, the export produces JSON/CSV, and the record prints
to one clean document. Keep the run/test commands accurate and free of
factory internals.

---

## 5. Test plan (which automated test proves each criterion)

| Acceptance criterion | Test type | What it asserts |
|---|---|---|
| List returns flares + treatments + cursor | API (Playwright) | `GET /api/flares` returns rows with `treatments` and a `nextCursor` |
| Keyset pagination has no gap/overlap | API (Playwright) | Seed > 1 page; walk `before=nextCursor` to exhaustion; union equals all flares, no id repeats |
| List rejects bad params / unauth / cross-user | API (Playwright) | `limit` out of range and malformed `before` -> `400`; no session -> `401`; response excludes another user's flare |
| Rows show duration/severity/treatments; hedging | Playwright (390px) | Row renders onset-to-end, duration ("about N days" vs "N days"), severity, key treatments; `scrollWidth <= innerWidth` |
| Load older appends and ends | Playwright | With > 1 page, "Load older flares" appends the next page and disappears at the end |
| Row links to editable detail | Playwright | Tapping a row opens `/flares/:id/edit` showing full interview data; an edit persists on reload |
| First render is fast / SSR first page | Playwright | Ledger HTML contains real rows on first response (server-rendered), not only after client fetch |
| JSON export parses and is complete + scoped | API (Playwright) | `format=json` body `JSON.parse`s, includes all of user A's flares/treatments, none of user B's |
| CSV export shape | Unit (Vitest) + API | Header + one row per treatment; treatment-less flare -> one row with empty treatment cols |
| CSV quoting + injection guard | Unit (Vitest) | Comma/quote/newline fields RFC-4180 quoted; a leading `= + - @` field is prefixed with `'` |
| Export headers | API (Playwright) | Correct `Content-Type` and attachment `Content-Disposition` for json and csv |
| Export bad format / unauth / rate limit | API (Playwright) | Missing/unknown `format` -> `400`; no session -> `401`; over the limit -> `429` |
| JSON payload builder scoping | Unit (Vitest) | `src/lib/export.ts` builder over two users' data returns only the target user's flares |
| Print view renders record, authorized, scoped | Playwright | `/ledger/print` shows the user's flares with hedged text; signed-out redirects; empty record shows a positive line |
| Print hides chrome / no page-split | Playwright | With print emulation, app nav and `no-print` controls are hidden; per-flare block has `break-inside: avoid` |
| Export surface feedback + error | Playwright | Download JSON/CSV works; a forced failure shows a product-voice error with retry, no stack trace |
| Non-Goal guard | Inspection (Vitest) | Source scan finds no chart/graph library, no filter/search dashboard control, no cross-user/share read |
| Copy sweep clean | Lint/script (Vitest) | New user-visible strings carry no `—`/`–`, banned vocabulary, or negative empty-state phrasing |

Every criterion above must have a green automated test before the EPIC is
`success`. Run the full Vitest and Playwright suites in the foreground to
completion.

---

## 6. Assumptions (resolved, non-blocking)

- **Pagination over a hard cap.** The AC allows "paginated or capped", but a
  multi-year clinical record must not silently hide older flares (the
  north-star promise is completeness), and export must be complete anyway.
  So the ledger uses keyset pagination to reach every flare while each query
  stays bounded and index-backed. This strengthens, and does not contradict,
  the plan.
- **Ordering.** The ledger stays newest-first by `created_at` (the existing
  index); the export and print views read oldest-first by onset (a record
  reads best as a timeline). Onset-based ledger sorting is out of scope.
- **List contract change.** EPIC 2 kept `GET /api/flares` lean without
  treatments; this EPIC adds treatments (a single batched, indexed relation
  load) because the row needs key treatments and the cost is negligible. This
  is a deliberate, documented change, not drift.
- **Export lives on the ledger, not a settings screen.** The plan houses
  export in settings; no settings screen exists yet and building one is out
  of scope, so the export actions sit subordinate on the ledger. A settings
  screen can move them later without changing the endpoint.
- **Printable output is a plain full-record printout.** The since-last-visit
  reconstruction, its data-built headline, and the correction pass are EPIC
  4's signature moment and are explicitly not built here.
- **No new stored fields and no LLM.** The DTOs and display helpers from EPIC
  2 already carry everything shown; export and print are deterministic
  serialization. No migration, no gateway grant, no new env beyond an
  optional export-limit default.
```