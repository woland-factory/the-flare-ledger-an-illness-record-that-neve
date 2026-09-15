import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { errorResponse, guardMutation, jsonResponse, requireUser } from "@/lib/api";
import { parseIsoDate, todayUtc } from "@/lib/date";
import { appointmentCorrectionSchema } from "@/lib/validation";
import {
  applyCorrection,
  serializeAppointment,
  snapshotSchema,
} from "@/lib/reconstruction";

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Another user's appointment (or a malformed id) answers 404 so existence is
// never confirmed across accounts.
async function loadOwned(id: string, userId: string) {
  if (!UUID.test(id)) return null;
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment || appointment.userId !== userId) return null;
  return appointment;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const appointment = await loadOwned(id, user.id);
  if (!appointment) return errorResponse(404, "That page isn't here.");
  return jsonResponse({ appointment: serializeAppointment(appointment) });
}

// PATCH: exactly one correction operation per request. The apply logic is a
// pure function; this route wraps it with auth, ownership, rate limit, Zod,
// and persistence, re-validating the whole snapshot before it is stored.
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "That request could not be read.");
  }
  const parsed = appointmentCorrectionSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "That request could not be read.");
  const op = parsed.data;

  const { id } = await params;
  const appointment = await loadOwned(id, user.id);
  if (!appointment) return errorResponse(404, "That page isn't here.");

  const stored = snapshotSchema.safeParse(appointment.snapshot);
  if (!stored.success) {
    return errorResponse(500, "Check your connection and try again.");
  }

  const result = applyCorrection(
    stored.data,
    op,
    todayUtc(),
    op.op === "add_flare" ? crypto.randomUUID() : undefined,
  );
  if (!result.ok) return errorResponse(400, result.error);

  const valid = snapshotSchema.safeParse(result.snapshot);
  if (!valid.success) return errorResponse(400, "That request could not be read.");

  const data: Prisma.AppointmentUpdateInput = {
    snapshot: valid.data as Prisma.InputJsonValue,
  };
  if (op.op === "set_visit") {
    if (op.visit_date !== undefined) {
      const v = parseIsoDate(op.visit_date);
      if (!v) return errorResponse(400, "That date doesn't look right. Pick your visit date.");
      data.visitDate = v;
    }
    if (op.specialty !== undefined) data.specialty = op.specialty;
  }

  const updated = await prisma.appointment.update({ where: { id }, data });
  return jsonResponse({ appointment: serializeAppointment(updated) });
}
