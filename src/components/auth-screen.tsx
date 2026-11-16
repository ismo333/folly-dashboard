"use client";

import { FormEvent, useState } from "react";
import { FOLLY_PRODUCTIONS_URL } from "@/lib/links";

type AuthMode = "sign-in" | "join" | "forgot" | "reset";

export function AuthScreen({ initialResetToken = "" }: { initialResetToken?: string }) {
  const [mode, setMode] = useState<AuthMode>(initialResetToken ? "reset" : "sign-in");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [resetToken] = useState(initialResetToken);

  function changeMode(next: AuthMode) {
    setMode(next);
    setError("");
    setNotice("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      if (mode === "forgot") {
        const result = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email })
        });
        const body = await result.json();
        if (!result.ok) throw new Error(body.error);
        setNotice(body.emailConfigured
          ? "If that email belongs to an account, a reset link is on its way."
          : "Password-reset email is not configured yet. Please contact a Folly owner.");
        setBusy(false);
        return;
      }
      if (mode === "reset") {
        const confirmation = String(form.get("passwordConfirmation") ?? "");
        if (password !== confirmation) throw new Error("The passwords do not match.");
        const result = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: resetToken, password })
        });
        const body = await result.json();
        if (!result.ok) throw new Error(body.error);
        window.history.replaceState({}, "", "/");
        changeMode("sign-in");
        setNotice("Your password has been reset. Sign in with the new password.");
        setBusy(false);
        return;
      }
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
        <a
          className="brand-home-link"
          href={FOLLY_PRODUCTIONS_URL}
          aria-label="Folly Productions website"
        >
          <span className="auth-mark" aria-hidden="true">folly</span>
          <span className="eyebrow">Folly Productions</span>
        </a>
      </header>
      <section className="auth-panel">
        <h1 className="two-line-headline">
          <span>See what’s on.</span>
          <i>Tell us what you thought.</i>
        </h1>
        <p className="auth-intro">
          A private notebook for theatre scouting in New York and London.
        </p>
        {(mode === "sign-in" || mode === "join") && (
          <div className="segmented" aria-label="Account action">
            <button className={mode === "sign-in" ? "active" : ""} onClick={() => changeMode("sign-in")}>
              Sign in
            </button>
            <button className={mode === "join" ? "active" : ""} onClick={() => changeMode("join")}>
              Join with invite
            </button>
          </div>
        )}
        <form onSubmit={submit} className="auth-form">
          {mode === "join" && (
            <label>
              Your name
              <input name="displayName" required minLength={2} autoComplete="name" />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
          )}
          {mode === "forgot" && (
            <p className="auth-form-intro">
              Enter your account email and we’ll send a one-time reset link.
            </p>
          )}
          {mode !== "forgot" && (
            <label>
              {mode === "reset" ? "New password" : "Password"}
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
          )}
          {mode === "reset" && (
            <label>
              Confirm new password
              <input name="passwordConfirmation" type="password" required minLength={10} autoComplete="new-password" />
            </label>
          )}
          {mode === "sign-in" && (
            <div className="sign-in-options">
              <label className="remember-me">
                <input
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember me for 30 days</span>
              </label>
              <button type="button" className="text-button" onClick={() => changeMode("forgot")}>
                Forgot password?
              </button>
            </div>
          )}
          {mode === "join" && (
            <label>
              Folly invite code
              <input name="inviteCode" required minLength={6} autoComplete="off" />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-success" role="status">{notice}</p>}
          <button className="primary-button" disabled={busy}>
            {busy
              ? "One moment…"
              : mode === "sign-in"
                ? "Enter Folly"
                : mode === "join"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Reset password"}
          </button>
          {(mode === "forgot" || mode === "reset") && (
            <button type="button" className="text-button auth-back" onClick={() => changeMode("sign-in")}>
              Back to sign in
            </button>
          )}
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
