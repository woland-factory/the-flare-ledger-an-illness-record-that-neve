"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  flareId: string;
  onClosed: () => void;
  onDismiss: () => void;
};

type StartChoice = "flare_onset" | "few_days_in" | "around_date" | "unsure";
type Helped = "yes" | "no" | "unsure";

type Draft = {
  name: string;
  start_choice: StartChoice;
  start_around_date?: string;
  helped: Helped;
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

const START_LABELS: Record<StartChoice, string> = {
  flare_onset: "When the flare began",
  few_days_in: "A few days in",
  around_date: "Around a date",
  unsure: "Not sure",
};

const TOTAL_STEPS = 4;

export default function EndInterview({ flareId, onClosed, onDismiss }: Props) {
  const [step, setStep] = useState(1);

  // Step 1: end date
  const [endChoice, setEndChoice] = useState<"today" | "few_days_ago" | "around_date" | null>(null);
  const [endDate, setEndDate] = useState(isoToday());
  const [endDateMode, setEndDateMode] = useState(false);

  // Step 2: severity
  const [severity, setSeverity] = useState<number | null | "unset">("unset");

  // Step 3: treatments
  const [treatments, setTreatments] = useState<Draft[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    start_choice: "flare_onset",
    helped: "unsure",
  });

  // Step 4: notes
  const [impact, setImpact] = useState("");
  const [symptom, setSymptom] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function goEnd(choice: "today" | "few_days_ago") {
    setEndChoice(choice);
    setStep(2);
  }

  function goSeverity(value: number | null) {
    setSeverity(value);
    setStep(3);
  }

  function addDraft() {
    if (!draft.name.trim()) return;
    setTreatments((prev) => [...prev, draft]);
    setDraft({ name: "", start_choice: "flare_onset", helped: "unsure" });
    setAdding(false);
  }

  function removeTreatment(index: number) {
    setTreatments((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(skipNotes = false) {
    if (saving || !endChoice) return;
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      end_choice: endChoice,
      peak_severity: severity === "unset" ? null : severity,
    };
    if (endChoice === "around_date") body.end_around_date = endDate;
    if (!skipNotes && impact.trim()) body.impact_note = impact.trim();
    if (!skipNotes && symptom.trim()) body.symptom_note = symptom.trim();
    if (treatments.length) {
      body.treatments = treatments.map((t) => ({
        name: t.name.trim(),
        start_choice: t.start_choice,
        ...(t.start_choice === "around_date" ? { start_around_date: t.start_around_date } : {}),
        helped: t.helped,
      }));
    }
    try {
      const res = await fetch(`/api/flares/${flareId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onClosed();
        return;
      }
      if (res.status === 409) {
        setError("This flare is already closed. You can edit it.");
        setSaving(false);
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

  const title =
    step === 1
      ? "When did it end?"
      : step === 2
        ? "How bad did it get?"
        : step === 3
          ? "What did you try?"
          : "Anything else to remember?";

  return (
    <div
      className="sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <p className="step-meta">Step {step} of {TOTAL_STEPS}</p>
        <h2 tabIndex={-1} ref={headingRef}>
          {title}
        </h2>
        <div className="spacer-sm" />

        {step === 1 ? (
          endDateMode ? (
            <div className="stack">
              <div className="field">
                <label htmlFor="end-around">Around this date</label>
                <input
                  id="end-around"
                  className="input"
                  type="date"
                  max={isoToday()}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEndChoice("around_date");
                  setStep(2);
                }}
              >
                Continue
              </button>
              <button className="btn btn-ghost" onClick={() => setEndDateMode(false)}>
                Back
              </button>
            </div>
          ) : (
            <div className="stack">
              <button className="btn btn-secondary" onClick={() => goEnd("today")}>
                Today
              </button>
              <button className="btn btn-secondary" onClick={() => goEnd("few_days_ago")}>
                A few days ago
              </button>
              <button className="btn btn-secondary" onClick={() => setEndDateMode(true)}>
                Around a date
              </button>
            </div>
          )
        ) : null}

        {step === 2 ? (
          <div className="stack">
            <div>
              <div className="scale">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className="btn btn-secondary"
                    aria-pressed={severity === n}
                    aria-label={`Peak severity ${n} of 5`}
                    onClick={() => goSeverity(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="scale-ends">
                <span>Mild</span>
                <span>Severe</span>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => goSeverity(null)}>
              Not sure
            </button>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="stack">
            {treatments.length > 0 ? (
              <div>
                {treatments.map((t, i) => (
                  <div className="treat-item" key={i}>
                    <span className="name">{t.name}</span>
                    <button
                      className="btn btn-ghost"
                      onClick={() => removeTreatment(i)}
                      aria-label={`Remove ${t.name}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {adding ? (
              <div className="stack">
                <div className="field">
                  <label htmlFor="t-name">Treatment</label>
                  <input
                    id="t-name"
                    className="input"
                    placeholder="Naproxen"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div>
                  <p className="section-label">When did you start it?</p>
                  <div className="stack">
                    {(Object.keys(START_LABELS) as StartChoice[]).map((c) => (
                      <button
                        key={c}
                        className="btn btn-secondary"
                        aria-pressed={draft.start_choice === c}
                        onClick={() => setDraft({ ...draft, start_choice: c })}
                      >
                        {START_LABELS[c]}
                      </button>
                    ))}
                  </div>
                  {draft.start_choice === "around_date" ? (
                    <div className="field" style={{ marginTop: 12 }}>
                      <label htmlFor="t-date">Around this date</label>
                      <input
                        id="t-date"
                        className="input"
                        type="date"
                        max={isoToday()}
                        value={draft.start_around_date ?? isoToday()}
                        onChange={(e) => setDraft({ ...draft, start_around_date: e.target.value })}
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
                        aria-pressed={draft.helped === h}
                        onClick={() => setDraft({ ...draft, helped: h })}
                      >
                        {h === "yes" ? "Helped" : h === "no" ? "Didn't help" : "Not sure"}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" onClick={addDraft} disabled={!draft.name.trim()}>
                  Save treatment
                </button>
                <button className="btn btn-ghost" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            ) : treatments.length > 0 ? (
              <>
                <button className="btn btn-secondary" onClick={() => setAdding(true)}>
                  Add another
                </button>
                <button className="btn btn-primary" onClick={() => setStep(4)}>
                  Done
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => setAdding(true)}>
                  Add a treatment
                </button>
                <button className="btn btn-secondary" onClick={() => setStep(4)}>
                  I didn&apos;t try anything
                </button>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>
                  Back
                </button>
              </>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="stack">
            <div className="field">
              <label htmlFor="impact">How it affected you</label>
              <textarea
                id="impact"
                className="input"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="field">
              <label htmlFor="symptom">Symptoms you noticed</label>
              <textarea
                id="symptom"
                className="input"
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                maxLength={1000}
              />
            </div>
            <button className="btn btn-primary" onClick={() => submit(false)} disabled={saving}>
              {saving ? "Saving" : "Save and close"}
            </button>
            <button
              className="btn btn-secondary"
              disabled={saving}
              onClick={() => submit(true)}
            >
              Skip and close
            </button>
            <button className="btn btn-ghost" onClick={() => setStep(3)} disabled={saving}>
              Back
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="spacer-sm" />
        <button className="btn btn-ghost" onClick={onDismiss} disabled={saving}>
          Close
        </button>
      </div>
    </div>
  );
}
