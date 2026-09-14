import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardMutation, errorResponse, jsonResponse, requireUser } from "@/lib/api";
import { flareEditSchema } from "@/lib/validation";
import { deriveOnset } from "@/lib/onset";
import { deriveEnd } from "@/lib/interview";
import { serializeFlare } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const flare = await prisma.flare.findUnique({
    where: { id },
    include: { treatments: true },
  });
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
    return errorResponse(400, "Choose what to change.");
  }

  const parsed = flareEditSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Choose what to change.");
  }

  const { id } = await params;
  const flare = await prisma.flare.findUnique({ where: { id } });
  if (!flare || flare.userId !== user.id) {
    return errorResponse(404, "That flare isn't here.");
  }

  const d = parsed.data;
  const data: Prisma.FlareUpdateInput = {};

  // Onset editing is independent of status, preserving the legacy behavior.
  if (d.onset_choice !== undefined) {
    const derived = deriveOnset(d.onset_choice, d.around_date);
    if (!derived.ok) {
      return errorResponse(400, "That date doesn't look right. Pick when the flare started.");
    }
    data.onsetDate = derived.value.onsetDate;
    data.onsetPrecision = derived.value.onsetPrecision;
  }

  const editsClosedFields =
    d.end_choice !== undefined ||
    d.peak_severity !== undefined ||
    d.impact_note !== undefined ||
    d.symptom_note !== undefined;

  if (d.reopen) {
    // Reopening makes the flare active again: clear the end, keep severity,
    // notes, and treatments as recorded observations.
    data.status = "open";
    data.endDate = null;
    data.endPrecision = null;
  } else if (editsClosedFields) {
    // End, severity, and notes belong to a closed flare. Setting them on an
    // open flare is done through the close interview, not this edit.
    if (flare.status !== "closed") {
      return errorResponse(400, "Close this flare before editing its end details.");
    }
    if (d.end_choice !== undefined) {
      const end = deriveEnd(d.end_choice, d.end_around_date, flare.onsetDate);
      if (!end.ok) {
        return errorResponse(400, "That end date doesn't look right. Pick when it ended.");
      }
      data.endDate = end.value.endDate;
      data.endPrecision = end.value.endPrecision;
    }
    if (d.peak_severity !== undefined) data.peakSeverity = d.peak_severity;
    if (d.impact_note !== undefined) data.impactNote = d.impact_note;
    if (d.symptom_note !== undefined) data.symptomNote = d.symptom_note;
  }

  if (Object.keys(data).length === 0) {
    return errorResponse(400, "Choose what to change.");
  }

  await prisma.flare.update({ where: { id }, data });
  const updated = await prisma.flare.findUniqueOrThrow({
    where: { id },
    include: { treatments: true },
  });
  return jsonResponse({ flare: serializeFlare(updated) });
}
