import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addDays, todayUtc } from "@/lib/date";
import { buildExportPayload, loadUserFlares } from "@/lib/export";
import type { FlareDTO } from "@/lib/serialize";

describe("buildExportPayload", () => {
  it("wraps flares in the versioned document shape", () => {
    const flares = [{ id: "f1" } as FlareDTO];
    const payload = buildExportPayload(
      { email: "a@b.com", conditionLabel: "arthritis" },
      flares,
      "2026-09-14T10:00:00.000Z",
    );
    expect(payload.version).toBe(1);
    expect(payload.exportedAt).toBe("2026-09-14T10:00:00.000Z");
    expect(payload.account).toEqual({ email: "a@b.com", conditionLabel: "arthritis" });
    expect(payload.flares).toBe(flares);
  });
});

describe("loadUserFlares", () => {
  it("returns only the target user's flares, oldest-first by onset, with treatments", async () => {
    const today = todayUtc();
    const a = await prisma.user.create({ data: { email: "a@example.com", passwordHash: "x" } });
    const b = await prisma.user.create({ data: { email: "b@example.com", passwordHash: "x" } });

    // User A: two flares, created out of onset order to prove the sort.
    const recent = await prisma.flare.create({
      data: {
        userId: a.id,
        status: "closed",
        onsetDate: addDays(today, -10),
        onsetPrecision: "exact",
        endDate: addDays(today, -8),
        endPrecision: "exact",
        peakSeverity: 3,
      },
    });
    await prisma.treatment.create({
      data: { flareId: recent.id, name: "Naproxen", helped: "yes" },
    });
    await prisma.flare.create({
      data: {
        userId: a.id,
        status: "closed",
        onsetDate: addDays(today, -40),
        onsetPrecision: "approx",
        endDate: addDays(today, -35),
        endPrecision: "approx",
      },
    });

    // User B: one flare that must never surface for A.
    await prisma.flare.create({
      data: { userId: b.id, status: "open", onsetDate: today, onsetPrecision: "exact" },
    });

    const flares = await loadUserFlares(a.id);
    expect(flares).toHaveLength(2);
    // Oldest onset first.
    expect(flares[0].onsetDate < flares[1].onsetDate).toBe(true);
    expect(flares[1].treatments?.[0]?.name).toBe("Naproxen");
    // None of user B's data.
    expect(flares.every((f) => f.status === "closed")).toBe(true);
  });
});
