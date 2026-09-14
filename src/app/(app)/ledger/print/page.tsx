import Link from "next/link";
import { redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { getCurrentUser } from "@/lib/auth";
import {
  durationTextFor,
  endText,
  helpedText,
  onsetText,
  severityText,
  treatmentStartText,
} from "@/lib/display";
import { loadUserFlares } from "@/lib/export";

export const dynamic = "force-dynamic";

export default async function PrintPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const flares = await loadUserFlares(user.id);

  return (
    <main className="container">
      <div className="no-print row" style={{ marginBottom: 16 }}>
        <Link className="btn btn-secondary" href="/ledger">
          Back to ledger
        </Link>
        <PrintButton />
      </div>

      <h1>Your flare record</h1>

      {flares.length === 0 ? (
        <p className="lede">Start a flare to build your record.</p>
      ) : (
        flares.map((flare) => {
          const ended = endText(flare);
          const duration = durationTextFor(flare);
          const treatments = flare.treatments ?? [];
          return (
            <section className="print-flare" key={flare.id}>
              <h2>{onsetText(flare)}</h2>
              {ended ? <p className="muted">{ended}</p> : null}
              {duration ? <p className="muted">Lasted {duration}</p> : null}
              <p className="muted">{severityText(flare.peakSeverity)}</p>

              {treatments.length > 0 ? (
                <ul>
                  {treatments.map((t) => (
                    <li key={t.id}>
                      {t.name}. {treatmentStartText(t)}. {helpedText(t.helped)}.
                    </li>
                  ))}
                </ul>
              ) : null}

              {flare.impactNote ? <p>{flare.impactNote}</p> : null}
              {flare.symptomNote ? <p>{flare.symptomNote}</p> : null}
            </section>
          );
        })
      )}
    </main>
  );
}
