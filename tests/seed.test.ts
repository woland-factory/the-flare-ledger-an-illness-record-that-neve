import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { DEMO_EMAIL, seedDemo } from "@/lib/seed";

describe("seedDemo", () => {
  it("creates a reconstruction-ready demo history", async () => {
    await seedDemo(prisma);
    const user = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
      include: { flares: { include: { treatments: true } } },
    });
    expect(user).not.toBeNull();
    const flares = user!.flares;
    const closed = flares.filter((f) => f.status === "closed");
    const open = flares.filter((f) => f.status === "open");
    expect(closed.length).toBeGreaterThanOrEqual(2);
    expect(open.length).toBeGreaterThanOrEqual(1);

    // One closed flare has the anti-inflammatory started on day one.
    const dayOne = closed.find((f) =>
      f.treatments.some(
        (t) =>
          t.name.toLowerCase().includes("naproxen") &&
          t.startedOn &&
          t.startedOn.getTime() === f.onsetDate.getTime(),
      ),
    );
    expect(dayOne).toBeTruthy();
  });

  it("is idempotent on repeated runs", async () => {
    await seedDemo(prisma);
    await seedDemo(prisma);
    const users = await prisma.user.count({ where: { email: DEMO_EMAIL } });
    expect(users).toBe(1);
  });
});
