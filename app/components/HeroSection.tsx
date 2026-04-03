"use client";

import Link from "next/link";
import ParticleHero from "./ParticleHero";

export default function HeroSection() {
  return (
    <section
      style={{
        padding: "clamp(80px, 12vh, 140px) 0 clamp(80px, 12vh, 140px)",
        position: "relative",
        overflow: "hidden",
        minHeight: "min(90vh, 800px)",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Subtle warm gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(124, 92, 252, 0.04), transparent 70%), radial-gradient(ellipse 60% 50% at 30% 60%, rgba(52, 211, 153, 0.03), transparent 60%)",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />

      {/* Particle simulation */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "55%",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            maskImage: "radial-gradient(ellipse 100% 80% at 60% 50%, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse 100% 80% at 60% 50%, black 30%, transparent 70%)",
          }}
        >
          <ParticleHero />
        </div>
      </div>

      <div
        className="mx-auto max-w-[1200px] px-6"
        style={{ position: "relative", zIndex: 1, width: "100%" }}
      >
        <div
          style={{
            maxWidth: 620,
          }}
        >
          <span className="hero-kicker">Social Simulation Engine</span>

          <h1
            className="hero-headline"
            style={{
              fontSize: "clamp(2.8rem, 6vw, 4.5rem)",
              marginTop: 20,
            }}
          >
            <span className="hero-line">Know your audience</span>
            <span className="hero-line" style={{ color: "var(--accent)" }}>
              before you ship.
            </span>
          </h1>

          <p
            className="hero-copy"
            style={{
              fontSize: 18,
              marginTop: 28,
              maxWidth: 520,
            }}
          >
            Simulate how real communities react to your content before it goes
            live. Map audience data into synthetic agents and see what actually
            resonates.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              marginTop: 44,
            }}
          >
            <Link href="/waitlist" className="btn-primary">
              Get started
            </Link>
            <Link href="/#playground" className="btn-secondary">
              Try the playground
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
