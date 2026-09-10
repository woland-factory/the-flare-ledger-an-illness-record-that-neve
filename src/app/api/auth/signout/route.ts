import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { guardMutation, requireUser } from "@/lib/api";

export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const limited = guardMutation(user.id);
  if (limited) return limited;
  await destroySession();
  return new NextResponse(null, { status: 204 });
}
