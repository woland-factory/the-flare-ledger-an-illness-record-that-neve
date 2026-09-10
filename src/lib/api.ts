import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./auth";
import { checkRateLimit, mutationLimit } from "./rateLimit";

/** Product-voice JSON error envelope. Never leaks internals. */
export function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: { message } }, { status });
}

export function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Best-effort client IP for per-IP auth limits behind a proxy. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Load the session server-side. Returns the user, or a 401 response the
 * caller must return as-is. Authorization is enforced here, never in the UI.
 */
export async function requireUser(): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return errorResponse(401, "Sign in to continue.");
  return user;
}

/** Enforce the per-user mutation limit. Returns a 429 response when exceeded. */
export function guardMutation(userId: string): NextResponse | null {
  const { max, windowMs } = mutationLimit();
  const { ok } = checkRateLimit(`mut:${userId}`, max, windowMs);
  if (!ok) return errorResponse(429, "You're going quickly. Try again in a minute.");
  return null;
}
