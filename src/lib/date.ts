// All "today" math is done in UTC so the server clock is deterministic
// and tests do not depend on a machine's local timezone.

/** Today at UTC midnight, as a Date. */
export function todayUtc(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Add (or subtract) whole days to a UTC date. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Format a Date as an ISO calendar date, e.g. "2026-09-10". */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse an ISO calendar date string into a UTC Date, or null if invalid. */
export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Guard against roll-over like 2026-02-31 becoming March.
  if (toIsoDate(d) !== value) return null;
  return d;
}

/** Whole days between two UTC dates (end - start). */
export function daysBetween(start: Date, end: Date): number {
  const ms = todayUtc(end).getTime() - todayUtc(start).getTime();
  return Math.round(ms / 86_400_000);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Human date like "Sep 10, 2026". */
export function formatExact(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** Human month + day like "Sep 10". */
export function formatMonthDay(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}
