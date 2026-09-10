import type { Flare } from "@prisma/client";
import { daysBetween, toIsoDate } from "./date";

export type FlareDTO = {
  id: string;
  status: string;
  onsetDate: string;
  onsetPrecision: string;
  endDate: string | null;
  endPrecision: string | null;
  peakSeverity: number | null;
  durationDays: number | null;
  createdAt: string;
};

export function serializeFlare(flare: Flare): FlareDTO {
  const onset = flare.onsetDate;
  const end = flare.endDate;
  // Duration counts both the onset day and the end day, so a flare that
  // starts and ends on the same date reads as one day.
  const durationDays =
    flare.status === "closed" && end ? daysBetween(onset, end) + 1 : null;
  return {
    id: flare.id,
    status: flare.status,
    onsetDate: toIsoDate(onset),
    onsetPrecision: flare.onsetPrecision,
    endDate: end ? toIsoDate(end) : null,
    endPrecision: flare.endPrecision,
    peakSeverity: flare.peakSeverity,
    durationDays,
    createdAt: flare.createdAt.toISOString(),
  };
}
