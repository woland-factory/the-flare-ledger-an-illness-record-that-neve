import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

// The app runs on real PostgreSQL in dev, staging and production. Tests and
// the e2e build run against an in-process PGlite instance (real Postgres
// compiled to WASM) so the suite is fully self-provisioning with no external
// database. `DB_DRIVER=pglite` selects that path.
//
// PGlite is loaded lazily through a runtime require so the production image,
// which always runs on real Postgres, never ships the WASM build. The require
// string is held in a variable so the bundler leaves it as a runtime lookup
// and does not trace the package into the standalone output.
const nodeRequire = createRequire(import.meta.url);

const globalStore = globalThis as unknown as {
  prisma?: PrismaClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pglite?: any;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function build(): { client: PrismaClient; pglite?: any } {
  if (process.env.DB_DRIVER === "pglite") {
    const pglitePkg = "@electric-sql/pglite";
    const adapterPkg = "pglite-prisma-adapter";
    const { PGlite } = nodeRequire(pglitePkg);
    const { PrismaPGlite } = nodeRequire(adapterPkg);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPglite(): any {
  return globalStore.pglite;
}
