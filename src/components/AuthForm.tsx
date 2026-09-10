"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cta = mode === "signup" ? "Create account" : "Sign in";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/home");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Check your connection and try again.");
      setBusy(false);
    } catch {
      setError("Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {mode === "signup" ? (
          <span className="muted">At least 8 characters.</span>
        ) : null}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "One moment" : cta}
      </button>
    </form>
  );
}
