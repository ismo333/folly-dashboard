"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

type AuthMode = "sign-in" | "join" | "sent" | "confirm";

export function AuthScreen({ initialLoginToken = "" }: { initialLoginToken?: string }) {
  const [mode, setMode] = useState<AuthMode>(initialLoginToken ? "confirm" : "sign-in");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [sentTo, setSentTo] = useState("");
  const [devLink, setDevLink] = useState("");
  const [loginToken] = useState(initialLoginToken);

  function changeMode(next: AuthMode) {
    setMode(next);
    setError("");
    setDevLink("");
  }

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const displayName = String(form.get("displayName") ?? "");
    try {
      const result = await fetch("/api/auth/email-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          email,
          rememberMe,
          ...(mode === "join" ? { displayName } : {})
        })
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      setSentTo(email);
      setMode("sent");
      setDevLink(body.devLink ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the link.");
    }
    setBusy(false);
  }

  async function confirmLink() {
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/auth/verify-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: loginToken })
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
      setBusy(false);
    }
  }

  function startOver() {
    window.history.replaceState({}, "", "/");
    changeMode("sign-in");
  }

  return (
    <main className="auth-shell">
      <SiteHeader />
      <section className="auth-panel">
        <h1 className="two-line-headline">
          <span>See what’s on.</span>
          <i>Tell us what you thought.</i>
        </h1>
        <p className="auth-intro">
          A private notebook for theatre scouting in New York and London.
        </p>
        {(mode === "sign-in" || mode === "join") && (
          <>
            <div className="segmented" aria-label="Account action">
              <button className={mode === "sign-in" ? "active" : ""} onClick={() => changeMode("sign-in")}>
                Sign in
              </button>
              <button className={mode === "join" ? "active" : ""} onClick={() => changeMode("join")}>
                New here
              </button>
            </div>
            <form onSubmit={requestLink} className="auth-form">
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
              <label className="remember-me">
                <input
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember me for 30 days</span>
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button" disabled={busy}>
                {busy ? "One moment…" : "Email me a sign-in link"}
              </button>
              <p className="auth-form-intro">
                No password needed — we’ll email you a link that signs you straight in.
              </p>
              <Link className="text-button auth-back" href="/">
                ← Just browsing? Back to the listings
              </Link>
            </form>
          </>
        )}
        {mode === "sent" && (
          <div className="auth-form">
            <p className="form-success" role="status">
              Check your email. We’ve sent a sign-in link to <strong>{sentTo}</strong>.
              It works once and expires in 15 minutes.
            </p>
            {devLink && (
              <p className="auth-form-intro">
                Email isn’t set up on this computer, so here’s the link:{" "}
                <a href={devLink}>open sign-in link</a>
              </p>
            )}
            <button type="button" className="text-button auth-back" onClick={() => changeMode("sign-in")}>
              Use a different email
            </button>
          </div>
        )}
        {mode === "confirm" && (
          <div className="auth-form">
            {error ? (
              <>
                <p className="form-error" role="alert">{error}</p>
                <button type="button" className="primary-button" onClick={startOver}>
                  Get a new link
                </button>
              </>
            ) : (
              <button type="button" className="primary-button" onClick={confirmLink} disabled={busy}>
                {busy ? "Signing you in…" : "Continue to Folly"}
              </button>
            )}
          </div>
        )}
      </section>
      <SiteFooter className="auth-footer" />
    </main>
  );
}
