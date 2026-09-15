process.env.DB_DRIVER = "pglite";

import { beforeAll, beforeEach } from "vitest";
import { resetRateLimits } from "@/lib/rateLimit";

beforeAll(async () => {
  const { ensureSchema } = await import("@/lib/dbInit");
  await ensureSchema();
});

beforeEach(async () => {
  resetRateLimits();
  const { prisma } = await import("@/lib/db");
  await prisma.$executeRawUnsafe(
    "TRUNCATE users, sessions, flares, treatments, appointments RESTART IDENTITY CASCADE",
  );
});
