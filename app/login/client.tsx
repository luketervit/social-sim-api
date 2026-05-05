"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

interface LoginClientProps {
  initialMode: Mode;
  next: string;
}

const PASSWORD_MIN = 8;

export default function LoginClient({ initialMode, next }: LoginClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "signup" && password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowser();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      // Server-side login page decides the destination based on waitlist state.
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // Supabase may require email confirmation depending on project settings.
    // If a session is returned, route via the gate; otherwise show a hint.
    if (data.session) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      router.refresh();
    } else {
      setInfo(
        "Check your inbox to confirm your email, then come back and sign in."
      );
      setMode("signin");
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
          {mode === "signin" ? (
            <>
              Sign in to{" "}
              <span style={{ fontStyle: "italic" }}>your audience.</span>
            </>
          ) : (
            <>
              Get on the{" "}
              <span style={{ fontStyle: "italic" }}>private beta.</span>
            </>
          )}
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: 15,
            lineHeight: 1.6,
            marginTop: 14,
          }}
        >
          {mode === "signin"
            ? "Welcome back. Pick up your audiences and run a fresh simulation."
            : "Sign up and we'll let you in once your seat opens. We're rolling out access in small batches."}
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
          <div
            role="tablist"
            aria-label="Sign in or sign up"
            style={{
              display: "inline-flex",
              padding: 4,
              borderRadius: 999,
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              gap: 2,
            }}
          >
            <TabButton
              active={mode === "signin"}
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfo(null);
              }}
            >
              Sign in
            </TabButton>
            <TabButton
              active={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setError(null);
                setInfo(null);
              }}
            >
              Sign up
            </TabButton>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginTop: 22,
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
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "signup" ? "At least 8 characters" : "Your password"
                }
                required
                minLength={mode === "signup" ? PASSWORD_MIN : undefined}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
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
              {loading
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "signin"
                  ? "Sign in →"
                  : "Create account →"}
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

          {info ? (
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
              }}
            >
              {info}
            </div>
          ) : null}
        </div>

        <p
          style={{
            marginTop: 18,
            fontSize: 13,
            color: "var(--text-tertiary)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {mode === "signin" ? (
            <>
              No account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--text-primary)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                Request access
              </button>
            </>
          ) : (
            <>
              Already in?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--text-primary)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 500,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        boxShadow: active
          ? "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)"
          : "none",
        transition: "background 150ms ease, color 150ms ease",
        minHeight: 32,
      }}
    >
      {children}
    </button>
  );
}
