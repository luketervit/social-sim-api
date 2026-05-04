"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
        padding: "clamp(56px, 9vh, 96px) 0 clamp(40px, 7vh, 80px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 65% 50% at 50% 32%, rgba(124, 92, 252, 0.05), transparent 70%), radial-gradient(ellipse 50% 40% at 50% 78%, rgba(232, 93, 78, 0.035), transparent 70%)",
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
        }}
      >
        <span
          className="mono-label"
          style={{ color: "var(--text-tertiary)", fontSize: 11 }}
        >
          Atharias · Social Simulation Engine
        </span>

        <h1
          className="hero-headline"
          style={{
            fontSize: "clamp(2.4rem, 6.2vw, 4.4rem)",
            marginTop: 14,
            maxWidth: 18 + "ch",
            lineHeight: 1.02,
          }}
        >
          Get ratioed{" "}
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
            in private
          </span>{" "}
          first.
        </h1>

        <p
          style={{
            marginTop: 16,
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(1.15rem, 1.6vw, 1.45rem)",
            color: "var(--text-secondary)",
            letterSpacing: "-0.01em",
            lineHeight: 1.4,
          }}
        >
          Then ship it like nothing happened.
        </p>

        <p
          className="hero-copy"
          style={{
            fontSize: 16,
            marginTop: 18,
            maxWidth: 520,
          }}
        >
          Atharias runs your post past a synthetic audience before the real one
          gets to it — dunks, praise, and the shrug, in advance.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
            marginTop: 28,
          }}
        >
          <Link href="/waitlist" className="btn-primary">
            Get early access
          </Link>
          <Link href="/#playground" className="btn-secondary">
            Try the playground
          </Link>
        </div>

        {/* Swarm demo — tightened gap */}
        <div style={{ marginTop: 40, width: "100%" }}>
          <ReactionSwarm />
        </div>

        {/* Live sentiment readout */}
        <div
          className="tabular-nums"
          style={{
            marginTop: 20,
            display: "inline-flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 24,
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--coral)",
              }}
            />
            {counts.hostile}% hostile
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--mint)",
              }}
            />
            {counts.positive}% positive
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--text-tertiary)",
              }}
            />
            {counts.noise}% noise
          </span>
        </div>
      </div>
    </section>
  );
}
