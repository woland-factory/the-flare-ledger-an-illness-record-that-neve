"use client";

import { useEffect, useState } from "react";

// The browser fires this before offering its own install UI. We keep the event
// and offer our own single, dismissible banner instead.
type InstallEvent = Event & { prompt: () => Promise<void> };

const DISMISS_KEY = "fl_install_dismissed";

// A single dismissible offer to add the app to the home screen. It appears only
// once the browser signals installability, never blocks anything, and never
// returns after the user dismisses, installs, or is already running installed.
export default function InstallPrompt({
  firstRunActive = false,
}: {
  firstRunActive?: boolean;
}) {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") {
        setHidden(true);
        return;
      }
    } catch {
      // Ignore a blocked storage; the banner simply may reappear later.
    }
    if (window.matchMedia?.("(display-mode: standalone)")?.matches) {
      setHidden(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      remember();
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function remember() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Best-effort.
    }
  }

  if (firstRunActive || hidden || !deferred) return null;

  async function add() {
    const event = deferred;
    setHidden(true);
    remember();
    try {
      await event?.prompt();
    } catch {
      // The user can install later from the browser menu.
    }
  }

  function dismiss() {
    setHidden(true);
    remember();
  }

  return (
    <div className="card install-banner">
      <p className="install-copy">Add Flare Ledger to your home screen.</p>
      <div className="row">
        <button className="btn btn-primary" onClick={add}>
          Add
        </button>
        <button className="btn btn-secondary" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
