"use client";

import Link from "next/link";
import { useState } from "react";
import { parseIsoDate } from "@/lib/date";
import { severityText } from "@/lib/display";
import {
  coverageText,
  flareRangeText,
  headlineText,
  treatmentLineText,
  visitLineText,
  type AppointmentDTO,
  type SnapshotFlare,
} from "@/lib/reconstruction";

type PatchFn = (op: Record<string, unknown>) => Promise<string | null>;

type SheetState =
  | { kind: "visit" }
  | { kind: "flare"; flare: SnapshotFlare }
  | { kind: "add" }
  | null;

export default function SnapshotEditor({
  appointment: initial,
  todayIso,
}: {
  appointment: AppointmentDTO;
  todayIso: string;
}) {
  const [appt, setAppt] = useState(initial);
  const [sheet, setSheet] = useState<SheetState>(null);
  const today = parseIsoDate(todayIso) ?? new Date(todayIso);

  // One place to send a correction. The server answers with the whole
  // appointment, so the headline re-renders from the new snapshot at once.
  const patch: PatchFn = async (op) => {
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
      });
      if (res.ok) {
        setAppt((await res.json()).appointment);
        return null;
      }
      const data = await res.json().catch(() => null);
      return data?.error?.message ?? "Check your connection and try again.";
    } catch {
      return "Check your connection and try again.";
    }
  };

  const flares = appt.snapshot.flares;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="muted">{visitLineText(appt.visitDate, appt.specialty)}</span>
        <button className="btn btn-ghost" onClick={() => setSheet({ kind: "visit" })}>
          Edit visit
        </button>
      </div>
      <h1>Your draft timeline</h1>
      <p className="lede">Fix anything wrong. Then print one page.</p>

      <div className="card">
        <p className="headline">{headlineText(appt.snapshot, today)}</p>
        <p className="muted" style={{ margin: 0 }}>
          {coverageText(appt.snapshot)}
        </p>
      </div>

      <div className="spacer" />

      {flares.length > 0 ? (
        <div className="card">
          {flares.map((f) => (
            <button
              key={f.key}
              className="snap-row"
              onClick={() => setSheet({ kind: "flare", flare: f })}
            >
              <span style={{ fontWeight: 600 }}>
                {flareRangeText(f, today)}
                {f.source === "added" ? (
                  <>
                    {" "}
                    <span className="pill pill-open">Added</span>
                  </>
                ) : null}
              </span>
              <span className="muted snap-line">{severityText(f.peakSeverity)}</span>
              {f.treatments.map((t, i) => (
                <span className="muted snap-line" key={i}>
                  {treatmentLineText(t, f)}
                </span>
              ))}
              {f.note ? <span className="muted snap-line">{f.note}</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="card empty">
          <p className="lede" style={{ margin: 0 }}>
            A quiet stretch. Add a missed flare if one belongs here.
          </p>
        </div>
      )}

      <div className="spacer-sm" />
      <button className="btn btn-secondary" onClick={() => setSheet({ kind: "add" })}>
        Add a missed flare
      </button>
      <div className="spacer" />
      <Link className="btn btn-primary" href={`/appointments/${appt.id}/print`}>
        Print one page
      </Link>

      {sheet?.kind === "visit" ? (
        <VisitSheet appt={appt} onPatch={patch} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === "flare" ? (
        <FlareSheet
          key={sheet.flare.key}
          flare={sheet.flare}
          todayIso={todayIso}
          onPatch={patch}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === "add" ? (
        <FlareSheet todayIso={todayIso} onPatch={patch} onClose={() => setSheet(null)} />
      ) : null}
    </>
  );
}

function VisitSheet({
  appt,
  onPatch,
  onClose,
}: {
  appt: AppointmentDTO;
  onPatch: PatchFn;
  onClose: () => void;
}) {
  const [visitDate, setVisitDate] = useState(appt.visitDate);
  const [specialty, setSpecialty] = useState(appt.specialty ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const trimmed = specialty.trim();
    const err = await onPatch({
      op: "set_visit",
      visit_date: visitDate,
      specialty: trimmed ? trimmed : null,
    });
    if (err) {
      setError(err);
      setSaving(false);
    } else {
      onClose();
    }
  }

  return (
    <Sheet label="Edit visit" onClose={onClose} busy={saving}>
      <div className="stack">
        <div className="field">
          <label htmlFor="vs-date">Visit date</label>
          <input
            id="vs-date"
            className="input"
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vs-specialty">Specialty, if you like</label>
          <input
            id="vs-specialty"
            className="input"
            placeholder="Rheumatology"
            maxLength={80}
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? "Saving" : "Save visit"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

type EditableTreatment = {
  name: string;
  startedOn: string;
  approx: boolean;
  helped: "yes" | "no" | "unsure" | null;
};

// One sheet edits a drafted or added flare, or adds a missed one. Every value
// arrives pre-filled; the user taps to fix, never re-types what is known.
function FlareSheet({
  flare,
  todayIso,
  onPatch,
  onClose,
}: {
  flare?: SnapshotFlare;
  todayIso: string;
  onPatch: PatchFn;
  onClose: () => void;
}) {
  const adding = !flare;
  const [onsetDate, setOnsetDate] = useState(flare?.onsetDate ?? "");
  const [onsetApprox, setOnsetApprox] = useState(flare?.onsetPrecision === "approx");
  const [stillGoing, setStillGoing] = useState(flare ? flare.endDate === null : true);
  const [endDate, setEndDate] = useState(flare?.endDate ?? todayIso);
  const [endApprox, setEndApprox] = useState(flare?.endPrecision === "approx");
  const [severity, setSeverity] = useState<number | null>(flare?.peakSeverity ?? null);
  const [note, setNote] = useState(flare?.note ?? "");
  const [treatments, setTreatments] = useState<EditableTreatment[]>(
    (flare?.treatments ?? []).map((t) => ({
      name: t.name,
      startedOn: t.startedOn ?? "",
      approx: t.startedPrecision === "approx",
      helped: t.helped,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    onsetDate.length > 0 && treatments.every((t) => t.name.trim().length > 0);

  function setTreatment(index: number, change: Partial<EditableTreatment>) {
    setTreatments((list) =>
      list.map((t, i) => (i === index ? { ...t, ...change } : t)),
    );
  }

  async function save() {
    if (saving || !canSave) return;
    setSaving(true);
    setError(null);
    const fields: Record<string, unknown> = {
      onset_date: onsetDate,
      onset_precision: onsetApprox ? "approx" : "exact",
      end_date: stillGoing ? null : endDate,
      peak_severity: severity,
      note: note.trim() ? note.trim() : null,
      treatments: treatments.map((t) => ({
        name: t.name.trim(),
        startedOn: t.startedOn ? t.startedOn : null,
        startedPrecision: t.startedOn ? (t.approx ? "approx" : "exact") : null,
        helped: t.helped,
      })),
    };
    if (!stillGoing) fields.end_precision = endApprox ? "approx" : "exact";
    const op = flare
      ? { op: "set_flare", key: flare.key, ...fields }
      : { op: "add_flare", ...fields };
    const err = await onPatch(op);
    if (err) {
      setError(err);
      setSaving(false);
    } else {
      onClose();
    }
  }

  async function remove() {
    if (saving || !flare) return;
    setSaving(true);
    setError(null);
    const err = await onPatch({ op: "remove_flare", key: flare.key });
    if (err) {
      setError(err);
      setSaving(false);
    } else {
      onClose();
    }
  }

  return (
    <Sheet
      label={adding ? "Add a missed flare" : "Fix this flare"}
      onClose={onClose}
      busy={saving}
    >
      <div className="stack">
        <div className="field">
          <label htmlFor="fs-onset">Started</label>
          <input
            id="fs-onset"
            className="input"
            type="date"
            max={todayIso}
            value={onsetDate}
            onChange={(e) => setOnsetDate(e.target.value)}
          />
        </div>
        <button
          className="btn btn-secondary"
          aria-pressed={onsetApprox}
          onClick={() => setOnsetApprox((v) => !v)}
        >
          Around then
        </button>

        <button
          className="btn btn-secondary"
          aria-pressed={stillGoing}
          onClick={() => setStillGoing((v) => !v)}
        >
          Still going
        </button>
        {!stillGoing ? (
          <>
            <div className="field">
              <label htmlFor="fs-end">Ended</label>
              <input
                id="fs-end"
                className="input"
                type="date"
                max={todayIso}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button
              className="btn btn-secondary"
              aria-pressed={endApprox}
              onClick={() => setEndApprox((v) => !v)}
            >
              Around the end
            </button>
          </>
        ) : null}

        <div>
          <p className="section-label">{severityText(severity)}</p>
          <div className="scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className="btn btn-secondary"
                aria-pressed={severity === n}
                aria-label={`Peak severity ${n} of 5`}
                onClick={() => setSeverity(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="scale-ends">
            <span>Mild</span>
            <span>Severe</span>
          </div>
          <button className="btn btn-ghost" onClick={() => setSeverity(null)}>
            Not sure
          </button>
        </div>

        <div>
          <p className="section-label">Treatments</p>
          <div className="stack">
            {treatments.map((t, i) => (
              <div className="stack" key={i} style={{ gap: 8 }}>
                <div className="row">
                  <input
                    className="input"
                    aria-label={`Treatment ${i + 1} name`}
                    placeholder="Naproxen"
                    maxLength={120}
                    value={t.name}
                    onChange={(e) => setTreatment(i, { name: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-ghost"
                    aria-label={`Remove treatment ${i + 1}`}
                    onClick={() =>
                      setTreatments((list) => list.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="row">
                  <input
                    className="input"
                    aria-label={`Treatment ${i + 1} start date`}
                    type="date"
                    max={todayIso}
                    value={t.startedOn}
                    onChange={(e) => setTreatment(i, { startedOn: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-secondary"
                    aria-pressed={t.approx}
                    disabled={!t.startedOn}
                    onClick={() => setTreatment(i, { approx: !t.approx })}
                    style={{ flex: "0 0 auto", width: "auto", paddingInline: 12 }}
                  >
                    Around then
                  </button>
                </div>
                <div className="row">
                  {(["yes", "no", "unsure"] as const).map((h) => (
                    <button
                      key={h}
                      className="btn btn-secondary"
                      aria-pressed={t.helped === h}
                      onClick={() => setTreatment(i, { helped: h })}
                    >
                      {h === "yes" ? "Helped" : h === "no" ? "Didn't help" : "Not sure"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {treatments.length < 20 ? (
              <button
                className="btn btn-ghost"
                onClick={() =>
                  setTreatments((list) => [
                    ...list,
                    { name: "", startedOn: "", approx: false, helped: "unsure" },
                  ])
                }
              >
                Add a treatment
              </button>
            ) : null}
          </div>
        </div>

        <div className="field">
          <label htmlFor="fs-note">Note for the page</label>
          <textarea
            id="fs-note"
            className="input"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" disabled={saving || !canSave} onClick={save}>
          {saving ? "Saving" : "Save"}
        </button>
        {flare?.source === "added" ? (
          <button className="btn btn-ghost" disabled={saving} onClick={remove}>
            Remove this flare
          </button>
        ) : null}
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function Sheet({
  label,
  busy,
  onClose,
  children,
}: {
  label: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="sheet sheet-scroll">
        <div className="sheet-handle" />
        <h2>{label}</h2>
        <div className="spacer-sm" />
        {children}
      </div>
    </div>
  );
}
