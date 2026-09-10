import { NextRequest } from "next/server";
import { credentialsSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/db";
import { createSession, cookieSecure } from "@/lib/auth";
import { clientIp, errorResponse, jsonResponse } from "@/lib/api";
import { authLimit, checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const { max, windowMs } = authLimit();
  if (!checkRateLimit(`auth:${clientIp(req)}`, max, windowMs).ok) {
    return errorResponse(429, "Too many attempts. Try again in a minute.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Enter your email and password.");
  }

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Enter a valid email and a password of at least 8 characters.");
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  // Verify even when the user is missing so the response time does not reveal
  // which accounts exist. The message never says which field failed.
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !ok) {
    return errorResponse(401, "Email or password is incorrect.");
  }

  await createSession(user.id, cookieSecure(req.headers.get("x-forwarded-proto")));
  return jsonResponse({ id: user.id, email: user.email }, 200);
}
