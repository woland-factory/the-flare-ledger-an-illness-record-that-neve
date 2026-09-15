import { z } from "zod";
import type { Appointment } from "@prisma/client";
import {
  daysBetween,
  formatExact,
  formatMonthDay,
  parseIsoDate,
  toIsoDate,
} from "./date";
import { helpedText } from "./display";

// The appointment snapshot is a self-contained account of the flares since the
// previous visit. Drafting copies stored rows into it; from then on the
// correction pass edits the snapshot and the one-pager renders it. Nothing
// here calls a model or reads an external source: every string below is
// templated over structured data by pure functions.

export type SnapshotTreatment = {
  name: string;
  startedOn: string | null;
  startedPrecision: "exact" | "approx" | null;
  helped: "yes" | "no" | "unsure" | null;
};

export type SnapshotFlare = {
  key: string;
  source: "drafted" | "added";
  onsetDate: string;
  onsetPrecision: "exact" | "approx";
  endDate: string | null;
  endPrecision: "exact" | "approx" | null;
  peakSeverity: number | null;
  note: string | null;
  treatments: SnapshotTreatment[];
};

export type Snapshot = {
  version: 1;
  rangeStart: string | null;
  truncated: boolean;
  flares: SnapshotFlare[];
};

export const FLARE_CAP = 50;
const TREATMENT_CAP = 20;
const NOTE_MAX = 300;
const MAX_DURATION_DAYS = 730;

const isoDay = z
  .string()
  .refine((v) => parseIsoDate(v) !== null, { message: "bad_date" });

export const snapshotTreatmentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    startedOn: isoDay.nullable(),
    startedPrecision: z.enum(["exact", "approx"]).nullable(),
    helped: z.enum(["yes", "no", "unsure"]).nullable(),
  })
  .strict()
  .refine((t) => (t.startedOn === null) === (t.startedPrecision === null), {
    message: "start_precision_mismatch",
  });

const snapshotFlareSchema = z
  .object({
    key: z.string().min(1).max(80),
    source: z.enum(["drafted", "added"]),
    onsetDate: isoDay,
    onsetPrecision: z.enum(["exact", "approx"]),
    endDate: isoDay.nullable(),
    endPrecision: z.enum(["exact", "approx"]).nullable(),
    peakSeverity: z.number().int().min(1).max(5).nullable(),
    note: z.string().max(NOTE_MAX).nullable(),
    treatments: z.array(snapshotTreatmentSchema).max(TREATMENT_CAP),
  })
  .strict()
  .refine((f) => (f.endDate === null) === (f.endPrecision === null), {
    message: "end_precision_mismatch",
  });

export const snapshotSchema = z
  .object({
    version: z.literal(1),
    rangeStart: isoDay.nullable(),
    truncated: z.boolean(),
    flares: z.array(snapshotFlareSchema).max(FLARE_CAP),
  })
  .strict();

// ---------------------------------------------------------------------------
// Drafting (pure; the route loads rows and passes them in)

export type DraftTreatmentRow = {
  name: string;
  startedOn: Date | null;
  startedPrecision: string | null;
  helped: string | null;
  createdAt: Date;
};

export type DraftFlareRow = {
  id: string;
  onsetDate: Date;
  onsetPrecision: string;
  endDate: Date | null;
  endPrecision: string | null;
  peakSeverity: number | null;
  impactNote: string | null;
  symptomNote: string | null;
  createdAt: Date;
  treatments: DraftTreatmentRow[];
};

// The one-pager needs a line, not an essay: the interview notes joined and
// word-truncated. The user can rewrite it in the correction pass.
export function draftNote(
  impactNote: string | null,
  symptomNote: string | null,
): string | null {
  const parts = [impactNote, symptomNote]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  const joined = parts.join(" ");
  if (joined.length <= NOTE_MAX) return joined;
  const slice = joined.slice(0, NOTE_MAX - 1);
  const cut = slice.lastIndexOf(" ");
  const base = (cut > 0 ? slice.slice(0, cut) : slice).trimEnd();
  return `${base}…`;
}

// Same reading order as serializeFlare: start ascending, unrecorded last.
function orderDraftTreatments(a: DraftTreatmentRow, b: DraftTreatmentRow): number {
  if (a.startedOn && b.startedOn) {
    if (a.startedOn.getTime() !== b.startedOn.getTime())
      return a.startedOn.getTime() - b.startedOn.getTime();
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  if (a.startedOn) return -1;
  if (b.startedOn) return 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function asPrecision(value: string | null): "exact" | "approx" {
  return value === "exact" ? "exact" : "approx";
}

function asHelped(value: string | null): "yes" | "no" | "unsure" | null {
  return value === "yes" || value === "no" || value === "unsure" ? value : null;
}

/**
 * Build the drafted snapshot from stored rows. Deterministic: same rows and
 * rangeStart, same snapshot, byte for byte. A flare is in range iff it is
 * open or ended on/after rangeStart (all rows when rangeStart is null); the
 * route's query applies the same rule so the load stays bounded.
 */
export function buildDraftSnapshot(
  rows: DraftFlareRow[],
  rangeStart: string | null,
): Snapshot {
  const bound = rangeStart ? parseIsoDate(rangeStart) : null;
  const inRange = rows.filter(
    (f) => !bound || f.endDate === null || f.endDate.getTime() >= bound.getTime(),
  );
  const ordered = [...inRange].sort(
    (a, b) =>
      a.onsetDate.getTime() - b.onsetDate.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const truncated = ordered.length > FLARE_CAP;
  const kept = truncated ? ordered.slice(ordered.length - FLARE_CAP) : ordered;
  return {
    version: 1,
    rangeStart,
    truncated,
    flares: kept.map((f) => ({
      key: f.id,
      source: "drafted" as const,
      onsetDate: toIsoDate(f.onsetDate),
      onsetPrecision: asPrecision(f.onsetPrecision),
      endDate: f.endDate ? toIsoDate(f.endDate) : null,
      endPrecision: f.endDate ? asPrecision(f.endPrecision) : null,
      peakSeverity: f.peakSeverity,
      note: draftNote(f.impactNote, f.symptomNote),
      treatments: [...f.treatments]
        .sort(orderDraftTreatments)
        .slice(0, TREATMENT_CAP)
        .map((t) => ({
          name: t.name,
          startedOn: t.startedOn ? toIsoDate(t.startedOn) : null,
          startedPrecision: t.startedOn ? asPrecision(t.startedPrecision) : null,
          helped: asHelped(t.helped),
        })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Derived values (never stored, so a corrected date can never go stale)

export function flareDurationDays(flare: SnapshotFlare): number | null {
  if (!flare.endDate) return null;
  const onset = parseIsoDate(flare.onsetDate);
  const end = parseIsoDate(flare.endDate);
  if (!onset || !end) return null;
  return daysBetween(onset, end) + 1;
}

function isApproxFlare(flare: SnapshotFlare): boolean {
  return flare.onsetPrecision === "approx" || flare.endPrecision === "approx";
}

function dayCount(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

// ---------------------------------------------------------------------------
// Templated prose (pure, deterministic, hedged where the data is hedged)

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthPhrase(iso: string, today: Date): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  const name = FULL_MONTHS[d.getUTCMonth()];
  return d.getUTCFullYear() === today.getUTCFullYear()
    ? name
    : `${name} ${d.getUTCFullYear()}`;
}

function dateText(iso: string, today: Date): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return d.getUTCFullYear() === today.getUTCFullYear()
    ? formatMonthDay(d)
    : formatExact(d);
}

// The signature sentence: the same treatment started on day one in one flare
// and days into another, and the day-one flare ran shorter. The ratio is
// always hedged with a fraction word, never a false precision.
function contrastSentence(snapshot: Snapshot): string | null {
  type Candidate = { name: string; ratio: number; aOnset: string };
  let best: Candidate | null = null;
  const closed = snapshot.flares.filter((f) => flareDurationDays(f) !== null);
  for (const a of closed) {
    const durA = flareDurationDays(a);
    if (durA === null || durA < 1) continue;
    for (const t of a.treatments) {
      if (!t.startedOn || t.startedOn !== a.onsetDate) continue;
      const key = t.name.trim().toLowerCase();
      for (const b of closed) {
        if (b === a) continue;
        const durB = flareDurationDays(b);
        if (durB === null || durB < 1 || durA >= durB) continue;
        const onsetB = parseIsoDate(b.onsetDate);
        if (!onsetB) continue;
        const lateStart = b.treatments.some((tb) => {
          if (!tb.startedOn || tb.name.trim().toLowerCase() !== key) return false;
          const started = parseIsoDate(tb.startedOn);
          return started !== null && daysBetween(onsetB, started) >= 2;
        });
        if (!lateStart) continue;
        const candidate: Candidate = {
          name: t.name.trim(),
          ratio: durA / durB,
          aOnset: a.onsetDate,
        };
        if (
          !best ||
          candidate.ratio < best.ratio ||
          (candidate.ratio === best.ratio &&
            (candidate.name.toLowerCase() < best.name.toLowerCase() ||
              (candidate.name.toLowerCase() === best.name.toLowerCase() &&
                candidate.aOnset < best.aOnset)))
        ) {
          best = candidate;
        }
      }
    }
  }
  if (!best || best.ratio > 0.85) return null;
  if (best.ratio <= 0.3)
    return `${best.name} started on day one, that flare was about a third as long.`;
  if (best.ratio <= 0.6)
    return `${best.name} started on day one, that flare was about half as long.`;
  return `${best.name} started on day one, that flare was noticeably shorter.`;
}

/** One to three short sentences a rheumatologist can hear across a desk. */
export function headlineText(snapshot: Snapshot, today: Date): string {
  const n = snapshot.flares.length;
  const since = snapshot.rangeStart
    ? ` since ${monthPhrase(snapshot.rangeStart, today)}`
    : null;
  if (n === 0) {
    return since ? `A quiet stretch${since}.` : "A quiet stretch so far.";
  }
  const flareWord = n === 1 ? "flare" : "flares";
  const sentences = [since ? `${n} ${flareWord}${since}.` : `${n} ${flareWord} recorded.`];

  const closed = snapshot.flares.filter((f) => flareDurationDays(f) !== null);
  if (closed.length > 0) {
    let longest = closed[0];
    for (const f of closed) {
      const d = flareDurationDays(f);
      if (d !== null && d > (flareDurationDays(longest) ?? 0)) longest = f;
    }
    const days = dayCount(flareDurationDays(longest) ?? 0);
    const hedged = isApproxFlare(longest) ? `about ${days}` : days;
    sentences.push(closed.length >= 2 ? `Longest ${hedged}.` : `It lasted ${hedged}.`);
  }

  const contrast = contrastSentence(snapshot);
  if (contrast) sentences.push(contrast);
  return sentences.join(" ");
}

/** States plainly what the page was built from. Never implies completeness. */
export function coverageText(snapshot: Snapshot): string {
  const n = snapshot.flares.length;
  const base = `Built from ${n} recorded ${n === 1 ? "flare" : "flares"}, not a daily diary.`;
  return snapshot.truncated ? `${base} Showing the newest ${FLARE_CAP}.` : base;
}

/** The per-flare line: range and duration, hedged only where a bound is. */
export function flareRangeText(flare: SnapshotFlare, today: Date): string {
  const onset = dateText(flare.onsetDate, today);
  if (!flare.endDate) {
    return flare.onsetPrecision === "approx"
      ? `Started around ${onset}, still going.`
      : `Started ${onset}, still going.`;
  }
  const end = dateText(flare.endDate, today);
  const days = dayCount(flareDurationDays(flare) ?? 0);
  const onsetPart = flare.onsetPrecision === "approx" ? `Around ${onset}` : onset;
  const endPart = flare.endPrecision === "approx" ? `around ${end}` : end;
  const durPart = isApproxFlare(flare) ? `about ${days}` : days;
  return `${onsetPart} to ${endPart}, ${durPart}.`;
}

/** One treatment line: which day it started, and whether it helped. */
export function treatmentLineText(
  t: SnapshotTreatment,
  flare: SnapshotFlare,
): string {
  const helped = helpedText(t.helped);
  if (!t.startedOn) return `${t.name}, start not recorded. ${helped}.`;
  const onset = parseIsoDate(flare.onsetDate);
  const started = parseIsoDate(t.startedOn);
  if (!onset || !started) return `${t.name}, start not recorded. ${helped}.`;
  const k = daysBetween(onset, started) + 1;
  const dayWord = k === 1 ? "day one" : `day ${k}`;
  const approx =
    t.startedPrecision === "approx" || flare.onsetPrecision === "approx";
  return `${t.name} from ${approx ? "about " : ""}${dayWord}. ${helped}.`;
}

/** The visit subline: "Rheumatology visit, Oct 2, 2026." or a plain date. */
export function visitLineText(visitDate: string, specialty: string | null): string {
  const d = parseIsoDate(visitDate);
  const when = d ? formatExact(d) : visitDate;
  return specialty ? `${specialty} visit, ${when}.` : `Visit on ${when}.`;
}

// ---------------------------------------------------------------------------
// Corrections (pure apply; the route wraps auth, Zod, and persistence)

export type CorrectionOp =
  | { op: "set_visit"; visit_date?: string; specialty?: string | null }
  | {
      op: "set_flare";
      key: string;
      onset_date?: string;
      onset_precision?: "exact" | "approx";
      end_date?: string | null;
      end_precision?: "exact" | "approx";
      peak_severity?: number | null;
      note?: string | null;
      treatments?: SnapshotTreatment[];
    }
  | {
      op: "add_flare";
      onset_date: string;
      onset_precision: "exact" | "approx";
      end_date?: string | null;
      end_precision?: "exact" | "approx";
      peak_severity?: number | null;
      note?: string | null;
      treatments?: SnapshotTreatment[];
    }
  | { op: "remove_flare"; key: string };

export type CorrectionResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; error: string };

const ERR_READ = "That request could not be read.";
const ERR_ONSET = "That date doesn't look right. Pick when it started.";
const ERR_END = "That date doesn't look right. Pick when it ended.";
const ERR_VISIT = "That date doesn't look right. Pick your visit date.";
const ERR_CAP = `This timeline is at its limit of ${FLARE_CAP} flares.`;

function validateFlare(flare: SnapshotFlare, today: Date): string | null {
  const onset = parseIsoDate(flare.onsetDate);
  if (!onset || onset.getTime() > today.getTime()) return ERR_ONSET;
  if (flare.endDate !== null) {
    const end = parseIsoDate(flare.endDate);
    if (!end || !flare.endPrecision) return ERR_END;
    if (end.getTime() > today.getTime()) return ERR_END;
    if (end.getTime() < onset.getTime()) return ERR_END;
    if (daysBetween(onset, end) + 1 > MAX_DURATION_DAYS) return ERR_END;
  }
  for (const t of flare.treatments) {
    if (t.startedOn !== null) {
      const started = parseIsoDate(t.startedOn);
      if (
        !started ||
        started.getTime() > today.getTime() ||
        started.getTime() < onset.getTime()
      ) {
        return ERR_ONSET;
      }
    }
  }
  return null;
}

function sortSnapshotFlares(flares: SnapshotFlare[]): SnapshotFlare[] {
  // ISO dates compare lexicographically; the sort is stable, so equal onsets
  // keep their existing order.
  return [...flares].sort((a, b) =>
    a.onsetDate < b.onsetDate ? -1 : a.onsetDate > b.onsetDate ? 1 : 0,
  );
}

/**
 * Apply exactly one correction to a snapshot. Pure: no clock (the route
 * passes today) and no randomness (the route passes the key for an added
 * flare). Corrections never write back to the ledger.
 */
export function applyCorrection(
  snapshot: Snapshot,
  op: CorrectionOp,
  today: Date,
  newKey?: string,
): CorrectionResult {
  if (op.op === "set_visit") {
    if (op.visit_date !== undefined) {
      const v = parseIsoDate(op.visit_date);
      if (!v || Math.abs(daysBetween(today, v)) > 365)
        return { ok: false, error: ERR_VISIT };
    }
    return { ok: true, snapshot };
  }

  if (op.op === "remove_flare") {
    const target = snapshot.flares.find((f) => f.key === op.key);
    if (!target || target.source !== "added")
      return { ok: false, error: ERR_READ };
    return {
      ok: true,
      snapshot: {
        ...snapshot,
        flares: snapshot.flares.filter((f) => f.key !== op.key),
      },
    };
  }

  if (op.op === "add_flare") {
    if (snapshot.flares.length >= FLARE_CAP) return { ok: false, error: ERR_CAP };
    if (!newKey) return { ok: false, error: ERR_READ };
    const flare: SnapshotFlare = {
      key: newKey,
      source: "added",
      onsetDate: op.onset_date,
      onsetPrecision: op.onset_precision,
      endDate: op.end_date ?? null,
      endPrecision: op.end_date != null ? (op.end_precision ?? null) : null,
      peakSeverity: op.peak_severity ?? null,
      note: op.note ?? null,
      treatments: op.treatments ?? [],
    };
    const invalid = validateFlare(flare, today);
    if (invalid) return { ok: false, error: invalid };
    return {
      ok: true,
      snapshot: {
        ...snapshot,
        flares: sortSnapshotFlares([...snapshot.flares, flare]),
      },
    };
  }

  const index = snapshot.flares.findIndex((f) => f.key === op.key);
  if (index < 0) return { ok: false, error: ERR_READ };
  const current = snapshot.flares[index];
  const merged: SnapshotFlare = {
    ...current,
    ...(op.onset_date !== undefined
      ? { onsetDate: op.onset_date, onsetPrecision: op.onset_precision ?? current.onsetPrecision }
      : {}),
    ...(op.end_date !== undefined
      ? op.end_date === null
        ? { endDate: null, endPrecision: null }
        : { endDate: op.end_date, endPrecision: op.end_precision ?? current.endPrecision ?? "approx" }
      : {}),
    ...(op.peak_severity !== undefined ? { peakSeverity: op.peak_severity } : {}),
    ...(op.note !== undefined ? { note: op.note } : {}),
    ...(op.treatments !== undefined ? { treatments: op.treatments } : {}),
  };
  const invalid = validateFlare(merged, today);
  if (invalid) return { ok: false, error: invalid };
  const flares = [...snapshot.flares];
  flares[index] = merged;
  return { ok: true, snapshot: { ...snapshot, flares: sortSnapshotFlares(flares) } };
}

// ---------------------------------------------------------------------------
// DTOs

export type AppointmentDTO = {
  id: string;
  visitDate: string;
  specialty: string | null;
  snapshot: Snapshot;
  createdAt: string;
};

export type AppointmentListItemDTO = {
  id: string;
  visitDate: string;
  specialty: string | null;
  flareCount: number;
  createdAt: string;
};

export function serializeAppointment(a: Appointment): AppointmentDTO {
  return {
    id: a.id,
    visitDate: toIsoDate(a.visitDate),
    specialty: a.specialty,
    snapshot: a.snapshot as unknown as Snapshot,
    createdAt: a.createdAt.toISOString(),
  };
}

// The list stays lean: a count from the snapshot, never the snapshot itself.
export function serializeAppointmentListItem(a: Appointment): AppointmentListItemDTO {
  const snapshot = a.snapshot as unknown as Snapshot;
  return {
    id: a.id,
    visitDate: toIsoDate(a.visitDate),
    specialty: a.specialty,
    flareCount: Array.isArray(snapshot?.flares) ? snapshot.flares.length : 0,
    createdAt: a.createdAt.toISOString(),
  };
}
