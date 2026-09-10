"use client";

import { useEffect, useState } from "react";

type Props = {
  flareId: string | null;
  editing?: boolean;
  onSaved: () => void;
  onClose: () => void;
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function OnsetSheet({ flareId, editing, onSaved, onClose }: Props) {
  const [mode, setMode] = useState<"choices" | "date">("choices");
  const [aroundDate, setAroundDate] = useState(isoToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When adjusting an existing flare, preselect the persisted onset date.
  useEffect(() => {
    if (!editing || !flareId) return;
    let active = true;
    fetch(`/api/flares/${flareId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.flare?.onsetDate) setAroundDate(data.flare.onsetDate);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [editing, flareId]);

  async function choose(choice: string, date?: string) {
    if (!flareId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/flares/${flareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          date ? { onset_choice: choice, around_date: date } : { onset_choice: choice },
        ),
      });
      if (res.ok) {
        onSaved();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Check your connection and try again.");
      setSaving(false);
    } catch {
      setError("Check your connection and try again.");
      setSaving(false);
    }
  }

  const ready = Boolean(flareId);

  return (
    <div
      className="sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="When did it start?"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <h2>When did it start?</h2>
        <p className="muted">{ready ? "Pick the closest answer." : "Getting ready…"}</p>
        <div className="spacer-sm" />

        {mode === "choices" ? (
          <div className="stack">
            <button
              className="btn btn-secondary"
              disabled={!ready || saving}
              onClick={() => choose("today")}
            >
              Today
            </button>
            <button
              className="btn btn-secondary"
              disabled={!ready || saving}
              onClick={() => choose("few_days_ago")}
            >
              A few days ago
            </button>
            <button
              className="btn btn-secondary"
              disabled={!ready || saving}
              onClick={() => setMode("date")}
            >
              Around a date
            </button>
          </div>
        ) : (
          <div className="stack">
            <div className="field">
              <label htmlFor="around">Around this date</label>
              <input
                id="around"
                className="input"
                type="date"
                max={isoToday()}
                value={aroundDate}
                onChange={(e) => setAroundDate(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={!ready || saving}
              onClick={() => choose("around_date", aroundDate)}
            >
              {saving ? "Saving" : "Save onset"}
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("choices")}>
              Back
            </button>
          </div>
        )}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
