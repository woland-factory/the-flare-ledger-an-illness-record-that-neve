import type { PrismaClient } from "@prisma/client";
import { addDays, todayUtc } from "./date";
import { hashPassword } from "./password";

// Demo credentials are for staging demonstration only. They are documented in
// the README and carry no real person's data.
export const DEMO_EMAIL = "demo@flareledger.app";
export const DEMO_PASSWORD = "flare-demo-2026";

/**
 * Load a small, realistic flare history for the demo user. Idempotent: keyed
 * on the demo email, so it is safe to run on every boot.
 */
export async function seedDemo(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) return;

  const today = todayUtc();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, passwordHash, conditionLabel: "arthritis" },
  });

  // A long flare where the anti-inflammatory started late.
  const longFlare = await prisma.flare.create({
    data: {
      userId: user.id,
      status: "closed",
      onsetDate: addDays(today, -150),
      onsetPrecision: "approx",
      endDate: addDays(today, -139),
      endPrecision: "approx",
      peakSeverity: 4,
    },
  });
  await prisma.treatment.create({
    data: {
      flareId: longFlare.id,
      name: "Naproxen",
      startedOn: addDays(today, -145),
      startedPrecision: "approx",
      helped: "unsure",
      note: "Started on day six.",
    },
  });
  await prisma.treatment.create({
    data: {
      flareId: longFlare.id,
      name: "Rest",
      startedOn: addDays(today, -150),
      startedPrecision: "approx",
      helped: "yes",
    },
  });

  // A shorter flare where the same anti-inflammatory started on day one.
  const shortFlare = await prisma.flare.create({
    data: {
      userId: user.id,
      status: "closed",
      onsetDate: addDays(today, -80),
      onsetPrecision: "exact",
      endDate: addDays(today, -75),
      endPrecision: "exact",
      peakSeverity: 3,
    },
  });
  await prisma.treatment.create({
    data: {
      flareId: shortFlare.id,
      name: "Naproxen",
      startedOn: addDays(today, -80),
      startedPrecision: "exact",
      helped: "yes",
      note: "Started on day one.",
    },
  });

  // A flare happening right now, so the home screen shows a live state.
  await prisma.flare.create({
    data: {
      userId: user.id,
      status: "open",
      onsetDate: addDays(today, -3),
      onsetPrecision: "approx",
    },
  });
}
