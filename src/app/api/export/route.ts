import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { checkRateLimit, exportLimit } from "@/lib/rateLimit";
import { exportQuerySchema } from "@/lib/validation";
import { buildExportPayload, loadUserFlares } from "@/lib/export";
import { flaresToCsv } from "@/lib/csv";
import { toIsoDate, todayUtc } from "@/lib/date";

// GET: download the whole record as JSON or CSV. Complete, not paged, and
// scoped to the caller. Rate-limited per user; no PII logged on either path.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = exportQuerySchema.safeParse(params);
  if (!parsed.success) return errorResponse(400, "Choose JSON or CSV to download.");

  const { max, windowMs } = exportLimit();
  const { ok } = checkRateLimit(`export:${user.id}`, max, windowMs);
  if (!ok) return errorResponse(429, "You're going quickly. Try again in a minute.");

  const flares = await loadUserFlares(user.id);
  const filenameDate = toIsoDate(todayUtc());

  if (parsed.data.format === "csv") {
    return new NextResponse(flaresToCsv(flares), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="flare-ledger-${filenameDate}.csv"`,
      },
    });
  }

  const payload = buildExportPayload(
    { email: user.email, conditionLabel: user.conditionLabel },
    flares,
    new Date().toISOString(),
  );
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="flare-ledger-${filenameDate}.json"`,
    },
  });
}
