"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function ResetPasswordClient() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let active = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      setEmail(user?.email ?? "");
      setCanReset(Boolean(user));
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session?.user) {
        setEmail(session?.user.email ?? "");
        setCanReset(Boolean(session?.user));
        setError(null);
      }
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canReset) {
      setError("Open the password reset link from your email to continue.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Password updated. Redirecting to your dashboard...");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 800);
  }

  return (
    <section style={{ padding: "72px 0 120px" }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.85fr)]">
          <div className="section-shell border border-[rgba(39,39,42,0.55)]">
            <span className="mono-label">PASSWORD_RESET</span>
            <h1
              style={{
                fontSize: 44,
                lineHeight: 1,
                color: "var(--text-primary)",
                marginTop: 14,
                maxWidth: 420,
              }}
            >
              Set new password
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
              {email
                ? `Update the password for ${email} and restore account access.`
                : "Choose a fresh password to complete account recovery and restore dashboard access."}
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
                RECOVERY STATUS
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
                {!ready
                  ? "Verifying your recovery session."
                  : canReset
                    ? "Recovery link accepted. Submit a new password to finalize account access."
                    : "No valid recovery session detected. Request a fresh reset link from the login page."}
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
                  Password rotation
                </div>
              </div>
              <span
                className="mono-label"
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(39, 39, 42, 0.75)",
                  background: "rgba(24, 24, 27, 0.72)",
                  color: canReset ? "#86efac" : "var(--text-tertiary)",
                  whiteSpace: "nowrap",
                }}
              >
                {canReset ? "VERIFIED" : "AWAITING LINK"}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="password" className="mono-label" style={{ display: "block", marginBottom: 10 }}>
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mono-label" style={{ display: "block", marginBottom: 10 }}>
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !ready || !canReset}
                className="btn-primary"
                style={{ marginTop: 6 }}
              >
                {loading ? "Updating password\u2026" : "Update password"}
              </button>
            </form>

            {!ready ? (
              <div
                className="mt-5 px-4 py-3 text-[13px]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text-secondary)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 20,
                }}
              >
                Verifying your recovery session...
              </div>
            ) : !canReset && !error && !success ? (
              <div
                className="mt-5 px-4 py-3 text-[13px]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text-secondary)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 20,
                }}
              >
                This page only works from a valid password reset email. Request a new reset link from the login page if needed.
              </div>
            ) : null}

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

            {success && (
              <div
                className="mt-5 px-4 py-3 text-[13px]"
                style={{
                  background: "rgba(34, 197, 94, 0.08)",
                  color: "#86efac",
                  border: "1px solid rgba(34, 197, 94, 0.15)",
                  borderRadius: 20,
                }}
              >
                {success}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
