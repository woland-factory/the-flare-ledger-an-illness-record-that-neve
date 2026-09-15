import Link from "next/link";
import { redirect } from "next/navigation";
import AppointmentCreator from "@/components/AppointmentCreator";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatExact } from "@/lib/date";
import { serializeAppointmentListItem } from "@/lib/reconstruction";
import { parseIsoDate } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const visits = (
    await prisma.appointment.findMany({
      where: { userId: user.id },
      orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    })
  ).map(serializeAppointmentListItem);

  if (visits.length === 0) {
    return (
      <main className="container">
        <div className="card empty">
          <h1>Before your visit</h1>
          <p className="lede">One page for your doctor, drafted from your flares.</p>
          <AppointmentCreator />
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Before your visit</h1>
      <p className="lede">Draft a one-page timeline, correct it, print it.</p>
      <AppointmentCreator />
      <div className="spacer" />
      <div className="card">
        {visits.map((v) => {
          const date = parseIsoDate(v.visitDate);
          return (
            <Link
              key={v.id}
              className="flare-row flare-row-link"
              href={`/appointments/${v.id}`}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {date ? formatExact(date) : v.visitDate}
                </div>
                {v.specialty ? <div className="muted">{v.specialty}</div> : null}
              </div>
              <span className="muted">
                {v.flareCount} {v.flareCount === 1 ? "flare" : "flares"}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
