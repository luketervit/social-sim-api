"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [signedInAfterSubmit, setSignedInAfterSubmit] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmittedEmail(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSignedInAfterSubmit(!!data.session);
    setSubmittedEmail(data.user?.email ?? email);
  }

  return (
    <section style={{ padding: "clamp(64px, 9vh, 96px) 0 clamp(96px, 13vh, 160px)" }}>
      <div className="mx-auto max-w-[1100px] px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.85fr)] lg:items-start">
          {/* Left: pitch */}
          <div>
            <span className="mono-label">Early access</span>
            <h1
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "clamp(2.4rem, 5.5vw, 4rem)",
                lineHeight: 1.02,
                letterSpacing: "-0.035em",
                color: "var(--text-primary)",
                marginTop: 14,
                maxWidth: 14 + "ch",
              }}
            >
              Get on the{" "}
              <span style={{ fontStyle: "italic" }}>API waitlist.</span>
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 17,
                lineHeight: 1.6,
                marginTop: 20,
                maxWidth: 480,
              }}
            >
              Once you sign up, you&apos;ll be able to upload any CSV of your
              customer data and run simulations on it for accurate results.
              We&apos;ll email you when access opens up.
            </p>

            <div
              style={{
                marginTop: 32,
                padding: "20px 22px",
                background: "var(--bg-subtle)",
                borderRadius: 14,
                border: "1px solid var(--border)",
              }}
            >
              <span className="mono-label">What you get now</span>
              <ul
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {[
                  "Upload any CSV of your customer data",
                  "Run simulations on your real audience",
                  "We'll email you when access opens up",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      lineHeight: 1.55,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        marginTop: 7,
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "var(--butter-deep)",
                        flexShrink: 0,
                      }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: form */}
          <div
            style={{
              padding: "clamp(24px, 3vw, 32px)",
              borderRadius: 18,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.04), 0 14px 40px rgba(20,20,19,0.05)",
            }}
          >
            {submittedEmail ? (
              <div className="waitlist-success-shell">
                <div className="waitlist-success-mark" aria-hidden="true">
                  <svg viewBox="0 0 64 64" className="waitlist-success-icon">
                    <circle cx="32" cy="32" r="31" className="waitlist-success-ring" />
                    <path d="M18 33.5 27 42.5 47 22.5" className="waitlist-success-check" />
                  </svg>
                </div>

                <span className="mono-label">You&apos;re in</span>
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--text-primary)",
                    fontSize: 36,
                    lineHeight: 0.96,
                    letterSpacing: "-0.04em",
                    marginTop: 12,
                  }}
                >
                  Waitlist joined.
                </div>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 15,
                    lineHeight: 1.6,
                    marginTop: 16,
                    maxWidth: 420,
                  }}
                >
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {submittedEmail}
                  </span>{" "}
                  is on the waitlist. Once access opens up, you&apos;ll be able
                  to upload any CSV of your customer data and run simulations on
                  it for accurate results.
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 28,
                  }}
                >
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: "var(--ink)", color: "var(--butter-deep)" }}
                    onClick={() => {
                      setSubmittedEmail(null);
                      setSignedInAfterSubmit(false);
                      setEmail("");
                      setPassword("");
                    }}
                  >
                    Add another email
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="mono-label">Sign up</span>
                <h2
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: 26,
                    letterSpacing: "-0.025em",
                    marginTop: 10,
                    color: "var(--text-primary)",
                  }}
                >
                  Create your account
                </h2>

                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-5"
                  style={{ marginTop: 22 }}
                >
                  <div>
                    <label
                      htmlFor="email"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        letterSpacing: "-0.01em",
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

                  <div>
                    <label
                      htmlFor="password"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{
                      marginTop: 4,
                      background: "var(--ink)",
                      color: "var(--butter-deep)",
                    }}
                  >
                    {loading ? "Joining…" : "Join waitlist →"}
                  </button>
                </form>

                {error && (
                  <div
                    className="mt-5 px-4 py-3 text-[13px]"
                    style={{
                      background: "var(--coral-muted)",
                      color: "var(--coral)",
                      border: "1px solid rgba(249, 112, 102, 0.2)",
                      borderRadius: 12,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  className="mt-6"
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: 13,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <p>
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      style={{
                        color: "var(--text-primary)",
                        textDecoration: "underline",
                        textUnderlineOffset: "3px",
                      }}
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
