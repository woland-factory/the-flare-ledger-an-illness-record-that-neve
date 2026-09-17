import Link from "next/link";
import { redirect } from "next/navigation";
import AdjustOnsetButton from "@/components/AdjustOnsetButton";
import CovenantNudge from "@/components/CovenantNudge";
import EndFlareButton from "@/components/EndFlareButton";
import FirstRun from "@/components/FirstRun";
import FlareStarter from "@/components/FlareStarter";
import InstallPrompt from "@/components/InstallPrompt";
import { getCurrentUser } from "@/lib/auth";
import { selectCovenantNudge } from "@/lib/covenant";
import { todayUtc } from "@/lib/date";
import { prisma } from "@/lib/db";
import { onsetText } from "@/lib/display";
import { serializeFlare } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const flareCount = await prisma.flare.count({ where: { userId: user.id } });

  const openRows = await prisma.flare.findMany({
    where: { userId: user.id, status: "open" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const openFlares = openRows.map(serializeFlare);

  // Decide the one calm nudge, if any, over the open flares already loaded.
  const candidate = selectCovenantNudge(
    openRows.map((f) => ({
      id: f.id,
      onsetDate: f.onsetDate,
      status: f.status,
      nudgedAt: f.nudgedAt,
    })),
    todayUtc(),
  );
  const nudgeFlare = candidate
    ? openFlares.find((f) => f.id === candidate.id) ?? null
    : null;

  // A brand-new user's home leads with the guided first run: a designed,
  // positive surface that walks them to their first flare. The quiet links stay
  // reachable below it.
  if (flareCount === 0) {
    return (
      <main className="container">
        <h1>Log a flare in seconds</h1>
        <p className="lede">Build a record your doctor can read.</p>
        <div className="stack">
          <FirstRun />

          <p
            className="muted"
            style={{ display: "flex", justifyContent: "center", gap: 20 }}
          >
            <Link className="link-quiet" href="/ledger">
              See your ledger
            </Link>
            <Link className="link-quiet" href="/appointments">
              Doctor visit coming up?
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Log a flare in seconds</h1>
      <p className="lede">Build a record your doctor can read.</p>

      <div className="stack">
        <FlareStarter />

        {nudgeFlare ? (
          <CovenantNudge flareId={nudgeFlare.id} onsetText={onsetText(nudgeFlare)} />
        ) : null}

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

        <InstallPrompt />

        <p
          className="muted"
          style={{ display: "flex", justifyContent: "center", gap: 20 }}
        >
          <Link className="link-quiet" href="/ledger">
            See your ledger
          </Link>
          <Link className="link-quiet" href="/appointments">
            Doctor visit coming up?
          </Link>
        </p>
      </div>
    </main>
  );
}
