"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost"
      style={{ background: "none", border: "none", cursor: "pointer" }}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
        router.push("/signin");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
