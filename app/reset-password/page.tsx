"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowser();
      const redirectTo = `${window.location.origin}/auth/set-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      );

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Could not send reset email right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        minHeight: "calc(100vh - 0px)",
        background: "var(--bg)",
        padding: "clamp(64px, 9vh, 96px) 0 clamp(64px, 9vh, 120px)",
      }}
    >
      <div className="mx-auto px-6" style={{ maxWidth: 460 }}>
        <Link
          href="/login"
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            textDecoration: "none",
          }}
        >
          ← Back to sign in
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
          Reset your{" "}
          <span style={{ fontStyle: "italic" }}>password.</span>
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: 15,
            lineHeight: 1.6,
            marginTop: 14,
          }}
        >
          Use this if your account was created under the old waitlist flow and
          you never chose a password.
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
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                Work email
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
              {loading ? "Sending…" : "Send reset link →"}
            </button>
          </form>

          {error ? (
            <div
              role="alert"
              style={{
                marginTop: 18,
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

          {sent ? (
            <div
              role="status"
              style={{
                marginTop: 18,
                padding: "12px 14px",
                borderRadius: 12,
                fontSize: 13,
                background: "var(--mint-muted)",
                color: "#1f8a55",
                border: "1px solid rgba(52, 211, 153, 0.2)",
                lineHeight: 1.55,
              }}
            >
              If that email exists, we sent a reset link to{" "}
              <strong>{email.trim().toLowerCase()}</strong>.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
