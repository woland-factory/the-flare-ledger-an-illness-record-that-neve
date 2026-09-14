"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FlareDTO, TreatmentDTO } from "@/lib/serialize";
import {
  durationTextFor,
  endText,
  helpedText,
  onsetText,
  severityText,
  treatmentStartText,
} from "@/lib/display";
import EndInterview from "./EndInterview";

type StartChoice = "flare_onset" | "few_days_in" | "around_date" | "unsure";
type Helped = "yes" | "no" | "unsure";

const START_LABELS: Record<StartChoice, string> = {
  flare_onset: "When the flare began",
  few_days_in: "A few days in",
  around_date: "Around a date",
  unsure: "Not sure",
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FlareEditor({ flare: initial }: { flare: FlareDTO }) {
  const router = useRouter();
  const [flare, setFlare] = useState<FlareDTO>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);

  const treatments = flare.treatments ?? [];
  const isClosed = flare.status === "closed";

  async function reload() {
    const res = await fetch(`/api/flares/${flare.id}`);
    if (res.ok) setFlare((await res.json()).flare);
  }

  // One place to send a flare PATCH, reload the row, and surface a product-voice
  // error with a retry path on failure.
  async function patchFlare(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/flares/${flare.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setFlare((await res.json()).flare);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Check your connection and try again.");
      }
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link className="link-quiet" href="/ledger">
        Back to ledger
      </Link>
      <div className="spacer-sm" />
      <h1>Edit flare</h1>
      <p className="lede">{onsetText(flare)}</p>

      {error ? (
        <div className="card" role="alert" style={{ marginBottom: 16 }}>
          <p className="form-error" style={{ marginBottom: 8 }}>{error}</p>
          <button className="btn btn-secondary" onClick={() => { setError(null); reload(); }}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="stack">
        {isClosed ? (
          <ClosedFields flare={flare} busy={busy} onPatch={patchFlare} />
        ) : (
          <div className="card">
            <span className="pill pill-open">Flare in progress</span>
            <div className="spacer-sm" />
            <p className="muted">Close it when it ends. The interview takes under a minute.</p>
            <div className="spacer-sm" />
            <button
              className="btn btn-primary"
              aria-haspopup="dialog"
              onClick={() => setInterviewOpen(true)}
            >
              This flare ended
            </button>
          </div>
        )}

        <Treatments
          flareId={flare.id}
          treatments={treatments}
          onChanged={reload}
          onError={setError}
        />

        {isClosed ? (
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => patchFlare({ reopen: true })}
          >
            Reopen this flare
          </button>
        ) : null}
      </div>

      {interviewOpen ? (
        <EndInterview
          flareId={flare.id}
          onClosed={() => {
            setInterviewOpen(false);
            reload();
            router.refresh();
          }}
          onDismiss={() => setInterviewOpen(false)}
        />
      ) : null}
    </>
  );
}

function ClosedFields({
  flare,
  busy,
  onPatch,
}: {
  flare: FlareDTO;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [endMode, setEndMode] = useState(false);
  const [endDate, setEndDate] = useState(flare.endDate ?? isoToday());
  const [impact, setImpact] = useState(flare.impactNote ?? "");
  const [symptom, setSymptom] = useState(flare.symptomNote ?? "");
  const [notesSaved, setNotesSaved] = useState(false);

  return (
    <div className="card stack">
      <div>
        <div style={{ fontWeight: 600 }}>{endText(flare) ?? "End not recorded"}</div>
        {durationTextFor(flare) ? (
          <div className="muted">Lasted {durationTextFor(flare)}</div>
        ) : null}
      </div>

      <div>
        <p className="section-label">When did it end?</p>
        {endMode ? (
          <div className="stack">
            <div className="field">
              <label htmlFor="edit-end">Around this date</label>
              <input
                id="edit-end"
                className="input"
                type="date"
                max={isoToday()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="row">
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => onPatch({ end_choice: "around_date", end_around_date: endDate }).then(() => setEndMode(false))}
              >
                Save
              </button>
              <button className="btn btn-ghost" onClick={() => setEndMode(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <div className="row">
              <button className="btn btn-secondary" disabled={busy} onClick={() => onPatch({ end_choice: "today" })}>
                Today
              </button>
              <button className="btn btn-secondary" disabled={busy} onClick={() => onPatch({ end_choice: "few_days_ago" })}>
                A few days ago
              </button>
            </div>
            <button className="btn btn-ghost" onClick={() => setEndMode(true)}>
              Around a date
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="section-label">{severityText(flare.peakSeverity)}</p>
        <div className="scale">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className="btn btn-secondary"
              aria-pressed={flare.peakSeverity === n}
              aria-label={`Peak severity ${n} of 5`}
              disabled={busy}
              onClick={() => onPatch({ peak_severity: n })}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="scale-ends">
          <span>Mild</span>
          <span>Severe</span>
        </div>
        <div className="spacer-sm" />
        <button className="btn btn-ghost" disabled={busy} onClick={() => onPatch({ peak_severity: null })}>
          Not sure
        </button>
      </div>

      <div>
        <div className="field">
          <label htmlFor="edit-impact">How it affected you</label>
          <textarea
            id="edit-impact"
            className="input"
            maxLength={1000}
            value={impact}
            onChange={(e) => { setImpact(e.target.value); setNotesSaved(false); }}
          />
        </div>
        <div className="spacer-sm" />
        <div className="field">
          <label htmlFor="edit-symptom">Symptoms you noticed</label>
          <textarea
            id="edit-symptom"
            className="input"
            maxLength={1000}
            value={symptom}
            onChange={(e) => { setSymptom(e.target.value); setNotesSaved(false); }}
          />
        </div>
        <div className="spacer-sm" />
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => onPatch({ impact_note: impact, symptom_note: symptom }).then(() => setNotesSaved(true))}
        >
          {notesSaved ? "Notes saved" : "Save notes"}
        </button>
      </div>
    </div>
  );
}

function Treatments({
  flareId,
  treatments,
  onChanged,
  onError,
}: {
  flareId: string;
  treatments: TreatmentDTO[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/treatments/${id}`, { method: "DELETE" });
      if (res.status === 204) await onChanged();
      else onError("Check your connection and try again.");
    } catch {
      onError("Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h2>Treatments</h2>
      {treatments.length === 0 && !adding ? (
        <p className="muted">Add a treatment you tried during this flare.</p>
      ) : null}

      {treatments.map((t) =>
        editingId === t.id ? (
          <TreatmentForm
            key={t.id}
            flareId={flareId}
            treatment={t}
            onDone={async () => {
              setEditingId(null);
              await onChanged();
            }}
            onCancel={() => setEditingId(null)}
            onError={onError}
          />
        ) : (
          <div className="treat-item" key={t.id}>
            <div>
              <div className="name">{t.name}</div>
              <div className="muted">
                {treatmentStartText(t)}. {helpedText(t.helped)}.
              </div>
            </div>
            <div className="row">
              <button className="btn btn-ghost" onClick={() => setEditingId(t.id)}>
                Edit
              </button>
              <button
                className="btn btn-ghost"
                disabled={busyId === t.id}
                onClick={() => remove(t.id)}
                aria-label={`Remove ${t.name}`}
              >
                Remove
              </button>
            </div>
          </div>
        ),
      )}

      <div className="spacer-sm" />
      {adding ? (
        <TreatmentForm
          flareId={flareId}
          onDone={async () => {
            setAdding(false);
            await onChanged();
          }}
          onCancel={() => setAdding(false)}
          onError={onError}
        />
      ) : (
        <button className="btn btn-secondary" onClick={() => setAdding(true)}>
          Add a treatment
        </button>
      )}
    </div>
  );
}

function TreatmentForm({
  flareId,
  treatment,
  onDone,
  onCancel,
  onError,
}: {
  flareId: string;
  treatment?: TreatmentDTO;
  onDone: () => Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(treatment?.name ?? "");
  const [start, setStart] = useState<StartChoice>(
    treatment ? (treatment.startedOn ? "flare_onset" : "unsure") : "flare_onset",
  );
  const [aroundDate, setAroundDate] = useState(treatment?.startedOn ?? isoToday());
  const [helped, setHelped] = useState<Helped>((treatment?.helped as Helped) ?? "unsure");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      start_choice: start,
      helped,
    };
    if (start === "around_date") body.start_around_date = aroundDate;
    const url = treatment ? `/api/treatments/${treatment.id}` : `/api/flares/${flareId}/treatments`;
    const method = treatment ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await onDone();
      } else {
        onError("Check your connection and try again.");
        setBusy(false);
      }
    } catch {
      onError("Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ paddingTop: 8 }}>
      <div className="field">
        <label htmlFor="tf-name">Treatment</label>
        <input
          id="tf-name"
          className="input"
          placeholder="Naproxen"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <p className="section-label">When did you start it?</p>
        <div className="stack">
          {(Object.keys(START_LABELS) as StartChoice[]).map((c) => (
            <button
              key={c}
              className="btn btn-secondary"
              aria-pressed={start === c}
              onClick={() => setStart(c)}
            >
              {START_LABELS[c]}
            </button>
          ))}
        </div>
        {start === "around_date" ? (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="tf-date">Around this date</label>
            <input
              id="tf-date"
              className="input"
              type="date"
              max={isoToday()}
              value={aroundDate}
              onChange={(e) => setAroundDate(e.target.value)}
            />
          </div>
        ) : null}
      </div>
      <div>
        <p className="section-label">Did it help?</p>
        <div className="row">
          {(["yes", "no", "unsure"] as Helped[]).map((h) => (
            <button
              key={h}
              className="btn btn-secondary"
              aria-pressed={helped === h}
              onClick={() => setHelped(h)}
            >
              {helpedText(h)}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={save}>
          {busy ? "Saving" : "Save"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
