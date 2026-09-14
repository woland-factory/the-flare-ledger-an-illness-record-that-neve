import Link from "next/link";
import { redirect } from "next/navigation";
import FlareStarter from "@/components/FlareStarter";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { durationTextFor, endText, onsetText, statusText } from "@/lib/display";
import { serializeFlare } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const flares = (
    await prisma.flare.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  ).map(serializeFlare);

  if (flares.length === 0) {
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

  return (
    <main className="container">
      <h1>Your ledger</h1>
      <p className="lede">Every flare you have logged, newest first.</p>
      <div className="card">
        {flares.map((flare) => {
          const duration = durationTextFor(flare);
          const ended = endText(flare);
          return (
            <Link className="flare-row flare-row-link" key={flare.id} href={`/flares/${flare.id}/edit`}>
              <div>
                <div style={{ fontWeight: 600 }}>{onsetText(flare)}</div>
                {duration ? <div className="muted">Lasted {duration}</div> : null}
                {ended ? <div className="muted">{ended}</div> : null}
              </div>
              <span
                className={`pill ${flare.status === "open" ? "pill-open" : "pill-closed"}`}
              >
                {statusText(flare.status)}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
