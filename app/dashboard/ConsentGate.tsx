"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

interface ConsentGateProps {
  consentVersion: string;
}

export default function ConsentGate({ consentVersion }: ConsentGateProps) {
  const router = useRouter();
  const [ownData, setOwnData] = useState(false);
  const [anonymized, setAnonymized] = useState(false);
  const [licensing, setLicensing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = ownData && anonymized && licensing;

  async function handleAccept() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          own_data: ownData,
          anonymized_processing: anonymized,
          aggregated_licensing: licensing,
          version: consentVersion,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(payload?.error ?? "Could not record consent.");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not record consent."
      );
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg)",
        padding: "32px 20px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 640,
          padding: "28px",
          borderRadius: 24,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.04), 0 18px 48px rgba(20,20,19,0.06)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
          }}
        >
          Consent required
        </div>

        <h1
          style={{
            marginTop: 10,
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "clamp(2rem, 4vw, 2.6rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            color: "var(--text-primary)",
          }}
        >
          Review the updated terms to keep using uploads.
        </h1>

        <p
          style={{
            marginTop: 14,
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          Your account predates the current consent flow, so uploads are paused
          until you accept version {consentVersion}. Read the{" "}
          <Link href="/terms" style={{ color: "var(--text-primary)" }}>
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" style={{ color: "var(--text-primary)" }}>
            privacy policy
          </Link>
          , then confirm below.
        </p>

        <div
          style={{
            marginTop: 22,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <ConsentCheckbox
            id="consent-own-data"
            checked={ownData}
            onChange={setOwnData}
          >
            I&rsquo;m uploading my own LinkedIn data, exported from LinkedIn
            directly. I will not upload anyone else&rsquo;s export.
          </ConsentCheckbox>

          <ConsentCheckbox
            id="consent-anonymized"
            checked={anonymized}
            onChange={setAnonymized}
          >
            I understand my connections are processed in anonymized form: names,
            emails, and company identifiers are <strong>not</strong> stored on
            personas. Atharias never messages my connections and does not store
            their private message content.
          </ConsentCheckbox>

          <ConsentCheckbox
            id="consent-licensing"
            checked={licensing}
            onChange={setLicensing}
          >
            I allow Atharias to use de-identified, aggregated insights to
            improve shared models and to license those aggregates to research
            partners. I can request deletion at any time.
          </ConsentCheckbox>
        </div>

        {error ? (
          <p
            role="alert"
            style={{
              marginTop: 16,
              fontSize: 13,
              color: "var(--coral)",
            }}
          >
            {error}
          </p>
        ) : null}

        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={!ready || submitting}
            className="btn-primary"
            style={{
              background: "var(--ink)",
              color: "var(--butter-deep)",
              opacity: !ready || submitting ? 0.55 : 1,
              cursor: !ready || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Recording consent…" : "Accept and continue →"}
          </button>

          <span
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--text-tertiary)",
            }}
          >
            If anything looks wrong, email{" "}
            <a href="mailto:luke@atharias.dev">luke@atharias.dev</a>.
          </span>
        </div>
      </section>
    </main>
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
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 14,
        lineHeight: 1.6,
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
