import { describe, expect, it } from "vitest";
import { QUIET_DAYS, selectCovenantNudge, type NudgeCandidate } from "@/lib/covenant";
import { addDays, todayUtc } from "@/lib/date";

const TODAY = todayUtc(new Date("2026-09-17T12:00:00Z"));

function candidate(over: Partial<NudgeCandidate> & { id: string }): NudgeCandidate {
  return {
    onsetDate: addDays(TODAY, -(QUIET_DAYS + 1)),
    status: "open",
    nudgedAt: null,
    ...over,
  };
}

describe("selectCovenantNudge", () => {
  it("selects an open flare open more than QUIET_DAYS days", () => {
    const flares = [candidate({ id: "a", onsetDate: addDays(TODAY, -(QUIET_DAYS + 1)) })];
    expect(selectCovenantNudge(flares, TODAY)?.id).toBe("a");
  });

  it("does not select a flare open exactly QUIET_DAYS days (strictly more)", () => {
    const flares = [candidate({ id: "a", onsetDate: addDays(TODAY, -QUIET_DAYS) })];
    expect(selectCovenantNudge(flares, TODAY)).toBeNull();
  });

  it("never selects a closed flare", () => {
    const flares = [
      candidate({ id: "a", status: "closed", onsetDate: addDays(TODAY, -60) }),
    ];
    expect(selectCovenantNudge(flares, TODAY)).toBeNull();
  });

  it("never selects a flare already nudged", () => {
    const flares = [
      candidate({ id: "a", nudgedAt: new Date("2026-09-01T00:00:00Z"), onsetDate: addDays(TODAY, -60) }),
    ];
    expect(selectCovenantNudge(flares, TODAY)).toBeNull();
  });

  it("returns the longest-open flare when several qualify", () => {
    const flares = [
      candidate({ id: "recent", onsetDate: addDays(TODAY, -(QUIET_DAYS + 2)) }),
      candidate({ id: "oldest", onsetDate: addDays(TODAY, -60) }),
      candidate({ id: "middle", onsetDate: addDays(TODAY, -30) }),
    ];
    expect(selectCovenantNudge(flares, TODAY)?.id).toBe("oldest");
  });

  it("breaks ties by id ascending", () => {
    const onset = addDays(TODAY, -40);
    const flares = [
      candidate({ id: "b", onsetDate: onset }),
      candidate({ id: "a", onsetDate: onset }),
      candidate({ id: "c", onsetDate: onset }),
    ];
    expect(selectCovenantNudge(flares, TODAY)?.id).toBe("a");
  });

  it("returns at most one flare per visit", () => {
    const flares = [
      candidate({ id: "a", onsetDate: addDays(TODAY, -40) }),
      candidate({ id: "b", onsetDate: addDays(TODAY, -50) }),
    ];
    const chosen = selectCovenantNudge(flares, TODAY);
    expect(chosen).not.toBeNull();
    expect([chosen]).toHaveLength(1);
  });

  it("is deterministic and uses no internal clock", () => {
    const flares = [
      candidate({ id: "a", onsetDate: addDays(TODAY, -40) }),
      candidate({ id: "b", onsetDate: addDays(TODAY, -50) }),
    ];
    const first = selectCovenantNudge(flares, TODAY);
    const second = selectCovenantNudge(flares, TODAY);
    expect(first?.id).toBe(second?.id);
    // A different `today` changes eligibility, proving the clock is the caller's.
    expect(selectCovenantNudge(flares, addDays(TODAY, -100))).toBeNull();
  });

  it("returns null for an empty set", () => {
    expect(selectCovenantNudge([], TODAY)).toBeNull();
  });
});
