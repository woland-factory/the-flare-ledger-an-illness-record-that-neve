import { describe, expect, it } from "vitest";
import { serializeFlare } from "@/lib/serialize";
import type { Flare } from "@prisma/client";

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
    createdAt: new Date("2026-03-01T00:00:00Z"),
    updatedAt: new Date("2026-03-01T00:00:00Z"),
    ...overrides,
  } as Flare;
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
});
