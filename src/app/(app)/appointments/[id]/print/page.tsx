import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatExact, todayUtc } from "@/lib/date";
import { severityText } from "@/lib/display";
import {
  coverageText,
  flareRangeText,
  headlineText,
  serializeAppointment,
  treatmentLineText,
  visitLineText,
} from "@/lib/reconstruction";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AppointmentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment || appointment.userId !== user.id) notFound();

  const dto = serializeAppointment(appointment);
  const snapshot = dto.snapshot;
  const today = todayUtc();

  return (
    <main className="container onepage">
      <div className="no-print row" style={{ marginBottom: 16 }}>
        <Link className="btn btn-secondary" href={`/appointments/${dto.id}`}>
          Back to corrections
        </Link>
        <PrintButton />
      </div>

      <h1>Flare timeline</h1>
      <p className="muted">
        {visitLineText(dto.visitDate, dto.specialty)} Prepared {formatExact(today)}.
      </p>
      <p className="onepage-headline">{headlineText(snapshot, today)}</p>

      {snapshot.flares.length === 0 ? (
        <p>Add a missed flare from the corrections page.</p>
      ) : (
        snapshot.flares.map((f) => (
          <section className="onepage-flare" key={f.key}>
            <div style={{ fontWeight: 600 }}>{flareRangeText(f, today)}</div>
            <div className="muted">{severityText(f.peakSeverity)}</div>
            {f.treatments.map((t, i) => (
              <div className="muted" key={i}>
                {treatmentLineText(t, f)}
              </div>
            ))}
            {f.note ? <div className="muted">{f.note}</div> : null}
          </section>
        ))
      )}

      <p className="muted onepage-footer">{coverageText(snapshot)}</p>
    </main>
  );
}
