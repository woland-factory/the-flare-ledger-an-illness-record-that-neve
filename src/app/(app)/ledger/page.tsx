import { redirect } from "next/navigation";
import ExportActions from "@/components/ExportActions";
import FlareRow from "@/components/FlareRow";
import FlareStarter from "@/components/FlareStarter";
import LedgerPager from "@/components/LedgerPager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeFlare } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const PAGE = 25;

export default async function LedgerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  // First page server-side for a fast first paint. The extra row only tells us
  // whether an older page exists; it is not rendered.
  const rows = await prisma.flare.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    include: { treatments: true },
  });

  if (rows.length === 0) {
    return (
      <main className="container">
        <div className="card empty">
          <h1>Your flares will live here</h1>
          <p className="lede">Start one the moment it begins. It takes a tap.</p>
          <FlareStarter />
        </div>
      </main>
    );
  }

  const hasMore = rows.length > PAGE;
  const page = (hasMore ? rows.slice(0, PAGE) : rows).map(serializeFlare);
  const last = page[page.length - 1];
  const initialCursor =
    hasMore && last ? `${last.createdAt}_${last.id}` : null;

  return (
    <main className="container">
      <h1>Your ledger</h1>
      <p className="lede">Every flare you have logged, newest first.</p>
      <div className="card">
        {page.map((flare) => (
          <FlareRow key={flare.id} flare={flare} />
        ))}
      </div>
      {initialCursor ? <LedgerPager initialCursor={initialCursor} /> : null}

      <div className="spacer" />
      <div className="card">
        <h2>Export your record</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Take the whole record to your appointment.
        </p>
        <ExportActions />
      </div>
    </main>
  );
}
