import { prisma } from "./db";
import { serializeFlare, type FlareDTO } from "./serialize";

export type ExportPayload = {
  version: 1;
  exportedAt: string;
  account: { email: string; conditionLabel: string | null };
  flares: FlareDTO[];
};

// Every one of a user's flares with treatments, oldest-first by onset so the
// record reads as a timeline. Scoped to the one user, so no code path here can
// return another user's rows. Used by both export formats and the print view.
export async function loadUserFlares(userId: string): Promise<FlareDTO[]> {
  const flares = await prisma.flare.findMany({
    where: { userId },
    orderBy: [{ onsetDate: "asc" }, { createdAt: "asc" }],
    include: { treatments: true },
  });
  return flares.map(serializeFlare);
}

export function buildExportPayload(
  account: { email: string; conditionLabel: string | null },
  flares: FlareDTO[],
  exportedAt: string,
): ExportPayload {
  return {
    version: 1,
    exportedAt,
    account: { email: account.email, conditionLabel: account.conditionLabel },
    flares,
  };
}
