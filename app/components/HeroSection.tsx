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
        padding: "clamp(72px, 11vh, 132px) 0 clamp(56px, 9vh, 96px)",
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
            "radial-gradient(ellipse 70% 55% at 50% 30%, rgba(124, 92, 252, 0.06), transparent 70%), radial-gradient(ellipse 60% 50% at 50% 80%, rgba(232, 93, 78, 0.04), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="mx-auto max-w-[1100px] px-6"
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span className="hero-kicker">Social Simulation Engine</span>

        <h1
          className="hero-headline"
          style={{
            fontSize: "clamp(2.6rem, 7vw, 5.2rem)",
            marginTop: 18,
            maxWidth: 12 + "ch",
          }}
        >
          <span className="hero-line">Get ratioed</span>
          <span
            className="hero-line"
            style={{ fontStyle: "italic", color: "var(--accent)" }}
          >
            in private
          </span>
          <span className="hero-line">first.</span>
        </h1>

        <p
          className="hero-copy"
          style={{
            fontSize: 18,
            marginTop: 24,
            maxWidth: 540,
          }}
        >
          Atharias runs your post past a synthetic audience before the real one
          gets to it. See the dunks, the praise, and the shrug — before you
          publish.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
            marginTop: 36,
          }}
        >
          <Link href="/waitlist" className="btn-primary">
            Get early access
          </Link>
          <Link href="/#playground" className="btn-secondary">
            Try the playground
          </Link>
        </div>

        {/* Swarm demo */}
        <div style={{ marginTop: 64, width: "100%" }}>
          <ReactionSwarm />
        </div>

        {/* Live sentiment readout */}
        <div
          className="tabular-nums"
          style={{
            marginTop: 28,
            display: "inline-flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 24,
            fontFamily: "var(--font-data), monospace",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--coral)",
              }}
            />
            {counts.hostile}% hostile
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--mint)",
              }}
            />
            {counts.positive}% positive
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
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
