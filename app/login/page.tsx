"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeNextPath } from "@/lib/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

type Mode = "signin" | "signup" | "reset";

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"));

  useEffect(() => {
    const requested = searchParams.get("mode");
    if (requested === "signin" || requested === "signup" || requested === "reset") {
      setMode(requested);
      setError(null);
      setNotice(null);
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createSupabaseBrowser();

    if (mode === "reset") {
      const redirectTo = new URL(
        "/auth/callback?next=/reset-password",
        window.location.origin
      ).toString();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      setLoading(false);
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setNotice(
        "Password reset email sent. Open the link in your inbox to choose a new password."
      );
      return;
    }

    if (mode === "signup") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        setLoading(false);
        return;
      }
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      });
      setLoading(false);
      if (signupError) {
        setError(signupError.message);
        return;
      }
      if (!data.session) {
        setNotice(
          "Account created. Confirm your email if prompted, then sign in to open the playground."
        );
        setMode("signin");
        return;
      }
      router.push(nextPath);
      router.refresh();
      return;
    }

    const { error: signinError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signinError) {
      setError(
        signinError.message === "Invalid login credentials"
          ? "Invalid email or password."
          : signinError.message
      );
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  function switchMode(target: Mode) {
    setMode(target);
    setError(null);
    setNotice(null);
  }

  const heading =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Open the playground."
        : "Reset password";

  const italic =
    mode === "signin" ? "Sign in" : mode === "signup" ? "playground." : "Reset password";

  const description =
    mode === "signin"
      ? "Welcome back. The dashboard, your audiences, and the playground are one click in."
      : mode === "signup"
        ? "Create an account in 10 seconds. Free playground, free custom audiences, no card."
        : "We'll email you a secure link to set a new password.";

  const submitLabel =
    loading
      ? mode === "signin"
        ? "Signing in…"
        : mode === "signup"
          ? "Creating…"
          : "Sending…"
      : mode === "signin"
        ? "Sign in"
        : mode === "signup"
          ? "Create account"
          : "Send reset link";

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px 96px",
      }}
    >
      <div className="atharias-auth-card">
        <div className="atharias-auth-eyebrow">
          <span className="mono-label" style={{ color: "var(--text-tertiary)" }}>
            ATHARIAS
          </span>
          <span
            className="mono-label"
            style={{
              color: "var(--text-tertiary)",
              opacity: 0.7,
            }}
          >
            {mode === "signin"
              ? "ACCOUNT"
              : mode === "signup"
                ? "FREE TIER"
                : "PASSWORD RESET"}
          </span>
        </div>

        <h1 className="atharias-auth-title">
          {mode === "signup" ? (
            <>
              Open the{" "}
              <span style={{ fontStyle: "italic" }}>playground.</span>
            </>
          ) : mode === "signin" ? (
            <>
              <span style={{ fontStyle: "italic" }}>Sign in.</span>
            </>
          ) : (
            <>
              Reset <span style={{ fontStyle: "italic" }}>password.</span>
            </>
          )}
        </h1>

        <p className="atharias-auth-sub">{description}</p>

        <form onSubmit={handleSubmit} className="atharias-auth-form" noValidate>
          <label htmlFor="email" className="atharias-auth-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            spellCheck={false}
            autoComplete="email"
            className="atharias-auth-input"
          />

          {mode !== "reset" ? (
            <>
              <label
                htmlFor="password"
                className="atharias-auth-label"
                style={{ marginTop: 16 }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "Password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="atharias-auth-input"
              />
            </>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="atharias-auth-submit"
            aria-busy={loading}
          >
            {submitLabel}
          </button>
        </form>

        {error ? (
          <div className="atharias-auth-banner atharias-auth-banner--error" role="alert">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="atharias-auth-banner atharias-auth-banner--notice">
            {notice}
          </div>
        ) : null}

        <div className="atharias-auth-policy">
          <span className="mono-label">ACCESS POLICY</span>
          <p style={{ marginTop: 6 }}>
            {mode === "signup"
              ? "New accounts unlock the dashboard, custom audience uploads, and 5 free playground sims/day right after sign-up. API key access is reviewed manually."
              : mode === "signin"
                ? "Approved operators get direct API key access. Everyone else uses the dashboard and playground."
                : "Recovery emails route back through the app callback to set a new password."}
          </p>
        </div>

        <div className="atharias-auth-footer">
          {mode === "signin" ? (
            <>
              <span>Don&rsquo;t have an account? </span>
              <button type="button" onClick={() => switchMode("signup")} className="atharias-auth-link">
                Create one
              </button>
              <span style={{ color: "var(--text-tertiary)", margin: "0 10px" }}>·</span>
              <button type="button" onClick={() => switchMode("reset")} className="atharias-auth-link">
                Forgot password
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              <span>Already have one? </span>
              <button type="button" onClick={() => switchMode("signin")} className="atharias-auth-link">
                Sign in
              </button>
            </>
          ) : (
            <>
              <span>Remembered it? </span>
              <button type="button" onClick={() => switchMode("signin")} className="atharias-auth-link">
                Back to sign in
              </button>
            </>
          )}
        </div>

        <Link href="/" className="atharias-auth-back">
          ← Back to home
        </Link>
      </div>

      <style jsx global>{`
        .atharias-auth-card {
          width: 100%;
          max-width: 460px;
          padding: 36px 36px 32px;
          background: var(--bg-element, #ffffff);
          border-radius: 24px;
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.04),
            0 1px 3px rgba(0, 0, 0, 0.04),
            0 12px 36px rgba(0, 0, 0, 0.05);
        }
        .atharias-auth-eyebrow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .atharias-auth-title {
          font-family: var(--font-display), Georgia, serif;
          font-size: clamp(34px, 4vw, 44px);
          line-height: 1.05;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          margin-top: 14px;
          text-wrap: balance;
        }
        .atharias-auth-sub {
          color: var(--text-secondary);
          font-size: 15px;
          line-height: 1.6;
          margin-top: 14px;
          text-wrap: pretty;
        }
        .atharias-auth-form {
          display: flex;
          flex-direction: column;
          margin-top: 24px;
        }
        .atharias-auth-label {
          font-family: var(--font-data), monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-tertiary);
          margin-bottom: 8px;
        }
        .atharias-auth-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          background: var(--bg-subtle);
          color: var(--text-primary);
          font-size: 16px;
          line-height: 1.4;
          border: none;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
          transition: box-shadow 160ms cubic-bezier(0.215, 0.61, 0.355, 1);
          font-family: inherit;
        }
        .atharias-auth-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px var(--ink, #141413);
          background: var(--bg-element, #ffffff);
        }
        .atharias-auth-input::placeholder {
          color: var(--text-tertiary);
        }
        .atharias-auth-submit {
          margin-top: 22px;
          padding: 14px 20px;
          border-radius: 999px;
          background: var(--ink, #141413);
          color: var(--butter-deep, #e8d27a);
          font-size: 15px;
          font-weight: 500;
          font-family: inherit;
          border: none;
          cursor: pointer;
          transition:
            background 160ms cubic-bezier(0.215, 0.61, 0.355, 1),
            transform 80ms cubic-bezier(0.215, 0.61, 0.355, 1);
          font-variant-numeric: tabular-nums;
        }
        @media (hover: hover) and (pointer: fine) {
          .atharias-auth-submit:hover {
            background: #1f1f1d;
          }
        }
        .atharias-auth-submit:active {
          transform: scale(0.99);
        }
        .atharias-auth-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .atharias-auth-submit:focus-visible {
          outline: 2px solid var(--ink, #141413);
          outline-offset: 3px;
        }
        .atharias-auth-banner {
          margin-top: 18px;
          padding: 11px 14px;
          font-size: 13px;
          line-height: 1.5;
          border-radius: 12px;
        }
        .atharias-auth-banner--error {
          background: rgba(249, 112, 102, 0.08);
          color: #b1311a;
          box-shadow: inset 0 0 0 1px rgba(249, 112, 102, 0.2);
        }
        .atharias-auth-banner--notice {
          background: rgba(52, 211, 153, 0.08);
          color: #166f4d;
          box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.2);
        }
        .atharias-auth-policy {
          margin-top: 24px;
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--bg-subtle);
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--text-secondary);
        }
        .atharias-auth-footer {
          margin-top: 22px;
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.6;
        }
        .atharias-auth-link {
          background: none;
          border: none;
          padding: 0;
          color: var(--text-primary);
          text-decoration: underline;
          text-underline-offset: 3px;
          font-family: inherit;
          font-size: inherit;
          cursor: pointer;
          transition: color 160ms cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .atharias-auth-link:hover {
            color: var(--ink, #141413);
          }
        }
        .atharias-auth-link:focus-visible {
          outline: 2px solid var(--ink, #141413);
          outline-offset: 3px;
          border-radius: 4px;
        }
        .atharias-auth-back {
          display: inline-block;
          margin-top: 18px;
          font-size: 12px;
          color: var(--text-tertiary);
          font-family: var(--font-data), monospace;
          letter-spacing: 0.04em;
          text-decoration: none;
        }
        @media (hover: hover) and (pointer: fine) {
          .atharias-auth-back:hover {
            color: var(--text-primary);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .atharias-auth-submit,
          .atharias-auth-input,
          .atharias-auth-link {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}
