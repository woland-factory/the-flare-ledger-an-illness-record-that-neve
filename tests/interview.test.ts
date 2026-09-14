import { describe, expect, it } from "vitest";
import { addDays, toIsoDate, todayUtc } from "@/lib/date";
import { deriveEnd, deriveTreatmentStart } from "@/lib/interview";
import { durationTextFor, endText } from "@/lib/display";

const today = todayUtc(new Date("2026-09-14T12:00:00Z"));
const onset = addDays(today, -10);

describe("deriveEnd", () => {
  it("maps today to an exact end on the server date", () => {
    const r = deriveEnd("today", undefined, onset, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(toIsoDate(r.value.endDate)).toBe(toIsoDate(today));
      expect(r.value.endPrecision).toBe("exact");
    }
  });

  it("maps a few days ago to approx, three days back", () => {
    const r = deriveEnd("few_days_ago", undefined, onset, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(toIsoDate(r.value.endDate)).toBe(toIsoDate(addDays(today, -3)));
      expect(r.value.endPrecision).toBe("approx");
    }
  });

  it("maps around a date to approx on the picked date", () => {
    const picked = toIsoDate(addDays(today, -2));
    const r = deriveEnd("around_date", picked, onset, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(toIsoDate(r.value.endDate)).toBe(picked);
      expect(r.value.endPrecision).toBe("approx");
    }
  });

  it("rejects an end before onset", () => {
    // Onset today, "a few days ago" would land three days before onset.
    const r = deriveEnd("few_days_ago", undefined, today, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("end_before_onset");
  });

  it("rejects a future around date", () => {
    const r = deriveEnd("around_date", toIsoDate(addDays(today, 1)), onset, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("around_date_future");
  });

  it("rejects an unknown choice", () => {
    // @ts-expect-error deliberately invalid choice
    const r = deriveEnd("whenever", undefined, onset, today);
    expect(r.ok).toBe(false);
  });

  it("rejects an end more than 730 days after onset", () => {
    const oldOnset = addDays(today, -800);
    const r = deriveEnd("today", undefined, oldOnset, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("end_too_far");
  });
});

describe("deriveTreatmentStart", () => {
  it("inherits onset date and precision for flare_onset", () => {
    const r = deriveTreatmentStart("flare_onset", undefined, onset, "approx", today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(toIsoDate(r.value.startedOn!)).toBe(toIsoDate(onset));
      expect(r.value.startedPrecision).toBe("approx");
    }
  });

  it("maps few_days_in to onset plus three, approx", () => {
    const r = deriveTreatmentStart("few_days_in", undefined, onset, "exact", today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(toIsoDate(r.value.startedOn!)).toBe(toIsoDate(addDays(onset, 3)));
      expect(r.value.startedPrecision).toBe("approx");
    }
  });

  it("stores unsure as absence", () => {
    const r = deriveTreatmentStart("unsure", undefined, onset, "exact", today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.startedOn).toBeNull();
      expect(r.value.startedPrecision).toBeNull();
    }
  });

  it("rejects an around date before onset", () => {
    const r = deriveTreatmentStart(
      "around_date",
      toIsoDate(addDays(onset, -1)),
      onset,
      "exact",
      today,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("start_before_onset");
  });
});

describe("durationTextFor and endText", () => {
  const base = { onsetPrecision: "exact", endPrecision: "exact", durationDays: 6 };

  it("reads N days when both bounds are exact", () => {
    expect(durationTextFor(base)).toBe("6 days");
  });

  it("hedges to about N days when the end is approx", () => {
    expect(durationTextFor({ ...base, endPrecision: "approx" })).toBe("about 6 days");
  });

  it("hedges to about N days when the onset is approx", () => {
    expect(durationTextFor({ ...base, onsetPrecision: "approx" })).toBe("about 6 days");
  });

  it("returns null when there is no duration", () => {
    expect(durationTextFor({ ...base, durationDays: null })).toBeNull();
  });

  it("renders end exactly or hedged", () => {
    expect(endText({ endDate: "2026-09-10", endPrecision: "exact" })).toBe("Ended Sep 10, 2026");
    expect(endText({ endDate: "2026-09-10", endPrecision: "approx" })).toBe("Ended around Sep 10");
    expect(endText({ endDate: null, endPrecision: null })).toBeNull();
  });
});
