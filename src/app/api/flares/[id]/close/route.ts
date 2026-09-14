import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardMutation, errorResponse, jsonResponse, requireUser } from "@/lib/api";
import { closeSchema } from "@/lib/validation";
import { buildTreatmentFields, deriveEnd } from "@/lib/interview";
import { serializeFlare } from "@/lib/serialize";
import type { OnsetPrecision } from "@/lib/onset";

type Params = { params: Promise<{ id: string }> };

// POST: submit the whole flare-end interview and close the flare in one
// transaction, so a partial close can never happen.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Choose when the flare ended.");
  }

  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Check the interview answers and try again.");
  }

  const { id } = await params;
  const flare = await prisma.flare.findUnique({ where: { id } });
  if (!flare || flare.userId !== user.id) {
    return errorResponse(404, "That flare isn't here.");
  }
  if (flare.status === "closed") {
    return errorResponse(409, "This flare is already closed. You can edit it.");
  }

  const onsetPrecision = flare.onsetPrecision as OnsetPrecision;
  const end = deriveEnd(parsed.data.end_choice, parsed.data.end_around_date, flare.onsetDate);
  if (!end.ok) {
    return errorResponse(400, "That end date doesn't look right. Pick when it ended.");
  }

  const treatmentRows = [];
  for (const t of parsed.data.treatments ?? []) {
    const built = buildTreatmentFields(t, flare.onsetDate, onsetPrecision);
    if (!built.ok) {
      return errorResponse(400, "Check the treatment details and try again.");
    }
    treatmentRows.push(built.value);
  }

  // Flare fields and all treatments land in one transaction, so a partial
  // close is impossible.
  await prisma.$transaction([
    prisma.flare.update({
      where: { id },
      data: {
        status: "closed",
        endDate: end.value.endDate,
        endPrecision: end.value.endPrecision,
        peakSeverity: parsed.data.peak_severity ?? null,
        impactNote: parsed.data.impact_note ?? null,
        symptomNote: parsed.data.symptom_note ?? null,
      },
    }),
    ...(treatmentRows.length
      ? [prisma.treatment.createMany({ data: treatmentRows.map((r) => ({ flareId: id, ...r })) })]
      : []),
  ]);

  const closed = await prisma.flare.findUniqueOrThrow({
    where: { id },
    include: { treatments: true },
  });
  return jsonResponse({ flare: serializeFlare(closed) });
}
