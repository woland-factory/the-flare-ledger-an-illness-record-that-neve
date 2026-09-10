import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/home">
          Flare Ledger
        </Link>
        <SignOutButton />
      </header>
      {children}
    </>
  );
}
