"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EndInterview from "./EndInterview";

// The one allowed unsolicited prompt: a single calm question for a flare left
// open well past its likely end. It is surfaced only on a visit (the home RSC
// decides), records itself once on mount so it never returns, and offers two
// plain choices. No badge, no count, no schedule.
export default function CovenantNudge({
  flareId,
  onsetText,
}: {
  flareId: string;
  onsetText: string;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    // Mark-on-surface: record the single nudge the moment it is shown, so it
    // never returns even if the user ignores it and leaves. Best-effort; a
    // failed mark simply risks one more appearance on a later visit.
    fetch(`/api/flares/${flareId}/nudge`, { method: "POST" }).catch(() => {});
  }, [flareId]);

  if (hidden) return null;

  return (
    <div className="card nudge">
      <h2>Is this flare still going?</h2>
      <p className="muted">{onsetText}</p>
      <div className="spacer-sm" />
      <div className="stack">
        <button className="btn btn-primary" onClick={() => setEnding(true)}>
          It ended
        </button>
        <button className="btn btn-secondary" onClick={() => setHidden(true)}>
          Still going
        </button>
      </div>
      {ending ? (
        <EndInterview
          flareId={flareId}
          onClosed={() => {
            setEnding(false);
            router.refresh();
          }}
          onDismiss={() => setEnding(false)}
        />
      ) : null}
    </div>
  );
}
