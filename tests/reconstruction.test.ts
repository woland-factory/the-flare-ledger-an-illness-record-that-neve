import { describe, expect, it } from "vitest";
import { addDays, parseIsoDate, toIsoDate } from "@/lib/date";
import {
  applyCorrection,
  buildDraftSnapshot,
  coverageText,
  draftNote,
  flareRangeText,
  headlineText,
  snapshotSchema,
  treatmentLineText,
  type DraftFlareRow,
  type Snapshot,
  type SnapshotFlare,
} from "@/lib/reconstruction";

// A fixed clock so every assertion is byte-stable across runs and machines.
const TODAY = parseIsoDate("2026-09-15")!;

let seq = 0;
function makeFlare(overrides: Partial<DraftFlareRow>): DraftFlareRow {
  seq += 1;
  return {
    id: `00000000-0000-0000-0000-${String(seq).padStart(12, "0")}`,
    onsetDate: addDays(TODAY, -10),
    onsetPrecision: "exact",
    endDate: null,
    endPrecision: null,
    peakSeverity: null,
    impactNote: null,
    symptomNote: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)),
    treatments: [],
    ...overrides,
  };
}

// Mirrors the demo seed: a 12-day approx flare with Naproxen on day six, a
// 6-day exact flare with Naproxen on day one, and an open flare.
function demoRows(): DraftFlareRow[] {
  const long = makeFlare({
    onsetDate: addDays(TODAY, -150),
    onsetPrecision: "approx",
    endDate: addDays(TODAY, -139),
    endPrecision: "approx",
    peakSeverity: 4,
    treatments: [
      {
        name: "Naproxen",
        startedOn: addDays(TODAY, -145),
        startedPrecision: "approx",
        helped: "unsure",
        createdAt: new Date(Date.UTC(2026, 0, 2)),
      },
      {
        name: "Rest",
        startedOn: addDays(TODAY, -150),
        startedPrecision: "approx",
        helped: "yes",
        createdAt: new Date(Date.UTC(2026, 0, 3)),
      },
    ],
  });
  const short = makeFlare({
    onsetDate: addDays(TODAY, -80),
    onsetPrecision: "exact",
    endDate: addDays(TODAY, -75),
    endPrecision: "exact",
    peakSeverity: 3,
    treatments: [
      {
        name: "Naproxen",
        startedOn: addDays(TODAY, -80),
        startedPrecision: "exact",
        helped: "yes",
        createdAt: new Date(Date.UTC(2026, 0, 4)),
      },
    ],
  });
  const open = makeFlare({
    onsetDate: addDays(TODAY, -3),
    onsetPrecision: "approx",
  });
  return [long, short, open];
}

function snapFlare(overrides: Partial<SnapshotFlare>): SnapshotFlare {
  seq += 1;
  return {
    key: `k-${seq}`,
    source: "drafted",
    onsetDate: "2026-09-01",
    onsetPrecision: "exact",
    endDate: null,
    endPrecision: null,
    peakSeverity: null,
    note: null,
    treatments: [],
    ...overrides,
  };
}

function snap(flares: SnapshotFlare[], rangeStart: string | null = null): Snapshot {
  return { version: 1, rangeStart, truncated: false, flares };
}

// A closed pair sharing a treatment: A starts it on day one, B starts it
// late. Durations pick the contrast band.
function contrastPair(durA: number, durB: number, name = "Naproxen"): SnapshotFlare[] {
  const a = snapFlare({
    onsetDate: "2026-01-01",
    endDate: toIsoDate(addDays(parseIsoDate("2026-01-01")!, durA - 1)),
    endPrecision: "exact",
    treatments: [
      { name, startedOn: "2026-01-01", startedPrecision: "exact", helped: "yes" },
    ],
  });
  const b = snapFlare({
    onsetDate: "2026-03-01",
    endDate: toIsoDate(addDays(parseIsoDate("2026-03-01")!, durB - 1)),
    endPrecision: "exact",
    treatments: [
      { name, startedOn: "2026-03-03", startedPrecision: "exact", helped: "unsure" },
    ],
  });
  return [a, b];
}

describe("buildDraftSnapshot", () => {
  it("drafts all recorded flares when rangeStart is null", () => {
    const snapshot = buildDraftSnapshot(demoRows(), null);
    expect(snapshot.rangeStart).toBeNull();
    expect(snapshot.truncated).toBe(false);
    expect(snapshot.flares).toHaveLength(3);
    expect(snapshot.flares.every((f) => f.source === "drafted")).toBe(true);
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("includes exactly the open and end-on-or-after-rangeStart flares", () => {
    const endedBefore = makeFlare({
      onsetDate: addDays(TODAY, -60),
      endDate: addDays(TODAY, -50),
      endPrecision: "exact",
    });
    const endedAfter = makeFlare({
      onsetDate: addDays(TODAY, -40),
      endDate: addDays(TODAY, -20),
      endPrecision: "exact",
    });
    const endedOn = makeFlare({
      onsetDate: addDays(TODAY, -35),
      endDate: addDays(TODAY, -30),
      endPrecision: "exact",
    });
    const open = makeFlare({ onsetDate: addDays(TODAY, -5) });
    const rangeStart = toIsoDate(addDays(TODAY, -30));
    const snapshot = buildDraftSnapshot(
      [endedBefore, endedAfter, endedOn, open],
      rangeStart,
    );
    expect(snapshot.flares.map((f) => f.key)).toEqual([
      endedAfter.id,
      endedOn.id,
      open.id,
    ]);
    expect(snapshot.rangeStart).toBe(rangeStart);
  });

  it("orders onset ascending and caps at 50 keeping the newest onsets", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      makeFlare({
        onsetDate: addDays(TODAY, -400 + i * 5),
        endDate: addDays(TODAY, -398 + i * 5),
        endPrecision: "exact",
      }),
    );
    const snapshot = buildDraftSnapshot(rows, null);
    expect(snapshot.truncated).toBe(true);
    expect(snapshot.flares).toHaveLength(50);
    // The ten oldest onsets are dropped; order stays ascending.
    expect(snapshot.flares[0].key).toBe(rows[10].id);
    const onsets = snapshot.flares.map((f) => f.onsetDate);
    expect([...onsets].sort()).toEqual(onsets);
  });

  it("copies dates, precisions, severity, and ordered treatments", () => {
    const snapshot = buildDraftSnapshot(demoRows(), null);
    const long = snapshot.flares[0];
    expect(long.onsetDate).toBe(toIsoDate(addDays(TODAY, -150)));
    expect(long.onsetPrecision).toBe("approx");
    expect(long.endDate).toBe(toIsoDate(addDays(TODAY, -139)));
    expect(long.peakSeverity).toBe(4);
    // Start-ascending: Rest (day one) before Naproxen (day six).
    expect(long.treatments.map((t) => t.name)).toEqual(["Rest", "Naproxen"]);
    const open = snapshot.flares[2];
    expect(open.endDate).toBeNull();
    expect(open.endPrecision).toBeNull();
  });

  it("joins the interview notes and truncates on a word boundary", () => {
    expect(draftNote(null, null)).toBeNull();
    expect(draftNote("  ", "")).toBeNull();
    expect(draftNote("Missed work.", null)).toBe("Missed work.");
    expect(draftNote("Missed work.", "Knees swollen.")).toBe(
      "Missed work. Knees swollen.",
    );
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const cut = draftNote(words, null)!;
    expect(cut.length).toBeLessThanOrEqual(300);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toContain("  ");
    // The cut lands between words, never inside one.
    const beforeEllipsis = cut.slice(0, -1);
    expect(words.startsWith(beforeEllipsis)).toBe(true);
    expect(words[beforeEllipsis.length]).toBe(" ");
  });

  it("is byte-deterministic across runs", () => {
    const a = JSON.stringify(buildDraftSnapshot(demoRows(), null));
    seq -= 3; // rebuild the same fixture with the same ids
    const b = JSON.stringify(buildDraftSnapshot(demoRows(), null));
    expect(a).toBe(b);
  });
});

describe("headlineText", () => {
  it("yields the signature headline for the demo-shaped record", () => {
    const snapshot = buildDraftSnapshot(demoRows(), null);
    expect(headlineText(snapshot, TODAY)).toBe(
      "3 flares recorded. Longest about 12 days. Naproxen started on day one, that flare was about half as long.",
    );
    // Deterministic: the same snapshot renders the same headline.
    expect(headlineText(snapshot, TODAY)).toBe(headlineText(snapshot, TODAY));
  });

  it("renders since-month variants with the year only when it differs", () => {
    const one = [snapFlare({ onsetDate: "2026-09-01" })];
    expect(headlineText(snap(one, "2026-03-10"), TODAY)).toBe("1 flare since March.");
    expect(headlineText(snap(one, "2025-03-10"), TODAY)).toBe(
      "1 flare since March 2025.",
    );
    expect(headlineText(snap(one, null), TODAY)).toBe("1 flare recorded.");
  });

  it("renders the zero-flare quiet stretch with no further sentences", () => {
    expect(headlineText(snap([], "2026-03-10"), TODAY)).toBe(
      "A quiet stretch since March.",
    );
    expect(headlineText(snap([], null), TODAY)).toBe("A quiet stretch so far.");
  });

  it("hedges the longest sentence iff a bound is approx", () => {
    const exact = snapFlare({
      onsetDate: "2026-08-01",
      endDate: "2026-08-12",
      endPrecision: "exact",
    });
    const approx = snapFlare({
      onsetDate: "2026-07-01",
      onsetPrecision: "approx",
      endDate: "2026-07-03",
      endPrecision: "approx",
    });
    expect(headlineText(snap([exact, approx]), TODAY)).toBe(
      "2 flares recorded. Longest 12 days.",
    );
    // One closed flare reads "It lasted", hedged when approx.
    expect(headlineText(snap([approx]), TODAY)).toBe(
      "1 flare recorded. It lasted about 3 days.",
    );
    const oneDay = snapFlare({
      onsetDate: "2026-08-01",
      endDate: "2026-08-01",
      endPrecision: "exact",
    });
    expect(headlineText(snap([oneDay]), TODAY)).toBe(
      "1 flare recorded. It lasted 1 day.",
    );
  });

  it("omits the longest sentence when no flare is closed", () => {
    expect(headlineText(snap([snapFlare({})]), TODAY)).toBe("1 flare recorded.");
  });

  it("switches the contrast bands at 0.30, 0.60, and 0.85", () => {
    const line = (durA: number, durB: number) => {
      const s = headlineText(snap(contrastPair(durA, durB)), TODAY);
      const parts = s.split(". ");
      return parts.length >= 3 ? `${parts.slice(2).join(". ")}` : null;
    };
    expect(line(3, 10)).toBe(
      "Naproxen started on day one, that flare was about a third as long.",
    );
    expect(line(6, 10)).toBe(
      "Naproxen started on day one, that flare was about half as long.",
    );
    expect(line(17, 20)).toBe(
      "Naproxen started on day one, that flare was noticeably shorter.",
    );
    expect(line(18, 20)).toBeNull();
  });

  it("emits no contrast sentence without a qualifying pair", () => {
    // The late start is only one day after onset, so it does not qualify.
    const pair = contrastPair(3, 10);
    pair[1].treatments[0].startedOn = "2026-03-02";
    expect(headlineText(snap(pair), TODAY)).toBe(
      "2 flares recorded. Longest 10 days.",
    );
    // Different treatment names never pair.
    const other = contrastPair(3, 10);
    other[1].treatments[0].name = "Rest";
    expect(headlineText(snap(other), TODAY)).not.toContain("started on day one");
  });

  it("matches treatment names case-insensitively and keeps A's casing", () => {
    const pair = contrastPair(3, 10);
    pair[1].treatments[0].name = "NAPROXEN";
    expect(headlineText(snap(pair), TODAY)).toContain(
      "Naproxen started on day one",
    );
  });
});

describe("coverageText", () => {
  it("counts plainly and reports truncation", () => {
    expect(coverageText(snap([snapFlare({}), snapFlare({}), snapFlare({})]))).toBe(
      "Built from 3 recorded flares, not a daily diary.",
    );
    expect(coverageText(snap([snapFlare({})]))).toBe(
      "Built from 1 recorded flare, not a daily diary.",
    );
    const truncated = { ...snap([snapFlare({})]), truncated: true };
    expect(coverageText(truncated)).toBe(
      "Built from 1 recorded flare, not a daily diary. Showing the newest 50.",
    );
  });
});

describe("flareRangeText", () => {
  it("renders closed ranges with hedges only on approx bounds", () => {
    const exact = snapFlare({
      onsetDate: "2026-09-03",
      endDate: "2026-09-09",
      endPrecision: "exact",
    });
    expect(flareRangeText(exact, TODAY)).toBe("Sep 3 to Sep 9, 7 days.");
    const both = snapFlare({
      onsetDate: "2026-09-03",
      onsetPrecision: "approx",
      endDate: "2026-09-09",
      endPrecision: "approx",
    });
    expect(flareRangeText(both, TODAY)).toBe(
      "Around Sep 3 to around Sep 9, about 7 days.",
    );
    const endOnly = snapFlare({
      onsetDate: "2026-09-03",
      endDate: "2026-09-09",
      endPrecision: "approx",
    });
    expect(flareRangeText(endOnly, TODAY)).toBe(
      "Sep 3 to around Sep 9, about 7 days.",
    );
  });

  it("renders open flares and single days", () => {
    expect(
      flareRangeText(
        snapFlare({ onsetDate: "2026-09-12", onsetPrecision: "approx" }),
        TODAY,
      ),
    ).toBe("Started around Sep 12, still going.");
    expect(flareRangeText(snapFlare({ onsetDate: "2026-09-12" }), TODAY)).toBe(
      "Started Sep 12, still going.",
    );
    const oneDay = snapFlare({
      onsetDate: "2026-09-03",
      endDate: "2026-09-03",
      endPrecision: "exact",
    });
    expect(flareRangeText(oneDay, TODAY)).toBe("Sep 3 to Sep 3, 1 day.");
  });

  it("adds the year when a date is outside this year", () => {
    const lastYear = snapFlare({
      onsetDate: "2025-09-03",
      endDate: "2025-09-09",
      endPrecision: "exact",
    });
    expect(flareRangeText(lastYear, TODAY)).toBe(
      "Sep 3, 2025 to Sep 9, 2025, 7 days.",
    );
  });
});

describe("treatmentLineText", () => {
  const flare = snapFlare({ onsetDate: "2026-09-01" });
  it("names the day and the helped answer", () => {
    expect(
      treatmentLineText(
        { name: "Naproxen", startedOn: "2026-09-01", startedPrecision: "exact", helped: "yes" },
        flare,
      ),
    ).toBe("Naproxen from day one. Helped.");
    expect(
      treatmentLineText(
        { name: "Naproxen", startedOn: "2026-09-03", startedPrecision: "approx", helped: "unsure" },
        flare,
      ),
    ).toBe("Naproxen from about day 3. Not sure.");
    expect(
      treatmentLineText(
        { name: "Rest", startedOn: null, startedPrecision: null, helped: "yes" },
        flare,
      ),
    ).toBe("Rest, start not recorded. Helped.");
  });

  it("hedges when the flare onset itself is approx", () => {
    const approxFlare = snapFlare({ onsetDate: "2026-09-01", onsetPrecision: "approx" });
    expect(
      treatmentLineText(
        { name: "Ice", startedOn: "2026-09-02", startedPrecision: "exact", helped: "no" },
        approxFlare,
      ),
    ).toBe("Ice from about day 2. Didn't help.");
  });
});

describe("applyCorrection", () => {
  const base = () =>
    snap([
      snapFlare({
        key: "drafted-1",
        onsetDate: "2026-08-01",
        endDate: "2026-08-05",
        endPrecision: "exact",
        peakSeverity: 3,
        treatments: [
          { name: "Naproxen", startedOn: "2026-08-01", startedPrecision: "exact", helped: "yes" },
        ],
      }),
      snapFlare({ key: "drafted-2", onsetDate: "2026-09-01" }),
    ]);

  it("set_visit validates the date and leaves the snapshot unchanged", () => {
    const ok = applyCorrection(base(), { op: "set_visit", visit_date: "2026-10-01" }, TODAY);
    expect(ok).toEqual({ ok: true, snapshot: base() });
    const bad = applyCorrection(base(), { op: "set_visit", visit_date: "2020-01-01" }, TODAY);
    expect(bad.ok).toBe(false);
    const unparsable = applyCorrection(base(), { op: "set_visit", visit_date: "nope" }, TODAY);
    expect(unparsable.ok).toBe(false);
  });

  it("set_flare merges dates, precision, severity, note, and treatments", () => {
    const r = applyCorrection(
      base(),
      {
        op: "set_flare",
        key: "drafted-1",
        end_date: "2026-08-10",
        end_precision: "approx",
        peak_severity: 5,
        note: "Worst week of the summer.",
        treatments: [
          { name: "Rest", startedOn: null, startedPrecision: null, helped: "unsure" },
        ],
      },
      TODAY,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const f = r.snapshot.flares.find((x) => x.key === "drafted-1")!;
      expect(f.endDate).toBe("2026-08-10");
      expect(f.endPrecision).toBe("approx");
      expect(f.peakSeverity).toBe(5);
      expect(f.note).toBe("Worst week of the summer.");
      expect(f.treatments).toHaveLength(1);
      expect(f.treatments[0].name).toBe("Rest");
    }
  });

  it("set_flare clears the end with null so the flare reads still going", () => {
    const r = applyCorrection(
      base(),
      { op: "set_flare", key: "drafted-1", end_date: null },
      TODAY,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const f = r.snapshot.flares.find((x) => x.key === "drafted-1")!;
      expect(f.endDate).toBeNull();
      expect(f.endPrecision).toBeNull();
    }
  });

  it("set_flare re-sorts when a corrected onset moves the flare", () => {
    const r = applyCorrection(
      base(),
      {
        op: "set_flare",
        key: "drafted-2",
        onset_date: "2026-07-01",
        onset_precision: "approx",
      },
      TODAY,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.snapshot.flares[0].key).toBe("drafted-2");
  });

  it("rejects future dates, end before onset, overlong spans, and bad keys", () => {
    const future = applyCorrection(
      base(),
      { op: "set_flare", key: "drafted-2", onset_date: "2026-09-20", onset_precision: "exact" },
      TODAY,
    );
    expect(future.ok).toBe(false);
    const backwards = applyCorrection(
      base(),
      { op: "set_flare", key: "drafted-1", end_date: "2026-07-01", end_precision: "exact" },
      TODAY,
    );
    expect(backwards.ok).toBe(false);
    const tooLong = applyCorrection(
      base(),
      {
        op: "set_flare",
        key: "drafted-1",
        onset_date: "2024-01-01",
        onset_precision: "exact",
      },
      TODAY,
    );
    // Merged with the stored end, the span passes 730 days.
    expect(tooLong.ok).toBe(false);
    const unknown = applyCorrection(
      base(),
      { op: "set_flare", key: "nope", peak_severity: 2 },
      TODAY,
    );
    expect(unknown.ok).toBe(false);
    const badTreatment = applyCorrection(
      base(),
      {
        op: "set_flare",
        key: "drafted-1",
        treatments: [
          { name: "Ice", startedOn: "2026-07-20", startedPrecision: "exact", helped: null },
        ],
      },
      TODAY,
    );
    // Treatment start before the flare's onset.
    expect(badTreatment.ok).toBe(false);
  });

  it("add_flare inserts sorted with an added source and the given key", () => {
    const r = applyCorrection(
      base(),
      { op: "add_flare", onset_date: "2026-08-15", onset_precision: "approx" },
      TODAY,
      "added-key-1",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.snapshot.flares.map((f) => f.key)).toEqual([
        "drafted-1",
        "added-key-1",
        "drafted-2",
      ]);
      const added = r.snapshot.flares[1];
      expect(added.source).toBe("added");
      expect(added.endDate).toBeNull();
    }
  });

  it("add_flare refuses at the 50-flare cap", () => {
    const full = snap(
      Array.from({ length: 50 }, (_, i) => snapFlare({ key: `f-${i}` })),
    );
    const r = applyCorrection(
      full,
      { op: "add_flare", onset_date: "2026-08-15", onset_precision: "exact" },
      TODAY,
      "added-key-2",
    );
    expect(r).toEqual({
      ok: false,
      error: "This timeline is at its limit of 50 flares.",
    });
  });

  it("remove_flare removes added rows only", () => {
    const withAdded = applyCorrection(
      base(),
      { op: "add_flare", onset_date: "2026-08-15", onset_precision: "exact" },
      TODAY,
      "added-key-3",
    );
    expect(withAdded.ok).toBe(true);
    if (!withAdded.ok) return;
    const removed = applyCorrection(
      withAdded.snapshot,
      { op: "remove_flare", key: "added-key-3" },
      TODAY,
    );
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.snapshot.flares).toHaveLength(2);
    const drafted = applyCorrection(
      base(),
      { op: "remove_flare", key: "drafted-1" },
      TODAY,
    );
    expect(drafted.ok).toBe(false);
    const unknown = applyCorrection(
      base(),
      { op: "remove_flare", key: "ghost" },
      TODAY,
    );
    expect(unknown.ok).toBe(false);
  });
});
