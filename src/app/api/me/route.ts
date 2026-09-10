import { NextResponse } from "next/server";
import { jsonResponse, requireUser } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return jsonResponse({
    id: user.id,
    email: user.email,
    condition_label: user.conditionLabel,
  });
}
