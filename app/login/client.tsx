"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

interface LoginClientProps {
  initialMode: Mode;
  next: string;
  consentVersion: string;
}

const PASSWORD_MIN = 8;

export default function LoginClient({
  initialMode,
  next,
  consentVersion,
}: LoginClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consentOwnData, setConsentOwnData] = useState(false);
  const [consentAnonymized, setConsentAnonymized] = useState(false);
  const [consentLicensing, setConsentLicensing] = useState(false);

  const allConsentsAccepted =
    consentOwnData && consentAnonymized && consentLicensing;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "signup") {
      if (password.length < PASSWORD_MIN) {
        setError(`Password must be at least ${PASSWORD_MIN} characters.`);
        return;
      }
      if (!allConsentsAccepted) {
        setError("Please accept all three consents to continue.");
        return;
      }
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
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // If we have a session immediately, persist consent now. Otherwise the
    // user has to confirm email first; we'll capture consent again on first
    // sign-in via the gated dashboard flow (separate concern, recorded here
    // best-effort so the audit trail starts at signup intent).
    if (data.session) {
      try {
        const res = await fetch("/api/v1/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            own_data: consentOwnData,
            anonymized_processing: consentAnonymized,
            aggregated_licensing: consentLicensing,
            version: consentVersion,
          }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          console.error("Consent recording failed:", payload?.error ?? res.status);
        }
      } catch (err) {
        console.error("Consent recording failed:", err);
      }

      setLoading(false);
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      router.refresh();
      return;
    }

    setLoading(false);
    setInfo(
      "Check your inbox to confirm your email, then come back and sign in."
    );
    setMode("signin");
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

            {mode === "signup" ? (
              <ConsentBlock
                ownData={consentOwnData}
                onOwnDataChange={setConsentOwnData}
                anonymized={consentAnonymized}
                onAnonymizedChange={setConsentAnonymized}
                licensing={consentLicensing}
                onLicensingChange={setConsentLicensing}
              />
            ) : null}

            <button
              type="submit"
              disabled={loading || (mode === "signup" && !allConsentsAccepted)}
              className="btn-primary"
              style={{
                marginTop: 6,
                background: "var(--ink)",
                color: "var(--butter-deep)",
                opacity:
                  loading || (mode === "signup" && !allConsentsAccepted)
                    ? 0.55
                    : 1,
                cursor:
                  loading || (mode === "signup" && !allConsentsAccepted)
                    ? "not-allowed"
                    : "pointer",
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
              <span> · </span>
              <Link
                href="/reset-password"
                style={{
                  color: "var(--text-primary)",
                  textDecoration: "underline",
                }}
              >
                Reset password
              </Link>
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

function ConsentBlock({
  ownData,
  onOwnDataChange,
  anonymized,
  onAnonymizedChange,
  licensing,
  onLicensingChange,
}: {
  ownData: boolean;
  onOwnDataChange: (v: boolean) => void;
  anonymized: boolean;
  onAnonymizedChange: (v: boolean) => void;
  licensing: boolean;
  onLicensingChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        marginTop: 4,
        padding: "16px 18px",
        borderRadius: 12,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 2,
        }}
      >
        How your data is used
      </div>

      <ConsentCheckbox
        id="consent-own-data"
        checked={ownData}
        onChange={onOwnDataChange}
      >
        I&rsquo;m uploading my own LinkedIn data, exported from LinkedIn directly.
        I will not upload anyone else&rsquo;s export.
      </ConsentCheckbox>

      <ConsentCheckbox
        id="consent-anonymized"
        checked={anonymized}
        onChange={onAnonymizedChange}
      >
        I understand my connections are processed in anonymized form: names,
        emails, and company identifiers are <strong>not</strong> stored on
        personas. We never message my connections, and we don&rsquo;t store
        their private message content.
      </ConsentCheckbox>

      <ConsentCheckbox
        id="consent-licensing"
        checked={licensing}
        onChange={onLicensingChange}
      >
        I allow Atharias to use de-identified, aggregated insights to improve
        shared models and to license those aggregates to research partners. I
        can request deletion at any time.
      </ConsentCheckbox>

      <p
        style={{
          fontSize: 12,
          color: "var(--text-tertiary)",
          lineHeight: 1.55,
          marginTop: 2,
        }}
      >
        Read the full <Link href="/terms" style={{ color: "var(--text-primary)" }}>terms</Link>{" "}
        and{" "}
        <Link href="/privacy" style={{ color: "var(--text-primary)" }}>privacy policy</Link>.
        You can request deletion any time via{" "}
        <Link href="/privacy#delete" style={{ color: "var(--text-primary)" }}>
          this page
        </Link>{" "}
        or by emailing luke@atharias.dev.
      </p>
    </div>
  );
}

function ConsentCheckbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          marginTop: 3,
          width: 16,
          height: 16,
          accentColor: "var(--ink, #14110f)",
          flexShrink: 0,
          cursor: "pointer",
        }}
      />
      <span>{children}</span>
    </label>
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
