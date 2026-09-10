import { PrismaClient } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";

// The app runs on real PostgreSQL in dev, staging and production. Tests and
// the e2e build run against an in-process PGlite instance (real Postgres
// compiled to WASM) so the suite is fully self-provisioning with no external
// database. `DB_DRIVER=pglite` selects that path.
const globalStore = globalThis as unknown as {
  prisma?: PrismaClient;
  pglite?: PGlite;
};

function build(): { client: PrismaClient; pglite?: PGlite } {
  if (process.env.DB_DRIVER === "pglite") {
    const pg = globalStore.pglite ?? new PGlite(process.env.PGLITE_DIR || undefined);
    globalStore.pglite = pg;
    // The adapter bundles a slightly different build of driver-adapter-utils
    // than @prisma/client, so the factory types drift. The runtime shape is
    // compatible; the test suite exercises it end to end.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaPGlite(pg) as any;
    return { client: new PrismaClient({ adapter }), pglite: pg };
  }
  return { client: new PrismaClient({ log: ["error"] }) };
}

const built = globalStore.prisma
  ? { client: globalStore.prisma, pglite: globalStore.pglite }
  : build();

export const prisma = built.client;
globalStore.prisma = prisma;

export function getPglite(): PGlite | undefined {
  return globalStore.pglite;
}
