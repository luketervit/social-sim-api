"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

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

    if (!data.session) {
      setNotice(
        "Your account has been created. Confirm your email if prompted, then use the sign in/up page to check access status."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section style={{ padding: "72px 0 120px" }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.85fr)]">
          <div className="section-shell border border-[rgba(39,39,42,0.55)]">
            <span className="mono-label">WAITLIST</span>
            <h1
              style={{
                fontSize: 44,
                lineHeight: 1,
                color: "var(--text-primary)",
                marginTop: 14,
                maxWidth: 420,
              }}
            >
              Request access
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 15,
                lineHeight: 1.7,
                marginTop: 18,
                maxWidth: 460,
              }}
            >
              Create an account with your work email and password to join the
              Atharias closed beta waitlist.
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
                Accounts submitted here are added to the closed beta queue.
                Once approved, you can sign in with the same credentials and
                access the dashboard immediately.
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
                  Waitlist sign up
                </div>
              </div>
              <span
                className="mono-label"
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(39, 39, 42, 0.75)",
                  background: "rgba(24, 24, 27, 0.72)",
                  color: "var(--text-tertiary)",
                  whiteSpace: "nowrap",
                }}
              >
                CLOSED BETA
              </span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="mono-label" style={{ display: "block", marginBottom: 10 }}>
                  Work Email
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
                <label htmlFor="password" className="mono-label" style={{ display: "block", marginBottom: 10 }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 8 characters)"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 6 }}>
                {loading ? "Submitting request…" : "Join waitlist"}
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
              <p>
                Already have an account?{" "}
                <Link
                  href="/login"
                  style={{ color: "var(--text-primary)", textDecoration: "underline", textUnderlineOffset: "3px" }}
                >
                  Go to sign in/up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
