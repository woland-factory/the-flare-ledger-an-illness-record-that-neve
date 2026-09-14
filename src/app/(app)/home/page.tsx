import Link from "next/link";
import { redirect } from "next/navigation";
import AdjustOnsetButton from "@/components/AdjustOnsetButton";
import EndFlareButton from "@/components/EndFlareButton";
import FlareStarter from "@/components/FlareStarter";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { onsetText } from "@/lib/display";
import { serializeFlare } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const openFlares = (
    await prisma.flare.findMany({
      where: { userId: user.id, status: "open" },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
  ).map(serializeFlare);

  return (
    <main className="container">
      <h1>Log a flare in seconds</h1>
      <p className="lede">Build a record your doctor can read.</p>

      <div className="stack">
        <FlareStarter />

        {openFlares.map((flare) => (
          <div className="card" key={flare.id}>
            <span className="pill pill-open">Flare in progress</span>
            <div className="spacer-sm" />
            <h2>{onsetText(flare)}</h2>
            <p className="muted">Close it when it ends. The interview takes under a minute.</p>
            <div className="spacer-sm" />
            <EndFlareButton flareId={flare.id} />
            <div className="row" style={{ marginTop: 4 }}>
              <AdjustOnsetButton flareId={flare.id} />
              <Link className="btn btn-ghost" href={`/flares/${flare.id}/edit`}>
                Edit flare
              </Link>
            </div>
          </div>
        ))}

        <p className="muted" style={{ textAlign: "center" }}>
          <Link className="link-quiet" href="/ledger">
            See your ledger
          </Link>
        </p>
      </div>
    </main>
  );
}
