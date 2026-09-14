import { describe, expect, it } from "vitest";
import { serializeFlare } from "@/lib/serialize";
import type { Flare, Treatment } from "@prisma/client";

function flare(overrides: Partial<Flare>): Flare {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    userId: "u",
    status: "open",
    onsetDate: new Date("2026-03-01T00:00:00Z"),
    onsetPrecision: "exact",
    endDate: null,
    endPrecision: null,
    peakSeverity: null,
    impactNote: null,
    symptomNote: null,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    updatedAt: new Date("2026-03-01T00:00:00Z"),
    ...overrides,
  } as Flare;
}

function treatment(overrides: Partial<Treatment>): Treatment {
  return {
    id: "t",
    flareId: "00000000-0000-0000-0000-000000000000",
    name: "Naproxen",
    startedOn: null,
    startedPrecision: null,
    helped: "unsure",
    note: null,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    ...overrides,
  } as Treatment;
}

describe("serializeFlare", () => {
  it("reports no duration for an open flare", () => {
    expect(serializeFlare(flare({})).durationDays).toBeNull();
  });

  it("counts duration inclusively for a closed flare", () => {
    const dto = serializeFlare(
      flare({
        status: "closed",
        onsetDate: new Date("2026-03-01T00:00:00Z"),
        endDate: new Date("2026-03-06T00:00:00Z"),
        endPrecision: "exact",
      }),
    );
    expect(dto.durationDays).toBe(6);
    expect(dto.onsetDate).toBe("2026-03-01");
    expect(dto.endDate).toBe("2026-03-06");
  });

  it("omits treatments unless the flare was loaded with them", () => {
    expect(serializeFlare(flare({})).treatments).toBeUndefined();
  });

  it("orders treatments by start date with unrecorded starts last", () => {
    const withTreatments = Object.assign(flare({}), {
      treatments: [
        treatment({ id: "late", startedOn: new Date("2026-03-05T00:00:00Z") }),
        treatment({ id: "unknown", startedOn: null }),
        treatment({ id: "early", startedOn: new Date("2026-03-01T00:00:00Z") }),
      ],
    });
    const dto = serializeFlare(withTreatments);
    expect(dto.treatments!.map((t) => t.id)).toEqual(["early", "late", "unknown"]);
  });

  it("carries the note fields", () => {
    const dto = serializeFlare(flare({ impactNote: "sore", symptomNote: "swelling" }));
    expect(dto.impactNote).toBe("sore");
    expect(dto.symptomNote).toBe("swelling");
  });
});
