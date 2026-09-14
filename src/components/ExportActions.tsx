"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Subordinate export surface for the ledger. Downloads go through fetch so a
// failure is catchable and shown in the product's voice with a retry.
export default function ExportActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "json" | "csv">(null);
  const [error, setError] = useState<string | null>(null);

  async function download(format: "json" | "csv") {
    if (busy) return;
    setBusy(format);
    setError(null);
    try {
      const res = await fetch(`/api/export?format=${format}`);
      if (!res.ok) {
        setError(
          res.status === 429
            ? "You're going quickly. Try again in a minute."
            : "Check your connection and try again.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flare-ledger.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <button
          className="btn btn-secondary"
          disabled={busy !== null}
          aria-busy={busy === "json"}
          onClick={() => download("json")}
        >
          {busy === "json" ? "Preparing" : "Download JSON"}
        </button>
        <button
          className="btn btn-secondary"
          disabled={busy !== null}
          aria-busy={busy === "csv"}
          onClick={() => download("csv")}
        >
          {busy === "csv" ? "Preparing" : "Download CSV"}
        </button>
      </div>
      <button className="btn btn-ghost" onClick={() => router.push("/ledger/print")}>
        Print
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
