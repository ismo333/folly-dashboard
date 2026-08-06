"use client";

import { FormEvent, useState } from "react";

export function AuthScreen() {
  const [mode, setMode] = useState<"sign-in" | "join">("sign-in");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const rememberMe = form.get("rememberMe") === "on";

    try {
      if (mode === "sign-in") {
        const result = await fetch("/api/auth/sign-in", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, rememberMe })
        });
        const body = await result.json();
        if (!result.ok) throw new Error(body.error);
      } else {
        const displayName = String(form.get("displayName") ?? "");
        const inviteCode = String(form.get("inviteCode") ?? "");
        const result = await fetch("/api/auth/sign-up", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, displayName, inviteCode })
        });
        const body = await result.json();
        if (!result.ok) throw new Error(body.error);
      }
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <header className="auth-brand">
        <div className="auth-mark" aria-hidden="true">folly</div>
        <p className="eyebrow">Folly Productions</p>
      </header>
      <section className="auth-panel">
        <h1 className="two-line-headline">
          <span>See what’s on.</span>
          <i>Tell us what you thought.</i>
        </h1>
        <p className="auth-intro">
          A private notebook for theatre scouting in New York and London.
        </p>
        <div className="segmented" aria-label="Account action">
          <button className={mode === "sign-in" ? "active" : ""} onClick={() => setMode("sign-in")}>
            Sign in
          </button>
          <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
            Join with invite
          </button>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "join" && (
            <label>
              Your name
              <input name="displayName" required minLength={2} autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <span className="password-input">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "sign-in" ? 8 : 10}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" />
                  <circle cx="12" cy="12" r="2.5" />
                  {showPassword && <path d="m4 4 16 16" />}
                </svg>
              </button>
            </span>
          </label>
          {mode === "sign-in" && (
            <label className="remember-me">
              <input name="rememberMe" type="checkbox" defaultChecked />
              <span>Remember me</span>
            </label>
          )}
          {mode === "join" && (
            <label>
              Folly invite code
              <input name="inviteCode" required minLength={6} autoComplete="off" />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>
            {busy ? "One moment…" : mode === "sign-in" ? "Enter Folly" : "Create account"}
          </button>
        </form>
      </section>
      <footer className="auth-footer">
        <div className="auth-horse-track" aria-hidden="true">
          <div className="auth-horse-runner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/folly-horse.png" alt="" />
          </div>
        </div>
        <p>Based in London &amp; New York</p>
      </footer>
    </main>
  );
}
