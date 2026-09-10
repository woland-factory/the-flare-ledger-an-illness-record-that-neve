"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import OnsetSheet from "./OnsetSheet";

export default function FlareStarter({ label = "Start a flare" }: { label?: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flareId, setFlareId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (starting) return;
    // Open the sheet immediately so the tap feels instant, then fill in the
    // flare id as soon as the create resolves.
    setError(null);
    setFlareId(null);
    setSheetOpen(true);
    setStarting(true);
    try {
      const res = await fetch("/api/flares", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setFlareId(data.flare.id);
      } else {
        setSheetOpen(false);
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Check your connection and try again.");
      }
    } catch {
      setSheetOpen(false);
      setError("Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  function saved() {
    setSheetOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-primary" onClick={start} disabled={starting} aria-haspopup="dialog">
        {starting ? "Starting" : label}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {sheetOpen ? (
        <OnsetSheet flareId={flareId} onSaved={saved} onClose={() => setSheetOpen(false)} />
      ) : null}
    </>
  );
}
