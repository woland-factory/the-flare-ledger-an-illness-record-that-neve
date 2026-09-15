"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AppointmentCreator() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visitDate, setVisitDate] = useState(isoToday());
  const [specialty, setSpecialty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { visit_date: visitDate };
      const trimmed = specialty.trim();
      if (trimmed) body.specialty = trimmed;
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        // Stay in the in-flight state while the correction pass loads.
        router.push(`/appointments/${data.appointment.id}`);
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

  return (
    <>
      <button
        className="btn btn-primary"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Doctor visit coming up
      </button>
      {open ? (
        <div
          className="sheet-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="When is your visit?"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setOpen(false);
          }}
        >
          <div className="sheet">
            <div className="sheet-handle" />
            <h2>When is your visit?</h2>
            <p className="muted">Your timeline drafts itself from your flares.</p>
            <div className="spacer-sm" />
            <div className="stack">
              <div className="field">
                <label htmlFor="visit-date">Visit date</label>
                <input
                  id="visit-date"
                  className="input"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="visit-specialty">Specialty, if you like</label>
                <input
                  id="visit-specialty"
                  className="input"
                  placeholder="Rheumatology"
                  maxLength={80}
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" disabled={saving} onClick={draft}>
                {saving ? "Drafting" : "Draft my timeline"}
              </button>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
