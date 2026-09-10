import { describe, expect, it } from "vitest";
import { deriveOnset } from "@/lib/onset";
import { toIsoDate } from "@/lib/date";

const today = new Date(Date.UTC(2026, 8, 10)); // 2026-09-10

describe("deriveOnset", () => {
  it("maps today to an exact onset of the server date", () => {
    const r = deriveOnset("today", undefined, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.onsetPrecision).toBe("exact");
      expect(toIsoDate(r.value.onsetDate)).toBe("2026-09-10");
    }
  });

  it("maps a few days ago to approx, three days back", () => {
    const r = deriveOnset("few_days_ago", undefined, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.onsetPrecision).toBe("approx");
      expect(toIsoDate(r.value.onsetDate)).toBe("2026-09-07");
    }
  });

  it("maps around_date to approx with the given date", () => {
    const r = deriveOnset("around_date", "2026-06-01", today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.onsetPrecision).toBe("approx");
      expect(toIsoDate(r.value.onsetDate)).toBe("2026-06-01");
    }
  });

  it("rejects a missing around_date", () => {
    expect(deriveOnset("around_date", undefined, today).ok).toBe(false);
  });

  it("rejects an unparseable around_date", () => {
    expect(deriveOnset("around_date", "2026-13-40", today).ok).toBe(false);
    expect(deriveOnset("around_date", "nope", today).ok).toBe(false);
  });

  it("rejects a future around_date", () => {
    expect(deriveOnset("around_date", "2026-09-11", today).ok).toBe(false);
  });

  it("rejects an around_date more than 730 days back", () => {
    expect(deriveOnset("around_date", "2024-01-01", today).ok).toBe(false);
  });

  it("rejects an unknown choice", () => {
    // @ts-expect-error exercising the runtime guard
    expect(deriveOnset("whenever", undefined, today).ok).toBe(false);
  });
});
