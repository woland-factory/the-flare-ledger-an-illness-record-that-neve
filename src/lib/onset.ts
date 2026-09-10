import { addDays, parseIsoDate, todayUtc } from "./date";

export type OnsetChoice = "today" | "few_days_ago" | "around_date";
export type OnsetPrecision = "exact" | "approx";

// "A few days ago" anchors to three days back. This is a documented
// default shown to the user as hedged text, never as a hard date.
export const FEW_DAYS_ANCHOR = 3;

// A flare onset further back than this is almost certainly a typo.
export const MAX_ONSET_DAYS_BACK = 730;

export type OnsetResult = { onsetDate: Date; onsetPrecision: OnsetPrecision };

export type OnsetError =
  | "unknown_choice"
  | "around_date_required"
  | "around_date_invalid"
  | "around_date_future"
  | "around_date_too_old";

/**
 * Derive the stored onset from the user's choice. The server owns this math;
 * the client never sends a computed date for the fuzzy options.
 */
export function deriveOnset(
  choice: OnsetChoice,
  aroundDate: string | undefined,
  today: Date = todayUtc(),
): { ok: true; value: OnsetResult } | { ok: false; error: OnsetError } {
  switch (choice) {
    case "today":
      return { ok: true, value: { onsetDate: today, onsetPrecision: "exact" } };
    case "few_days_ago":
      return {
        ok: true,
        value: { onsetDate: addDays(today, -FEW_DAYS_ANCHOR), onsetPrecision: "approx" },
      };
    case "around_date": {
      if (!aroundDate) return { ok: false, error: "around_date_required" };
      const parsed = parseIsoDate(aroundDate);
      if (!parsed) return { ok: false, error: "around_date_invalid" };
      if (parsed.getTime() > today.getTime())
        return { ok: false, error: "around_date_future" };
      if (parsed.getTime() < addDays(today, -MAX_ONSET_DAYS_BACK).getTime())
        return { ok: false, error: "around_date_too_old" };
      return { ok: true, value: { onsetDate: parsed, onsetPrecision: "approx" } };
    }
    default:
      return { ok: false, error: "unknown_choice" };
  }
}
