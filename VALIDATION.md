# VALIDATION — The flare ledger: an illness record that never asks for a daily entry

## Verdict: VIABLE

Viable as value, with three binding design conditions (below). This is a
real inversion of a paradigm the evidence shows failing, aimed at a
population whose defining problem is documented in their own words, and
its core loop needs no LLM, no third-party API, no network effect, and no
content drumbeat. The premortem's kill probability of 0.75 is priced
against adoption at scale; the factory's bar is durable value to real
users, and on that bar the idea clears — provided the build resolves the
tensions named here instead of hiding them.

## Core value proposition

A multi-year, doctor-ready record of illness flares built from minutes of
effort per flare, not per day. The data model matches the disease shape
(bounded episodes) instead of the calendar, so the record survives the
92 quiet days that kill every daily diary. The payoff moment is concrete
and recurring: answering "how have you been since I last saw you?" with a
one-page timeline instead of a shrug — "three flares since March, worst
lasted six days, the one where naproxen started on day one was half as
long."

Why it survives the standard kill tests:

- **"Couldn't a chatbot do it?"** No. The product's essence is state and
  triggers: an open-flare state a chat window doesn't hold, an interview
  fired at flare end, a reconstruction fired before an appointment, and a
  consistent structured store rendered identically months apart. A
  chatbot needs the raw material this population demonstrably fails to
  produce; this product manufactures that raw material.
- **"Couldn't a free tool do it?"** The named free incumbents (Bearable,
  Flaredown, Guava, Bowelle, Flare) are all the daily check-in paradigm —
  the thing the evidence shows this population quitting in 2–4 weeks.
  The honest exception is Migraine Buddy, which already ships attack-based
  capture free; this narrows the wedge (condition 3 below), it does not
  kill it. A pinned phone note is the real free competitor, and it loses
  on exactly what matters clinically: no flare-end interview, no
  structured fields, no since-last-visit reconstruction, no consistent
  one-pager, no export.
- **Durable artifact?** Yes, unambiguously — the ledger itself, plus the
  appointment one-pagers, all exportable. After a few years it is the
  only accurate account of the user's disease that exists anywhere. This
  is the strongest compounding-value shape the funnel has: each flare
  makes the record more clinically useful than the last.
- **Agent-buildable at the quality bar?** Comfortably. Small data model
  (episodes, treatments, interviews, appointments), structured branching
  form for the interview, deterministic templated render plus print CSS
  for the one-pager, PWA shell for home-screen presence. Zero cold-start:
  fully valuable to user #1. No moderation, no hardware, no approvals.

## Minimal feature set (the smallest product that delivers the value)

1. **Flare start, one tap, backdating first-class.** A single primary
   action on the home screen. Because arthritis and IBD flares creep in
   over days (the premortem's strongest objection), the control must not
   assume a "moment": pressing it records "flaring now" and immediately
   offers "when did it start?" with fuzzy answers (today / a few days
   ago / around a date). Gradual onset is the common case, not an edge
   case.
2. **Flare-end structured interview.** A short branching form (severity
   arc, treatments and when started, what seemed to help, impact), fired
   only when the user closes the flare. It records uncertainty as data
   ("around day 3") rather than faking precision. No LLM anywhere in
   this path.
3. **The covenant nudge.** No calendar-scheduled prompts, ever. The one
   exception: a flare the user opened may ask to be closed after N quiet
   days (single gentle prompt, in-app first). This resolves the
   never-closed-flare tension without becoming a nag app.
4. **Pre-appointment reconstruction.** "Doctor visit coming up" produces
   a drafted since-last-visit timeline from the sparse events; the user
   corrects it rather than composes it. Deterministic templated prose
   over structured data, print-ready one page.
5. **The ledger view and export.** Chronological record of all flares
   with treatments; JSON/CSV export and printable output. The artifact
   must visibly belong to the user.
6. **PWA installability.** The start button must be reachable from the
   home screen; a URL the user must remember after 90 silent days is the
   most likely cause of death (condition 2 below).

An LLM (BYOK, per the LLM ACCESS contract) could later make the
interview adaptive and the one-pager's prose nicer, but the core loop
must ship key-free end to end: button, form, timeline. The premortem is
right that an LLM-gated interview would put a key-paste wall in front of
a brain-fogged user mid-flare; that framing should be treated as a
non-goal for v1.

## Main risks

1. **Gradual onset breaks the button primitive.** Arthritis/IBD flares
   have no crisp start. If the build ships a literal "flare started
   now" stopwatch, the core mechanic fails its main audience.
   *Mitigation is design, not hope:* backdating and fuzzy onset are part
   of the primary action, not an edit-later afterthought.
2. **Dormancy: forgotten before flare #2.** An app touched minutes per
   quarter, forbidden from pinging, must still be findable months later.
   This is the most likely cause of death. Mitigations available inside
   the covenant: PWA install prompt at first success, an optional
   appointment-date field that permits ONE user-requested pre-visit
   email ("you asked us to remind you before your appointment" is a
   user-initiated trigger, not a schedule), and export so even a
   part-used ledger retains value. Residual risk is real and accepted.
3. **Recall bias.** The flare-end interview is retrospective and
   peak-end biased. The defense holds only if the product records and
   displays uncertainty honestly (ranges, "about", confidence in the
   one-pager) instead of dressing recall up as telemetry. Sparse-honest
   beats dense-abandoned, and clinicians will trust hedged data over
   false precision.
4. **Migraine flank.** Migraine Buddy already serves sharp-onset,
   hours-long attacks free. The product must position and model for
   multi-day/multi-week flares (arthritis, IBD, lupus, endometriosis,
   long-COVID crashes) where no attack-app's data shape fits. A
   migraine-only user should be told, in effect, that other tools serve
   them well already.
5. **Holed ledger distrust.** Missed flares leave gaps. The
   reconstruction step partially heals this (the pre-visit correction
   pass lets the user add a flare they never logged), and the one-pager
   should state its own coverage honestly ("2 flares recorded") rather
   than implying completeness.

## What would make me reject it

- If the core loop required a runtime LLM or any pasted key before first
  value. (It does not; keep it that way.)
- If the product could only be valuable with daily or scheduled input —
  i.e. if honest analysis showed the flare-end interview alone cannot
  produce a doctor-useful timeline. The clinical evidence quoted in the
  dossier ("we've actually changed the therapy procedures based on the
  data") says otherwise.
- If the build drifts back into the incumbent shape: daily check-ins,
  streaks, correlation dashboards, mood grids. Any of those in the plan
  is grounds to stop the build; they are the disease this product exists
  to cure, and the T1D evidence explicitly dismisses their output.
- If the never-asks covenant collapses into a notification engine. More
  than one unsolicited prompt per opened flare, or any calendar-driven
  prompt, and the product becomes the thing it swore not to be — at
  which point it has no reason to exist next to Bearable.
- If PWA/home-screen installability proved technically unreachable, the
  dormancy risk would compound to fatal. (It is reachable; standard web
  platform capability.)

## Notes for the planner

- The signature moment is the pre-appointment reconstruction handed
  across the desk. EPICs should build depth-first toward that render,
  not breadth-first across generic tracking features.
- The premortem's "cheapest test" (manual concierge loop with five
  patients) is a business-validation instrument; the factory's bar is
  user value, and the build is cheap enough that shipping IS the test.
- Non-goals to carry forward verbatim: no daily check-ins, no scheduled
  prompts, no correlation/insight analytics, no streaks or gamification,
  no LLM in the core loop, no migraine-attack specialization.
