import { formatExact, formatMonthDay, parseIsoDate } from "./date";
import type { FlareDTO } from "./serialize";

// Approximate onsets render as hedged text so the record never claims a
// precision the user did not give.
export function onsetText(flare: Pick<FlareDTO, "onsetDate" | "onsetPrecision">): string {
  const date = parseIsoDate(flare.onsetDate);
  if (!date) return "Onset unknown";
  if (flare.onsetPrecision === "exact") return `Started ${formatExact(date)}`;
  return `Started around ${formatMonthDay(date)}`;
}

export function durationText(days: number | null): string | null {
  if (days == null) return null;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function statusText(status: string): string {
  return status === "open" ? "Open" : "Closed";
}
