import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { errorResponse, guardMutation, jsonResponse, requireUser } from "@/lib/api";
import { parseIsoDate, toIsoDate } from "@/lib/date";
import { appointmentCreateSchema } from "@/lib/validation";
import {
  buildDraftSnapshot,
  serializeAppointment,
  serializeAppointmentListItem,
  snapshotSchema,
} from "@/lib/reconstruction";

const LIST_CAP = 50;

// GET: the caller's visits, newest first. Capped at 50 (a handful per year in
// practice) so the read stays bounded; the list ships a flare count, never
// the snapshot bodies.
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const rows = await prisma.appointment.findMany({
    where: { userId: user.id },
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    take: LIST_CAP,
  });
  return jsonResponse({ appointments: rows.map(serializeAppointmentListItem) });
}

// POST: create and draft in one step. The draft covers the flares open or
// ended on/after the previous appointment's visit date (all recorded flares
// on the first), built only from this user's stored rows. No model call.
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "That date doesn't look right. Pick your visit date.");
  }
  const parsed = appointmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "That date doesn't look right. Pick your visit date.");
  }
  const visitDate = parseIsoDate(parsed.data.visit_date);
  if (!visitDate) {
    return errorResponse(400, "That date doesn't look right. Pick your visit date.");
  }

  const previous = await prisma.appointment.findFirst({
    where: { userId: user.id, visitDate: { lte: visitDate } },
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
  });
  const rangeStart = previous ? toIsoDate(previous.visitDate) : null;

  const where: Prisma.FlareWhereInput = previous
    ? {
        userId: user.id,
        OR: [{ endDate: null }, { endDate: { gte: previous.visitDate } }],
      }
    : { userId: user.id };
  const flares = await prisma.flare.findMany({
    where,
    orderBy: [{ onsetDate: "asc" }, { createdAt: "asc" }],
    include: { treatments: true },
  });

  const snapshot = snapshotSchema.parse(buildDraftSnapshot(flares, rangeStart));
  const appointment = await prisma.appointment.create({
    data: {
      userId: user.id,
      visitDate,
      specialty: parsed.data.specialty ?? null,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  });
  return jsonResponse({ appointment: serializeAppointment(appointment) }, 201);
}
