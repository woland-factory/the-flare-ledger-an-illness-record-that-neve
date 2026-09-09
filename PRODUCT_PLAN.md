# PRODUCT PLAN — The flare ledger

An illness record that never asks for a daily entry.

## Core value (one sentence)

A multi-year, doctor-ready record of illness flares built from minutes of
effort per flare, one tap when a flare starts and one short interview when
it ends, so you walk into an appointment with a one-page timeline instead
of a shrug.

## North star

Three years in, the user sits across from a new specialist and hands over
a single page that is the truest account of their illness anyone has ever
produced. They built it in minutes, a tap at a time, and were never once
nagged. The app feels less like a tracker and more like a witness: it was
there at the start of every flare and asked the right questions at the
end, so the history is simply there when it matters. The user leaves
appointments having been understood instead of guessed at, carrying a
record that is theirs, portable, and more useful every year. The standard:
the person with the least energy to spare still walks out with the
best-documented disease in the room.

## Quality differentiator

**Least effort to a clinical record.** This app must demand less of a sick
person than any other way to arrive at a doctor-ready history. Every
competing tool that produces a usable record charges for it in daily
logging; the abandonment evidence shows this population cannot pay that
price. We win on one axis and commit to it: the total effort from healthy
to handing over a one-pager is measured in minutes per flare, not entries
per day. Every screen is judged against "did this ask the user for one
gram more than it had to?"

## Signature moment

The pre-appointment reconstruction, handed across the desk. Before a
visit, the app drafts the whole since-last-visit timeline from a handful
of taps and asks only "what did I get wrong?" The user corrects it rather
than composes it, then reads out one page: "Three flares since March. The
worst lasted six days. The one where I started naproxen on day one was
half as long." The EPICs below build depth-first toward that render.

---

## MVP user stories

- As someone whose flare is starting, I tap one button on the home screen
  and set a fuzzy onset ("today", "a few days ago", "around a date")
  without filling a form.
- As someone who has recovered, I answer a short interview when I close the
  flare: how bad it got, what I tried and when, what seemed to help, how it
  affected me, recording uncertainty honestly ("about day 3").
- As someone who forgot a flare was still marked open, I get one gentle
  in-app nudge after several quiet days asking if it is still going, and
  never a second one.
- As someone with an appointment coming up, I generate a one-page timeline
  of my flares since the last visit, correct any detail, add a flare I
  never logged, and print or share it.
- As a long-term user, I browse my full ledger of flares and treatments and
  export everything as JSON, CSV, or a printable page.
- As a brand-new user, a short guided path walks me through logging one
  example flare end to end so I reach a first success before I am left
  alone.
- As a user who opens the app once a quarter, I install it to my home
  screen so it is findable the day the next flare starts.

## Data model sketch

- **User**: id, email, auth credentials, optional primary condition label
  (arthritis / IBD / lupus / other, used only to tune copy), created_at.
- **Flare**: id, user_id, status (`open` | `closed`), onset_date,
  onset_precision (`exact` | `approx` | `range`), end_date, end_precision,
  peak_severity (small scale, e.g. 1–5), impact_note, symptom_note,
  nudged_at (nullable, guarantees the single covenant nudge), created_at,
  updated_at.
- **Treatment**: id, flare_id, name, started_on (date or relative day),
  started_precision, helped (`yes` | `no` | `unsure`), note.
- **Appointment**: id, user_id, visit_date, specialty (optional),
  reconstruction_snapshot (the corrected timeline saved as structured
  JSON + rendered text), coverage_note, created_at.

The interview writes structured fields onto the Flare and its Treatments;
there is no separate free-form journal entity. Uncertainty is stored as
data (precision flags, "unsure"), never flattened into false precision.

## Screen / endpoint inventory

Screens (all mobile-first at 390px):
1. **Home / the button** — one primary action, "Start a flare". Shows the
   current open flare if one exists, plus quiet links to the ledger and to
   appointments.
2. **Onset sheet** — fuzzy "when did it start?" picker.
3. **Flare-end interview** — short branching form, one question per step.
4. **Ledger** — chronological list of flares with duration and treatments.
5. **Flare detail / edit** — full record for one flare, editable.
6. **Appointment reconstruction** — create a visit, review the drafted
   timeline, correct it, print one page.
7. **Settings** — condition label, export, install, data & privacy.
8. **First-run guided path** — a skippable overlay anchored to the real
   controls, gone after first success.

Endpoints (REST, JSON, every route authorized server-side):
- `POST /api/flares` — start a flare with onset.
- `GET /api/flares` — list (paginated / capped).
- `GET /api/flares/:id`, `PATCH /api/flares/:id` (edit or close with
  interview payload), `DELETE /api/flares/:id`.
- `POST /api/flares/:id/treatments`, `PATCH /api/treatments/:id`,
  `DELETE /api/treatments/:id`.
- `POST /api/appointments` — create and generate the draft timeline.
- `GET /api/appointments/:id`, `PATCH /api/appointments/:id` — save
  corrections.
- `GET /api/export?format=json|csv`.
- `GET /api/me`, `PATCH /api/me` — profile / condition label.
- Auth endpoints (sign up, sign in, sign out).

## Runtime LLM

None in v1. The core loop reaches its first moment of value with no key
and no network model: button, structured interview, deterministic
templated reconstruction. An LLM could later make the interview adaptive
and the one-pager's prose warmer under the bring-your-own-key path, but
putting a key-paste wall in front of a brain-fogged user mid-flare is a
rejection trigger in validation. LLM features are a Non-Goal for v1, so
this plan requests no gateway grant.

---

## EPIC list (build order)

Each EPIC is small and independently reviewable. EPICs 1–4 go depth-first
toward the signature moment; 5 covers the sparse-use lifecycle edges; 6 is
the polish pass.

### EPIC 1 — Walking skeleton: the button, onset, and staging deploy
**Scope.** App scaffold (frontend + backend + database), user auth, the
home screen with a single primary action, one-tap flare start with fuzzy
onset, per-user persistence, and the full staging deploy scaffold with
observability wired.

**Acceptance criteria.**
- `docker compose -f docker-compose.staging.yml up` builds and serves the
  app from the committed `Dockerfile`; a healthcheck endpoint returns 200.
- A new user can sign up and sign in; every API route rejects an
  unauthenticated request server-side (a request with no session returns
  401, verified).
- The home screen presents exactly one primary action, "Start a flare",
  reachable and tappable at a 390px viewport with no horizontal scroll and
  a touch target of at least 44px.
- Pressing it records a flare and immediately asks "When did it start?"
  with fuzzy options (today / a few days ago / around a date); the choice
  persists across reload.
- Input is validated at the boundary (a malformed onset is rejected);
  mutation and auth endpoints are rate-limited.
- The empty ledger shows a designed empty state that says what the screen
  is for and the first thing to do, in positive phrasing.
- `SEED_DEMO=1` seeds a demo user with at least two past flares and one
  reconstruction-ready history so a stranger opening staging sees real
  content within a minute without hand input.
- `SENTRY_DSN` and `UMAMI_WEBSITE_ID` are wired via env; missing env
  degrades gracefully with no crash. No PII in logs; no secrets in tracked
  files (`.env.example` placeholders only).
- Loading and error states are designed (skeleton in place, product-voice
  error message); no white screen, no raw stack trace.

**Non-Goals.** No interview yet, no reconstruction, no analytics, no
scheduled anything.

### EPIC 2 — Flare-end interview and close
**Scope.** Closing an open flare through a short branching interview that
captures severity, treatments, what helped, and impact, recording
uncertainty as data. Editing a flare and its treatments after the fact.

**Acceptance criteria.**
- From an open flare, "This flare ended" opens a short interview of 2 to 5
  steps, one question per step, fully usable at 390px.
- The interview captures: end date with precision, peak severity, zero or
  more treatments each with a name, when it started (fuzzy allowed), and
  whether it helped (yes / no / unsure), plus an optional impact and
  symptom note.
- Uncertainty is first-class: the user can answer "about day 3" or "a few
  days ago"; it is stored and later shown as hedged text, never rounded
  into false precision.
- Closing sets the flare to closed and derives duration from onset and end;
  an already-closed flare cannot be closed again.
- A closed flare can be reopened and edited; treatments can be added,
  edited, and removed.
- No scheduled prompt, streak, daily check-in, or correlation view exists
  anywhere in the app (Non-Goal guard, verified by inspection).
- All new routes are authorized, input-validated, and rate-limited; every
  new user-visible string is swept for banned tells.

**Non-Goals.** No adaptive/LLM interview, no reminders, no severity charts.

### EPIC 3 — The ledger and export
**Scope.** The chronological ledger of all flares with treatments and
durations, flare detail, and export of the whole record.

**Acceptance criteria.**
- The ledger lists all flares newest-first, paginated or capped so the
  query does not slow down as flares accumulate; each row shows onset to
  end, duration, peak severity, and key treatments.
- First meaningful render shows real content within about one second;
  empty and loading states are designed.
- Tapping a flare opens its detail with the full interview data, editable.
- Export produces valid JSON and CSV covering all flares and treatments;
  the downloaded file opens correctly and contains only this user's data.
- The ledger and detail are fully usable at 390px with no horizontal
  scroll.

**Non-Goals.** No filtering dashboards, no charts, no cross-user or shared
views.

### EPIC 4 — Pre-appointment reconstruction (signature moment)
**Scope.** Creating an appointment, drafting the since-last-visit timeline
deterministically from stored events, letting the user correct it and add a
missed flare, stating coverage honestly, and rendering a clean one page.

**Acceptance criteria.**
- "Doctor visit coming up" creates an appointment and generates a drafted
  timeline covering flares since the previous appointment (or all-time on
  the first), built deterministically from stored data.
- The draft leads with a real headline built from the data, for example
  "3 flares since March. Longest 6 days. Naproxen started on day one, that
  flare was about half as long," and states coverage plainly (for example
  "2 flares recorded"), never implying completeness.
- The user can correct any drafted value and add a flare that was never
  logged, from inside the correction pass; corrections save to the
  appointment snapshot.
- A print view renders to a single clean page on A4 and Letter with print
  CSS, readable, with no app chrome.
- Interview uncertainty surfaces as hedged wording ("about 6 days"), not
  false precision.
- The whole flow is legible at 390px; every route is authorized,
  validated, and rate-limited.
- No LLM is used in this path; the prose is templated over structured data
  (Non-Goal guard).

**Non-Goals.** No AI-written narrative, no calendar or weather ingestion,
no clinician portal.

### EPIC 5 — First run, install, and the covenant nudge
**Scope.** The lifecycle edges for a sparse-use app: a guided first
success, home-screen installability, and the single covenant nudge that
resolves the never-closed-flare tension without becoming a nag.

**Acceptance criteria.**
- Guided first run: a skippable path of 2 to 4 steps, anchored to the real
  controls, walks a new user through logging one example flare to a first
  success. Each step is one short imperative sentence. It appears only
  until the first success and never for a returning user.
- The app is installable as a PWA (valid manifest, service worker, passes
  install criteria); the app shell loads offline; an install prompt is
  offered at the first success and is dismissible.
- An open flare that has been open for more than N quiet days surfaces
  exactly one in-app prompt, "Is this flare still going?", with options to
  close it or keep it open; it never repeats for that flare and never fires
  on a calendar schedule. Closed and recent flares never prompt.
- No push notifications, no emails, and no calendar-scheduled prompts exist
  anywhere (Non-Goal guard, verified).
- All new user-visible strings are swept for banned tells.

**Non-Goals.** No notification engine, no scheduled email, no more than one
unsolicited prompt per opened flare.

### EPIC 6 — Polish pass
**Scope.** A UX and performance pass over the whole delivered product
against the QUALITY BAR and the "least effort to a clinical record"
differentiator. No new features; tighten what exists.

**Acceptance criteria.**
- Every screen is verified at 390px: no horizontal scroll, touch targets at
  least 44px, text readable without zoom.
- Every empty, loading, and error state across the app is designed and
  reviewed; no white screens, no raw errors, no dead ends.
- Every user-visible string is mechanically swept for em-dashes, the banned
  LLM vocabulary, and negative empty-state phrasing; each hit is fixed.
- Perceived speed verified: first meaningful render within about one
  second, every interaction gives feedback within 100ms, no unindexed query
  on a hot path, all lists paginated or capped.
- Accessibility basics verified: color contrast, visible focus states,
  labeled inputs, semantic headings and landmarks, keyboard reaches every
  control.
- The effort audit: counting taps and typed characters, logging a flare
  start to a corrected one-pager stays in the minutes-per-flare budget the
  differentiator promises; any screen that over-asks is trimmed.
- `README.md` lets a stranger understand, run (verified against the compose
  files), and contribute, with no factory internals.

**Non-Goals.** No new features, no redesign, no gold-plating past the bar.

---

## Non-Goals / Out of scope (whole product, v1)

- **No daily check-ins and no scheduled prompts of any kind.** This is the
  paradigm the app exists to replace.
- **No calendar-driven reminders.** The only unsolicited prompt is one
  in-app covenant nudge per opened flare.
- **No correlation or insight analytics**, no "flares vs weather" charts,
  no dashboards. The value is the record, not analytics.
- **No streaks, badges, points, or gamification.**
- **No LLM in the core loop** in v1: no adaptive interview, no AI-written
  prose.
- **No migraine-attack specialization.** Model multi-day and multi-week
  flares (arthritis, IBD, lupus, endometriosis, long-COVID crashes).
  Migraine-only users are already well served elsewhere.
- **No calendar or weather ingestion** (the memory-anchored interview is a
  bolder-sibling variant, deliberately out of scope).
- **No caregiver or multi-user accounts, no clinician portal, no
  community or sharing features.**
- **No native mobile app.** PWA only.
