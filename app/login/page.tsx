"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const requestedMode = searchParams.get("mode");

    if (
      requestedMode === "signin" ||
      requestedMode === "signup" ||
      requestedMode === "reset"
    ) {
      setMode(requestedMode);
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

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }

      setNotice("Password reset email sent. Open the link in your inbox to choose a new password.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }

      if (!data.session) {
        setNotice(
          "Your account has been created for the closed beta. Confirm your email if prompted, then sign in to check access status."
        );
        setMode("signin");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (error) {
        if (error.message === "Invalid login credentials") {
          setError("Invalid email or password.");
        } else {
          setError(error.message);
        }
        return;
      }

      router.push("/dashboard");
      router.refresh();
    }
  }

  const heading =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Reset password";
  const description =
    mode === "signin"
      ? "Access your account, manage API keys, and run simulations."
      : mode === "signup"
        ? "Create an account with email and password to request access to the closed beta."
        : "Enter your email and we’ll send you a secure recovery link.";
  const modeLabel =
    mode === "signin" ? "ACCOUNT_ACCESS" :
    mode === "signup" ? "CLOSED_BETA" :
    "PASSWORD_RESET";

  return (
    <section style={{ padding: "72px 0 120px" }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.85fr)]">
          <div className="section-shell border border-[rgba(39,39,42,0.55)]">
            <span className="mono-label">{modeLabel}</span>
            <h1
              style={{
                fontSize: 44,
                lineHeight: 1,
                color: "var(--text-primary)",
                marginTop: 14,
                maxWidth: 420,
              }}
            >
              {heading}
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 15,
                lineHeight: 1.7,
                marginTop: 18,
                maxWidth: 440,
              }}
            >
              {description}
            </p>

            <div
              className="panel"
              style={{
                marginTop: 28,
                padding: 20,
                background:
                  "linear-gradient(180deg, rgba(39, 39, 42, 0.28), rgba(24, 24, 27, 0.12) 55%, transparent 100%)",
              }}
            >
              <div className="mono-label" style={{ marginBottom: 10 }}>
                ACCESS POLICY
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
                {mode === "signin"
                  ? "Approved accounts are redirected to the dashboard immediately. Accounts pending review can still sign in, but access stays paused until approval."
                  : mode === "signup"
                    ? "New accounts are added to the closed beta queue automatically after sign up."
                    : "Recovery emails route back through the app callback and open the password reset screen."}
              </p>
            </div>
          </div>

          <div className="panel" style={{ padding: 28 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                marginBottom: 22,
              }}
            >
              <div>
                <div className="mono-label">ACCOUNT</div>
                <div
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 22,
                    marginTop: 8,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {heading}
                </div>
              </div>
              <span
                className="mono-label"
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(39, 39, 42, 0.75)",
                  background: "rgba(24, 24, 27, 0.72)",
                  color: mode === "reset" ? "#86efac" : "var(--text-tertiary)",
                  whiteSpace: "nowrap",
                }}
              >
                {mode === "reset" ? "RESET" : "SECURE"}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="mono-label" style={{ display: "block", marginBottom: 10 }}>
                  Email Address
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
                  className="input"
                />
              </div>

              {mode !== "reset" && (
                <div>
                  <label htmlFor="password" className="mono-label" style={{ display: "block", marginBottom: 10 }}>
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Password (min 8 characters)" : "Password"}
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="input"
                  />
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 6 }}>
                {loading
                  ? (mode === "signin"
                      ? "Signing in\u2026"
                      : mode === "signup"
                        ? "Creating account\u2026"
                        : "Sending reset link\u2026")
                  : (mode === "signin"
                      ? "Sign in"
                      : mode === "signup"
                        ? "Sign up"
                        : "Send reset link")}
              </button>
            </form>

            {error && (
              <div
                className="mt-5 px-4 py-3 text-[13px]"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "#fca5a5",
                  border: "1px solid rgba(239, 68, 68, 0.15)",
                  borderRadius: 20,
                }}
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                className="mt-5 px-4 py-3 text-[13px]"
                style={{
                  background: "rgba(34, 197, 94, 0.08)",
                  color: "#86efac",
                  border: "1px solid rgba(34, 197, 94, 0.15)",
                  borderRadius: 20,
                }}
              >
                {notice}
              </div>
            )}

            <div className="mt-6" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {mode === "signin" ? (
                <p>
                  Need an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                      setNotice(null);
                    }}
                    style={{ color: "var(--text-primary)", textDecoration: "underline", textUnderlineOffset: "3px" }}
                  >
                    Sign up
                  </button>
                </p>
              ) : mode === "signup" ? (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                      setNotice(null);
                    }}
                    style={{ color: "var(--text-primary)", textDecoration: "underline", textUnderlineOffset: "3px" }}
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p>
                  Remembered it?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                      setNotice(null);
                    }}
                    style={{ color: "var(--text-primary)", textDecoration: "underline", textUnderlineOffset: "3px" }}
                  >
                    Back to sign in
                  </button>
                </p>
              )}

              {mode === "signin" && (
                <p style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setNotice(null);
                    }}
                    style={{ color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: "3px" }}
                  >
                    Forgot password?
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
