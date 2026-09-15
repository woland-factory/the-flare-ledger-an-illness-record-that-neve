import { notFound, redirect } from "next/navigation";
import SnapshotEditor from "@/components/SnapshotEditor";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toIsoDate, todayUtc } from "@/lib/date";
import { serializeAppointment } from "@/lib/reconstruction";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AppointmentPage({
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

  return (
    <main className="container">
      <SnapshotEditor
        appointment={serializeAppointment(appointment)}
        todayIso={toIsoDate(todayUtc())}
      />
    </main>
  );
}
