import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";

export const SESSION_COOKIE = "fl_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type CurrentUser = {
  id: string;
  email: string;
  conditionLabel: string | null;
};

// The cookie carries an opaque random token. We store only a hash of it as
// the session id, so a leaked database never yields usable session tokens.
function tokenToId(token: string): string {
  const hex = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Whether session cookies should carry the Secure flag for this request. */
export function cookieSecure(forwardedProto?: string | null): boolean {
  if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export async function createSession(
  userId: string,
  secure: boolean,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const id = tokenToId(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: tokenToId(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: tokenToId(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    conditionLabel: session.user.conditionLabel,
  };
}
