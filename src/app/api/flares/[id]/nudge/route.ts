import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, guardMutation, jsonResponse, requireUser } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

// POST: record that this flare has been surfaced for the one covenant nudge, so
// it is never surfaced again (mark-on-surface). Idempotent: a second call
// leaves the existing timestamp in place. No request body.
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;

  const { id } = await params;
  const flare = await prisma.flare.findUnique({ where: { id } });
  // A row belonging to another user is reported as not found so existence is
  // never confirmed across accounts.
  if (!flare || flare.userId !== user.id) {
    return errorResponse(404, "That flare isn't here.");
  }

  if (flare.nudgedAt === null) {
    await prisma.flare.update({ where: { id }, data: { nudgedAt: new Date() } });
  }
  return jsonResponse({ ok: true });
}
