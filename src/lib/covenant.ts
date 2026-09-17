import { daysBetween } from "./date";

// The covenant nudge is the one exception to "never ask on a schedule": a
// flare left open long past its likely end quietly corrupts the record. This
// module decides, from stored data alone, which single open flare (if any) to
// surface on a given visit. It holds no clock: the caller passes `today`, so
// the rule is deterministic and testable end to end.

// A flare must be open more than this many days before it is ever surfaced.
// Two weeks catches a forgotten short flare without pestering a genuinely long
// one, and the once-and-dismissible design keeps an early ask harmless.
export const QUIET_DAYS = 14;

export type NudgeCandidate = {
  id: string;
  onsetDate: Date; // the flare's stored onset (UTC date)
  status: string; // "open" | "closed"
  nudgedAt: Date | null;
};

// Returns the single flare to nudge on this visit, or null. Among the caller's
// open, never-nudged flares whose onset is more than QUIET_DAYS days before
// `today`, pick the one open longest (smallest onsetDate); break ties by id
// ascending for determinism.
export function selectCovenantNudge(
  flares: NudgeCandidate[],
  today: Date,
): NudgeCandidate | null {
  const eligible = flares.filter(
    (f) =>
      f.status === "open" &&
      f.nudgedAt === null &&
      daysBetween(f.onsetDate, today) > QUIET_DAYS,
  );
  if (eligible.length === 0) return null;

  return eligible.reduce((best, f) => {
    const byOnset = f.onsetDate.getTime() - best.onsetDate.getTime();
    if (byOnset < 0) return f;
    if (byOnset === 0 && f.id < best.id) return f;
    return best;
  });
}
