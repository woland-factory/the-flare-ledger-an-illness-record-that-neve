"use client";

import { useEffect } from "react";

// Registers the hand-written service worker so the app shell loads offline and
// meets browser install criteria. It renders nothing and uses no timer.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration can fail in unsupported or private contexts. The app works
      // without it; only offline shell caching is lost.
    });
  }, []);
  return null;
}
