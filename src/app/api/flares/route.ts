import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, guardMutation, jsonResponse, requireUser } from "@/lib/api";
import { serializeFlare } from "@/lib/serialize";
import { todayUtc } from "@/lib/date";
import { flareListQuerySchema } from "@/lib/validation";

const PAGE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The keyset cursor is "<createdAtIso>_<id>". Neither part contains an
// underscore, so we split on the first one. A malformed cursor is a 400.
function parseCursor(before: string): { createdAt: Date; id: string } | null {
  const sep = before.indexOf("_");
  if (sep < 0) return null;
  const iso = before.slice(0, sep);
  const id = before.slice(sep + 1);
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime()) || !UUID.test(id)) return null;
  return { createdAt, id };
}

// GET: the caller's flares, newest first, keyset-paginated so the query stays
// bounded and index-backed as the record grows. Each row carries its treatments
// via a single batched relation load, not a per-row lookup.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = flareListQuerySchema.safeParse(params);
  if (!parsed.success) return errorResponse(400, "That request could not be read.");

  const limit = parsed.data.limit ?? PAGE;
  let cursor: { createdAt: Date; id: string } | null = null;
  if (parsed.data.before !== undefined) {
    cursor = parseCursor(parsed.data.before);
    if (!cursor) return errorResponse(400, "That request could not be read.");
  }

  const where = cursor
    ? {
        userId: user.id,
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }
    : { userId: user.id };

  const rows = await prisma.flare.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { treatments: true },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? `${last.createdAt.toISOString()}_${last.id}` : null;

  return jsonResponse({ flares: page.map(serializeFlare), nextCursor });
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
