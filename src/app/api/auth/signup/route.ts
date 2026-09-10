import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { credentialsSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
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
    return errorResponse(400, "Enter your email and a password.");
  }

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Enter a valid email and a password of at least 8 characters.");
  }

  const { email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({ data: { email, passwordHash } });
    await createSession(user.id, cookieSecure(req.headers.get("x-forwarded-proto")));
    return jsonResponse({ id: user.id, email: user.email }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return errorResponse(409, "That email is already registered. Sign in instead.");
    }
    throw err;
  }
}
