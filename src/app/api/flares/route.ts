import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardMutation, jsonResponse, requireUser } from "@/lib/api";
import { serializeFlare } from "@/lib/serialize";
import { todayUtc } from "@/lib/date";

const MAX_LIMIT = 50;

// GET: the caller's flares, newest first, capped so the query stays fast as
// the record grows. Backed by the (user_id, created_at desc) index.
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const flares = await prisma.flare.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_LIMIT,
  });
  return jsonResponse({ flares: flares.map(serializeFlare) });
}

// POST: records an open flare on the first tap. Onset is provisional (today,
// exact) until the onset sheet sets it. No body required.
export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;
  const flare = await prisma.flare.create({
    data: {
      userId: user.id,
      status: "open",
      onsetDate: todayUtc(),
      onsetPrecision: "exact",
    },
  });
  return jsonResponse({ flare: serializeFlare(flare) }, 201);
}
