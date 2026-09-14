import { redirect } from "next/navigation";
import FlareEditor from "@/components/FlareEditor";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeFlare } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditFlarePage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const { id } = await params;
  const flare = await prisma.flare.findUnique({
    where: { id },
    include: { treatments: true },
  });
  // A row belonging to someone else is treated as absent: send the user back to
  // their own ledger rather than confirm it exists.
  if (!flare || flare.userId !== user.id) redirect("/ledger");

  return (
    <main className="container">
      <FlareEditor flare={serializeFlare(flare)} />
    </main>
  );
}
