import { formatExact, formatMonthDay, parseIsoDate } from "./date";
import type { FlareDTO, TreatmentDTO } from "./serialize";

// Approximate onsets render as hedged text so the record never claims a
// precision the user did not give.
export function onsetText(flare: Pick<FlareDTO, "onsetDate" | "onsetPrecision">): string {
  const date = parseIsoDate(flare.onsetDate);
  if (!date) return "Onset unknown";
  if (flare.onsetPrecision === "exact") return `Started ${formatExact(date)}`;
  return `Started around ${formatMonthDay(date)}`;
}

// End reads exact ("Ended Sep 10, 2026") or hedged ("Ended around Sep 10"),
// and is null while the flare is still open.
export function endText(
  flare: Pick<FlareDTO, "endDate" | "endPrecision">,
): string | null {
  if (!flare.endDate) return null;
  const date = parseIsoDate(flare.endDate);
  if (!date) return null;
  if (flare.endPrecision === "exact") return `Ended ${formatExact(date)}`;
  return `Ended around ${formatMonthDay(date)}`;
}

export function durationText(days: number | null): string | null {
  if (days == null) return null;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

// Duration hedges to "about N days" whenever either bound is approximate, and
// reads plainly only when both onset and end are exact. This keeps a headline
// built from the ledger honest about its own certainty.
export function durationTextFor(
  flare: Pick<FlareDTO, "onsetPrecision" | "endPrecision" | "durationDays">,
): string | null {
  const base = durationText(flare.durationDays);
  if (base == null) return null;
  const approx =
    flare.onsetPrecision === "approx" || flare.endPrecision === "approx";
  return approx ? `about ${base}` : base;
}

// Treatment start renders from the stored precision and date, never inventing
// a day the user did not give.
export function treatmentStartText(
  t: Pick<TreatmentDTO, "startedOn" | "startedPrecision">,
): string {
  if (!t.startedOn || !t.startedPrecision) return "Start not recorded";
  const date = parseIsoDate(t.startedOn);
  if (!date) return "Start not recorded";
  if (t.startedPrecision === "exact") return `Started ${formatMonthDay(date)}`;
  return `Started around ${formatMonthDay(date)}`;
}

export function helpedText(helped: string | null): string {
  if (helped === "yes") return "Helped";
  if (helped === "no") return "Didn't help";
  return "Not sure";
}

// Severity is one value with a word anchor, never a graph. Null means the user
// answered "not sure".
export function severityText(peakSeverity: number | null): string {
  if (peakSeverity == null) return "Severity not recorded";
  return `Peak severity ${peakSeverity} of 5`;
}

export function statusText(status: string): string {
  return status === "open" ? "Open" : "Closed";
}

// A compact, scannable summary of a flare's treatments for a ledger row. Names
// only, treatments that helped first, up to three shown with a "+N more" tail.
// Returns null for an empty list so the row simply omits the line.
export function keyTreatmentsText(treatments: TreatmentDTO[]): string | null {
  if (treatments.length === 0) return null;
  const helpedFirst = [
    ...treatments.filter((t) => t.helped === "yes"),
    ...treatments.filter((t) => t.helped !== "yes"),
  ];
  const names = helpedFirst.map((t) => t.name);
  const shown = names.slice(0, 3);
  const remaining = names.length - shown.length;
  const base = shown.join(", ");
  return remaining > 0 ? `${base} +${remaining} more` : base;
}
