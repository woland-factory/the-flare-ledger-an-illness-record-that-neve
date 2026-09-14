import { describe, expect, it } from "vitest";
import { flaresToCsv } from "@/lib/csv";
import type { FlareDTO, TreatmentDTO } from "@/lib/serialize";

function flare(overrides: Partial<FlareDTO> = {}): FlareDTO {
  return {
    id: "f1",
    status: "closed",
    onsetDate: "2026-03-01",
    onsetPrecision: "exact",
    endDate: "2026-03-06",
    endPrecision: "exact",
    peakSeverity: 4,
    impactNote: null,
    symptomNote: null,
    durationDays: 6,
    createdAt: "2026-03-01T00:00:00.000Z",
    treatments: [],
    ...overrides,
  };
}

function treatment(overrides: Partial<TreatmentDTO> = {}): TreatmentDTO {
  return {
    id: "t1",
    name: "Naproxen",
    startedOn: "2026-03-01",
    startedPrecision: "exact",
    helped: "yes",
    note: null,
    ...overrides,
  };
}

const HEADER =
  "onset_date,onset_precision,end_date,end_precision,duration_days,peak_severity,status,impact_note,symptom_note,treatment_name,treatment_started_on,treatment_started_precision,treatment_helped,treatment_note";

describe("flaresToCsv", () => {
  it("emits the header in the contract order", () => {
    const lines = flaresToCsv([]).split("\r\n");
    expect(lines[0]).toBe(HEADER);
    expect(lines).toHaveLength(1);
  });

  it("writes one row per treatment", () => {
    const csv = flaresToCsv([
      flare({ treatments: [treatment({ id: "a", name: "Naproxen" }), treatment({ id: "b", name: "Rest" })] }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // header + two treatments
    expect(lines[1]).toContain("Naproxen");
    expect(lines[2]).toContain("Rest");
  });

  it("writes one row with empty treatment columns for a treatment-less flare", () => {
    const csv = flaresToCsv([flare({ treatments: [] })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    // Nine flare columns filled, five treatment columns empty at the tail.
    expect(lines[1].endsWith(",,,,,")).toBe(true);
  });

  it("joins rows with CRLF", () => {
    const csv = flaresToCsv([flare()]);
    expect(csv).toContain("\r\n");
  });

  it("RFC-4180 quotes commas, quotes, and newlines and doubles inner quotes", () => {
    const csv = flaresToCsv([
      flare({
        treatments: [treatment({ note: 'has, comma "and" quote\nand newline' })],
      }),
    ]);
    expect(csv).toContain('"has, comma ""and"" quote\nand newline"');
  });

  it("neutralizes fields that would run as spreadsheet formulas", () => {
    for (const lead of ["=", "+", "-", "@"]) {
      const csv = flaresToCsv([
        flare({ treatments: [treatment({ name: `${lead}SUM(A1)` })] }),
      ]);
      expect(csv).toContain(`'${lead}SUM(A1)`);
    }
  });

  it("neutralizes and then quotes a formula field that also has a comma", () => {
    const csv = flaresToCsv([
      flare({ treatments: [treatment({ note: "=1,2" })] }),
    ]);
    expect(csv).toContain('"\'=1,2"');
  });
});
