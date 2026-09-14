import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardMutation, errorResponse, jsonResponse, requireUser } from "@/lib/api";
import { treatmentInputSchema } from "@/lib/validation";
import { buildTreatmentFields } from "@/lib/interview";
import { serializeTreatment } from "@/lib/serialize";
import type { OnsetPrecision } from "@/lib/onset";

type Params = { params: Promise<{ id: string }> };

// POST: add one treatment to an owned flare.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Add the treatment details and try again.");
  }

  const parsed = treatmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Add the treatment details and try again.");
  }

  const { id } = await params;
  const flare = await prisma.flare.findUnique({ where: { id } });
  if (!flare || flare.userId !== user.id) {
    return errorResponse(404, "That flare isn't here.");
  }

  const built = buildTreatmentFields(
    parsed.data,
    flare.onsetDate,
    flare.onsetPrecision as OnsetPrecision,
  );
  if (!built.ok) {
    return errorResponse(400, "Check the treatment details and try again.");
  }

  const treatment = await prisma.treatment.create({
    data: { flareId: id, ...built.value },
  });
  return jsonResponse({ treatment: serializeTreatment(treatment) }, 201);
}
