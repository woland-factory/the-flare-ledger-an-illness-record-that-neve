import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

describe("schema migration", () => {
  it("creates the core tables", async () => {
    const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(["users", "sessions", "flares", "treatments"]));
  });

  it("creates the ledger indexes on flares", async () => {
    const rows = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'flares'",
    );
    const names = rows.map((r) => r.indexname);
    expect(names).toContain("flares_user_id_idx");
    expect(names).toContain("flares_user_id_created_at_idx");
  });

  it("enforces the flare status check constraint", async () => {
    const user = await prisma.user.create({
      data: { email: "check@example.com", passwordHash: "x" },
    });
    await expect(
      prisma.flare.create({
        data: {
          userId: user.id,
          status: "banana",
          onsetDate: new Date("2026-01-01T00:00:00Z"),
          onsetPrecision: "exact",
        },
      }),
    ).rejects.toBeTruthy();
  });
});
