"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

const PASSWORD_MIN = 8;

export default function SetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let resolved = false;

    const resolve = (sessionEmail: string) => {
      resolved = true;
      setEmail(sessionEmail);
      setReady(true);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.email && !resolved) {
        resolve(session.user.email);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.email && !resolved) {
        resolve(data.session.user.email);
      }
    });

    const expiry = setTimeout(() => {
      if (!resolved) {
        setLinkExpired(true);
      }
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(expiry);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
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

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <section
      style={{
        background: "var(--bg)",
        padding: "clamp(64px, 9vh, 96px) 0 clamp(64px, 9vh, 120px)",
      }}
    >
      <div className="mx-auto px-6" style={{ maxWidth: 460 }}>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            textDecoration: "none",
          }}
        >
          ← Atharias
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            color: "var(--text-primary)",
            marginTop: 18,
          }}
        >
          You&apos;re in.{" "}
          <span style={{ fontStyle: "italic" }}>Set a password.</span>
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: 15,
            lineHeight: 1.6,
            marginTop: 14,
          }}
        >
          Pick a password and you&apos;re ready to upload your audience and run
          simulations.
        </p>

        <div
          style={{
            marginTop: 28,
            padding: "clamp(24px, 3vw, 32px)",
            borderRadius: 18,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.04), 0 14px 40px rgba(20,20,19,0.05)",
          }}
        >
          {!ready && !linkExpired ? (
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
              }}
            >
              Verifying your invite link…
            </p>
          ) : linkExpired ? (
            <div>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                }}
              >
                This password-reset link has expired or already been used.
                Request a fresh one from the reset password page.
              </p>
              <Link
                href="/reset-password"
                className="btn-secondary"
                style={{ marginTop: 18, display: "inline-flex" }}
              >
                Reset password
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {email ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  Setting password for{" "}
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {email}
                  </span>
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={PASSWORD_MIN}
                  autoComplete="new-password"
                  className="input"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={PASSWORD_MIN}
                  autoComplete="new-password"
                  className="input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  marginTop: 6,
                  background: "var(--ink)",
                  color: "var(--butter-deep)",
                }}
              >
                {loading ? "Saving…" : "Set password →"}
              </button>

              {error ? (
                <div
                  role="alert"
                  style={{
                    marginTop: 4,
                    padding: "12px 14px",
                    borderRadius: 12,
                    fontSize: 13,
                    background: "var(--coral-muted)",
                    color: "var(--coral)",
                    border: "1px solid rgba(249, 112, 102, 0.2)",
                  }}
                >
                  {error}
                </div>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
