import type { Flare, Treatment } from "@prisma/client";
import { daysBetween, toIsoDate } from "./date";

export type TreatmentDTO = {
  id: string;
  name: string;
  startedOn: string | null;
  startedPrecision: string | null;
  helped: string | null;
  note: string | null;
};

export type FlareDTO = {
  id: string;
  status: string;
  onsetDate: string;
  onsetPrecision: string;
  endDate: string | null;
  endPrecision: string | null;
  peakSeverity: number | null;
  impactNote: string | null;
  symptomNote: string | null;
  durationDays: number | null;
  createdAt: string;
  treatments?: TreatmentDTO[];
};

export function serializeTreatment(t: Treatment): TreatmentDTO {
  return {
    id: t.id,
    name: t.name,
    startedOn: t.startedOn ? toIsoDate(t.startedOn) : null,
    startedPrecision: t.startedPrecision,
    helped: t.helped,
    note: t.note,
  };
}

// Treatments read best oldest-first, with the "start not recorded" ones last.
function orderTreatments(a: Treatment, b: Treatment): number {
  if (a.startedOn && b.startedOn) {
    if (a.startedOn.getTime() !== b.startedOn.getTime())
      return a.startedOn.getTime() - b.startedOn.getTime();
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  if (a.startedOn) return -1;
  if (b.startedOn) return 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

// The list endpoint stays lean; detail and edit pass a flare loaded with its
// treatments, and only then are they serialized onto the DTO.
type FlareWithTreatments = Flare & { treatments?: Treatment[] };

export function serializeFlare(flare: FlareWithTreatments): FlareDTO {
  const onset = flare.onsetDate;
  const end = flare.endDate;
  // Duration counts both the onset day and the end day, so a flare that
  // starts and ends on the same date reads as one day.
  const durationDays =
    flare.status === "closed" && end ? daysBetween(onset, end) + 1 : null;
  const dto: FlareDTO = {
    id: flare.id,
    status: flare.status,
    onsetDate: toIsoDate(onset),
    onsetPrecision: flare.onsetPrecision,
    endDate: end ? toIsoDate(end) : null,
    endPrecision: flare.endPrecision,
    peakSeverity: flare.peakSeverity,
    impactNote: flare.impactNote,
    symptomNote: flare.symptomNote,
    durationDays,
    createdAt: flare.createdAt.toISOString(),
  };
  if (flare.treatments) {
    dto.treatments = [...flare.treatments].sort(orderTreatments).map(serializeTreatment);
  }
  return dto;
}
