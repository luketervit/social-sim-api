"use client";

import Link from "next/link";
import { MascotVideo } from "./Mascot";
import ReactionSwarm from "./ReactionSwarm";

export default function HeroSection() {
  return (
    <>
    <section
      style={{
        background: "var(--ink)",
        color: "rgba(245, 244, 242, 0.95)",
        padding: "clamp(32px, 5vh, 64px) 0 clamp(28px, 4vh, 56px)",
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
            "radial-gradient(ellipse 65% 50% at 50% 28%, rgba(245, 230, 184, 0.07), transparent 70%), radial-gradient(ellipse 50% 40% at 50% 80%, rgba(232, 93, 78, 0.06), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="mx-auto max-w-[1080px] px-6"
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <MascotVideo
          variant="idle"
          size={88}
          ariaLabel="Atharias mascot, watching"
          style={{
            marginBottom: 28,
            filter: "drop-shadow(0 8px 22px rgba(0, 0, 0, 0.45))",
          }}
        />

        <span
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--butter-deep)",
            fontWeight: 500,
          }}
        >
          Atharias · Social Simulation Engine
        </span>

        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "clamp(2.2rem, 5.2vw, 4rem)",
            marginTop: 32,
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
            fontWeight: 400,
            color: "rgba(245, 244, 242, 0.98)",
            maxWidth: 18 + "ch",
          }}
        >
          Pressure-test your message{" "}
          <span style={{ fontStyle: "italic", color: "var(--butter-deep)" }}>
            before it goes public
          </span>{" "}
        </h1>

        <p
          style={{
            marginTop: 28,
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
            color: "rgba(245, 244, 242, 0.7)",
            letterSpacing: "-0.01em",
            lineHeight: 1.4,
          }}
        >
          Run launches, pricing changes, and internal memos through a synthetic
          audience before the real crowd reacts.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
            marginTop: 44,
          }}
        >
          <Link
            href="/waitlist"
            className="cta-butter"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 28px",
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              minHeight: 48,
              color: "var(--ink)",
              background: "var(--butter-deep)",
              textDecoration: "none",
            }}
          >
            Get early access
          </Link>
          <Link
            href="/login"
            className="cta-ghost"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 24px",
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              minHeight: 48,
              color: "rgba(245, 244, 242, 0.85)",
              background: "transparent",
              textDecoration: "none",
              border: "1px solid rgba(245, 244, 242, 0.18)",
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>

    <section
      style={{
        background: "var(--ink)",
        padding: "clamp(120px, 20vh, 240px) 0 clamp(80px, 12vh, 160px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="mx-auto max-w-[1080px] px-6"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto" }}>
          <ReactionSwarm theme="dark" />
        </div>
      </div>
    </section>
    </>
  );
}
