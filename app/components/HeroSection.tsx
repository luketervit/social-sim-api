"use client";

import Link from "next/link";
import { MascotVideo } from "./Mascot";

export default function HeroSection() {
  return (
    <section
      style={{
        background: "var(--bg)",
        color: "var(--text-primary)",
        padding: "clamp(48px, 8vh, 96px) 0 clamp(56px, 10vh, 120px)",
        position: "relative",
        overflow: "hidden",
        minHeight: "calc(100vh - 56px)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 55% at 50% 30%, rgba(232, 210, 122, 0.18), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="mx-auto max-w-[960px] px-6"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "clamp(32px, 5vh, 56px)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              padding: "6px 14px 6px 8px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--bg-element)",
            }}
          >
            <MascotVideo
              variant="idle"
              size={28}
              ariaLabel="Atharias mascot"
              style={{ borderRadius: 999 }}
            />
            <span
              style={{
                fontFamily: "var(--font-data), monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              Social simulation engine
            </span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(2.6rem, 6.4vw, 5rem)",
              lineHeight: 0.98,
              letterSpacing: "-0.04em",
              fontWeight: 400,
              color: "var(--text-primary)",
              maxWidth: "16ch",
              margin: 0,
            }}
          >
            Run it past{" "}
            <span style={{ fontStyle: "italic", color: "var(--text-primary)" }}>
              your people
            </span>{" "}
            first.
          </h1>

          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(1.05rem, 1.5vw, 1.35rem)",
              color: "var(--text-secondary)",
              letterSpacing: "-0.005em",
              lineHeight: 1.5,
              maxWidth: "44ch",
            }}
          >
            Atharias turns your audience into agents. Drop a draft. Get back
            the reactions, the objections, and the rewrite that lands.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 8,
            }}
          >
            <Link
              href="/waitlist"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 26px",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                minHeight: 48,
                color: "var(--bg)",
                background: "var(--ink)",
                textDecoration: "none",
              }}
            >
              Get early access
            </Link>
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 22px",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                minHeight: 48,
                color: "var(--text-primary)",
                background: "transparent",
                textDecoration: "none",
                border: "1px solid var(--border-hover)",
              }}
            >
              Sign in
            </Link>
          </div>
        </div>

        <ProofStrip />
      </div>
    </section>
  );
}

function ProofStrip() {
  const stats: { value: string; label: string }[] = [
    { value: "1,000+", label: "agents per simulation" },
    { value: "10 rounds", label: "of threaded reaction" },
    { value: "~2 min", label: "from draft to verdict" },
  ];

  return (
    <div
      style={{
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 0,
        borderTop: "1px solid var(--border)",
      }}
    >
      {stats.map((stat, idx) => (
        <div
          key={stat.label}
          style={{
            padding: "20px 24px 4px",
            borderRight:
              idx < stats.length - 1 ? "1px solid var(--border)" : "none",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              lineHeight: 1,
            }}
          >
            {stat.value}
          </span>
          <span
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
            }}
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
