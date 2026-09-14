import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardMutation, errorResponse, jsonResponse, requireUser } from "@/lib/api";
import { treatmentEditSchema } from "@/lib/validation";
import { deriveTreatmentStart } from "@/lib/interview";
import { serializeTreatment } from "@/lib/serialize";
import type { OnsetPrecision } from "@/lib/onset";

type Params = { params: Promise<{ id: string }> };

// Ownership is checked by joining the treatment to its flare and comparing the
// flare's userId. A miss reports 404 so another user's row is never confirmed.
async function loadOwned(id: string, userId: string) {
  const treatment = await prisma.treatment.findUnique({
    where: { id },
    include: { flare: true },
  });
  if (!treatment || treatment.flare.userId !== userId) return null;
  return treatment;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Choose what to change.");
  }

  const parsed = treatmentEditSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Choose what to change.");
  }

  const { id } = await params;
  const treatment = await loadOwned(id, user.id);
  if (!treatment) return errorResponse(404, "That treatment isn't here.");

  const d = parsed.data;
  const data: Prisma.TreatmentUpdateInput = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.helped !== undefined) data.helped = d.helped;
  if (d.note !== undefined) data.note = d.note;
  if (d.start_choice !== undefined) {
    const start = deriveTreatmentStart(
      d.start_choice,
      d.start_around_date,
      treatment.flare.onsetDate,
      treatment.flare.onsetPrecision as OnsetPrecision,
    );
    if (!start.ok) {
      return errorResponse(400, "That start date doesn't look right. Pick when it began.");
    }
    data.startedOn = start.value.startedOn;
    data.startedPrecision = start.value.startedPrecision;
  }

  const updated = await prisma.treatment.update({ where: { id }, data });
  return jsonResponse({ treatment: serializeTreatment(updated) });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;

  const { id } = await params;
  const treatment = await loadOwned(id, user.id);
  if (!treatment) return errorResponse(404, "That treatment isn't here.");

  await prisma.treatment.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
