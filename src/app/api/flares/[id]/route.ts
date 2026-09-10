import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardMutation, errorResponse, jsonResponse, requireUser } from "@/lib/api";
import { onsetSchema } from "@/lib/validation";
import { deriveOnset } from "@/lib/onset";
import { serializeFlare } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const flare = await prisma.flare.findUnique({ where: { id } });
  // A row belonging to another user is reported as not found so existence is
  // never confirmed across accounts.
  if (!flare || flare.userId !== user.id) {
    return errorResponse(404, "That flare isn't here.");
  }
  return jsonResponse({ flare: serializeFlare(flare) });
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
    return errorResponse(400, "Choose when the flare started.");
  }

  // This EPIC accepts only onset fields. A strict schema rejects anything else.
  const parsed = onsetSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Choose when the flare started.");
  }

  const { id } = await params;
  const flare = await prisma.flare.findUnique({ where: { id } });
  if (!flare || flare.userId !== user.id) {
    return errorResponse(404, "That flare isn't here.");
  }

  const derived = deriveOnset(parsed.data.onset_choice, parsed.data.around_date);
  if (!derived.ok) {
    return errorResponse(400, "That date doesn't look right. Pick when the flare started.");
  }

  const updated = await prisma.flare.update({
    where: { id },
    data: {
      onsetDate: derived.value.onsetDate,
      onsetPrecision: derived.value.onsetPrecision,
    },
  });
  return jsonResponse({ flare: serializeFlare(updated) });
}
