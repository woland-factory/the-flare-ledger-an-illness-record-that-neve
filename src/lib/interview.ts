import { addDays, parseIsoDate, todayUtc } from "./date";
import { FEW_DAYS_ANCHOR, MAX_ONSET_DAYS_BACK, type OnsetPrecision } from "./onset";
import type { TreatmentInput } from "./validation";

// The flare-end interview is a fixed, deterministic sequence. The server owns
// every stored date: for a fuzzy answer the client sends only the choice, and
// this module derives the date so the record never claims a precision the user
// did not give.

export type EndChoice = "today" | "few_days_ago" | "around_date";

export type EndResult = { endDate: Date; endPrecision: OnsetPrecision };

export type EndError =
  | "unknown_choice"
  | "around_date_required"
  | "around_date_invalid"
  | "around_date_future"
  | "end_before_onset"
  | "end_too_far";

/**
 * Derive the stored end date from the interview answer.
 * - today        -> server today, exact.
 * - few_days_ago -> server today minus three days, approx ("a few days ago").
 * - around_date  -> the picked date, approx.
 * Rejected when the end lands before onset or more than 730 days after it.
 */
export function deriveEnd(
  choice: EndChoice,
  aroundDate: string | undefined,
  onsetDate: Date,
  today: Date = todayUtc(),
): { ok: true; value: EndResult } | { ok: false; error: EndError } {
  let endDate: Date;
  let endPrecision: OnsetPrecision;

  switch (choice) {
    case "today":
      endDate = today;
      endPrecision = "exact";
      break;
    case "few_days_ago":
      endDate = addDays(today, -FEW_DAYS_ANCHOR);
      endPrecision = "approx";
      break;
    case "around_date": {
      if (!aroundDate) return { ok: false, error: "around_date_required" };
      const parsed = parseIsoDate(aroundDate);
      if (!parsed) return { ok: false, error: "around_date_invalid" };
      if (parsed.getTime() > today.getTime())
        return { ok: false, error: "around_date_future" };
      endDate = parsed;
      endPrecision = "approx";
      break;
    }
    default:
      return { ok: false, error: "unknown_choice" };
  }

  if (endDate.getTime() < onsetDate.getTime())
    return { ok: false, error: "end_before_onset" };
  if (endDate.getTime() > addDays(onsetDate, MAX_ONSET_DAYS_BACK).getTime())
    return { ok: false, error: "end_too_far" };

  return { ok: true, value: { endDate, endPrecision } };
}

export type TreatmentStartChoice =
  | "flare_onset"
  | "few_days_in"
  | "around_date"
  | "unsure";

export type TreatmentStartResult = {
  startedOn: Date | null;
  startedPrecision: OnsetPrecision | null;
};

export type TreatmentStartError =
  | "unknown_choice"
  | "around_date_required"
  | "around_date_invalid"
  | "around_date_future"
  | "start_before_onset";

/**
 * Derive when a treatment started, relative to the flare's onset.
 * - flare_onset -> the onset date, inheriting the flare's own certainty.
 * - few_days_in -> onset plus three days, approx ("a few days in").
 * - around_date -> the picked date, approx.
 * - unsure      -> null date and precision (uncertainty stored as absence).
 */
export function deriveTreatmentStart(
  choice: TreatmentStartChoice,
  aroundDate: string | undefined,
  onsetDate: Date,
  onsetPrecision: OnsetPrecision,
  today: Date = todayUtc(),
): { ok: true; value: TreatmentStartResult } | { ok: false; error: TreatmentStartError } {
  switch (choice) {
    case "flare_onset":
      return {
        ok: true,
        value: { startedOn: onsetDate, startedPrecision: onsetPrecision },
      };
    case "few_days_in":
      return {
        ok: true,
        value: { startedOn: addDays(onsetDate, FEW_DAYS_ANCHOR), startedPrecision: "approx" },
      };
    case "around_date": {
      if (!aroundDate) return { ok: false, error: "around_date_required" };
      const parsed = parseIsoDate(aroundDate);
      if (!parsed) return { ok: false, error: "around_date_invalid" };
      if (parsed.getTime() > today.getTime())
        return { ok: false, error: "around_date_future" };
      if (parsed.getTime() < onsetDate.getTime())
        return { ok: false, error: "start_before_onset" };
      return { ok: true, value: { startedOn: parsed, startedPrecision: "approx" } };
    }
    case "unsure":
      return { ok: true, value: { startedOn: null, startedPrecision: null } };
    default:
      return { ok: false, error: "unknown_choice" };
  }
}

export type TreatmentFields = {
  name: string;
  startedOn: Date | null;
  startedPrecision: OnsetPrecision | null;
  helped: string;
  note: string | null;
};

/** Map a full treatment submission to the fields Prisma stores. */
export function buildTreatmentFields(
  input: TreatmentInput,
  onsetDate: Date,
  onsetPrecision: OnsetPrecision,
  today: Date = todayUtc(),
): { ok: true; value: TreatmentFields } | { ok: false; error: TreatmentStartError } {
  const start = deriveTreatmentStart(
    input.start_choice,
    input.start_around_date,
    onsetDate,
    onsetPrecision,
    today,
  );
  if (!start.ok) return { ok: false, error: start.error };
  return {
    ok: true,
    value: {
      name: input.name,
      startedOn: start.value.startedOn,
      startedPrecision: start.value.startedPrecision,
      helped: input.helped,
      note: input.note ?? null,
    },
  };
}
