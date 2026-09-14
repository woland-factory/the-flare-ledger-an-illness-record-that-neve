import Link from "next/link";
import {
  durationTextFor,
  endText,
  keyTreatmentsText,
  onsetText,
  severityText,
  statusText,
} from "@/lib/display";
import type { FlareDTO } from "@/lib/serialize";

// One scannable ledger row: the whole flare readable without opening it. Shared
// by the server-rendered first page and the client pager so rows match exactly.
export default function FlareRow({ flare }: { flare: FlareDTO }) {
  const ended = endText(flare);
  const duration = durationTextFor(flare);
  const treatments = keyTreatmentsText(flare.treatments ?? []);
  const isOpen = flare.status === "open";
  return (
    <Link className="flare-row flare-row-link" href={`/flares/${flare.id}/edit`}>
      <div>
        <div style={{ fontWeight: 600 }}>{onsetText(flare)}</div>
        {ended ? <div className="muted">{ended}</div> : null}
        {duration ? <div className="muted">Lasted {duration}</div> : null}
        <div className="muted">{severityText(flare.peakSeverity)}</div>
        {treatments ? <div className="muted">{treatments}</div> : null}
      </div>
      <span className={`pill ${isOpen ? "pill-open" : "pill-closed"}`}>
        {statusText(flare.status)}
      </span>
    </Link>
  );
}
