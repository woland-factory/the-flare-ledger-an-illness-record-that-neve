"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import FlareStarter from "./FlareStarter";
import InstallPrompt from "./InstallPrompt";

type Step = "start" | "onset" | "success";

// The guided first run walks a brand-new user to one real logged flare. It
// wraps the real Start-a-flare control and onset sheet, ticking a two-item
// checklist as they go. It shows only until the first flare exists and never
// again for a returning user (the server stops rendering it once a flare is
// counted). It never blocks the primary action.
export default function FirstRun() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("start");
  const [hidden, setHidden] = useState(false);

  // Capture once on mount whether this device already finished or skipped the
  // guide, so a fresh mount that still sees zero flares does not flash it again.
  const [skipped] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("fl_firstrun_done") === "1";
    } catch {
      return false;
    }
  });

  function finish() {
    try {
      localStorage.setItem("fl_firstrun_done", "1");
    } catch {
      // A blocked storage just means the guide may reappear until the server
      // sees the new flare. Harmless.
    }
    // Hide right away so a refresh that still sees zero flares does not keep
    // this same instance on screen.
    setHidden(true);
    router.refresh();
  }

  // Once skipped or finished, the guide steps out of the way but the real
  // primary action stays live: a plain Start-a-flare control, never a dead end.
  if (skipped || hidden) return <FlareStarter />;

  if (step === "success") {
    return (
      <div className="card firstrun">
        <h2>That is your first flare</h2>
        <p className="muted">Close it when it ends. The interview takes under a minute.</p>
        <div className="spacer-sm" />
        <InstallPrompt />
        <button className="btn btn-primary" onClick={finish}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="card firstrun">
      <ol className="firstrun-steps">
        <li className={step !== "start" ? "is-done" : ""}>Start a flare.</li>
        <li>Say when it began.</li>
      </ol>
      <div className="spacer-sm" />
      <div className={step === "start" ? "firstrun-target" : ""}>
        <FlareStarter
          onStarted={() => setStep("onset")}
          onSaved={() => setStep("success")}
        />
      </div>
      <div className="spacer-sm" />
      <button className="btn btn-ghost" onClick={finish}>
        Skip
      </button>
    </div>
  );
}
