"use client";

import { useState } from "react";
import type { FlareDTO } from "@/lib/serialize";
import FlareRow from "./FlareRow";

// "Load older" keyset pager. The server renders the first page; this appends
// each further page and hides itself when the record is exhausted.
export default function LedgerPager({ initialCursor }: { initialCursor: string }) {
  const [flares, setFlares] = useState<FlareDTO[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadOlder() {
    if (!cursor || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/flares?limit=25&before=${encodeURIComponent(cursor)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setFlares((prev) => [...prev, ...data.flares]);
        setCursor(data.nextCursor);
      } else {
        setError("Check your connection and try again.");
      }
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {flares.length > 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          {flares.map((flare) => (
            <FlareRow key={flare.id} flare={flare} />
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
      {cursor ? (
        <>
          <div className="spacer-sm" />
          <button
            className="btn btn-secondary"
            disabled={busy}
            aria-busy={busy}
            onClick={loadOlder}
          >
            {busy ? "Loading" : "Load older flares"}
          </button>
        </>
      ) : null}
    </>
  );
}
