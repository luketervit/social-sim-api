"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MascotVideo } from "./Mascot";
import ReactionSwarm from "./ReactionSwarm";

const SENTIMENT_TARGET = { hostile: 42, positive: 18, noise: 40 };

export default function HeroSection() {
  const [counts, setCounts] = useState({ hostile: 0, positive: 0, noise: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setCounts(SENTIMENT_TARGET);
      return;
    }
    const start = performance.now();
    const duration = 2200;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setCounts({
        hostile: Math.round(SENTIMENT_TARGET.hostile * eased),
        positive: Math.round(SENTIMENT_TARGET.positive * eased),
        noise: Math.round(SENTIMENT_TARGET.noise * eased),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      style={{
        background: "var(--ink)",
        color: "rgba(245, 244, 242, 0.95)",
        padding: "clamp(32px, 5vh, 64px) 0 clamp(28px, 4vh, 56px)",
        position: "relative",
        overflow: "hidden",
        minHeight: "calc(100svh - 56px)",
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
            marginBottom: 10,
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
            marginTop: 12,
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
            fontWeight: 400,
            color: "rgba(245, 244, 242, 0.98)",
            maxWidth: 18 + "ch",
          }}
        >
          Get ratioed{" "}
          <span style={{ fontStyle: "italic", color: "var(--butter-deep)" }}>
            in private
          </span>{" "}
          first.
        </h1>

        <p
          style={{
            marginTop: 12,
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
            color: "rgba(245, 244, 242, 0.7)",
            letterSpacing: "-0.01em",
            lineHeight: 1.4,
          }}
        >
          Then ship it like nothing happened.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
            marginTop: 20,
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

        {/* Swarm demo — anchored behind the hero content so comments orbit the buttons */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(640px, 92%)",
            zIndex: 0,
            pointerEvents: "none",
            opacity: 0.9,
          }}
        >
          <ReactionSwarm theme="dark" />
        </div>

        {/* Live sentiment readout */}
        <div
          className="tabular-nums"
          style={{
            marginTop: 14,
            display: "inline-flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 24,
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(245, 244, 242, 0.6)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--coral)" }} />
            {counts.hostile}% hostile
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--mint)" }} />
            {counts.positive}% positive
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "rgba(245, 244, 242, 0.45)",
              }}
            />
            {counts.noise}% noise
          </span>
        </div>
      </div>
    </section>
  );
}
