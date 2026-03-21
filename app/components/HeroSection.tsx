"use client";

import Link from "next/link";

export default function HeroSection() {
  return (
    <section
      style={{ padding: "80px 0 96px", position: "relative", overflow: "hidden" }}
    >
      <div className="hero-backdrop" aria-hidden="true">
        <div className="hero-globe">
          <div className="hero-globe-grid" />
          <div className="hero-globe-arc hero-globe-arc-one" />
          <div className="hero-globe-arc hero-globe-arc-two" />
          <div className="hero-globe-haze" />
        </div>
      </div>

      <div
        className="mx-auto max-w-[1180px] px-6"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div>
            <span className="hero-kicker">Atharias / Closed beta</span>
          </div>

          <h1
            className="hero-headline"
            style={{
              fontSize: "clamp(3.25rem, 8vw, 5.6rem)",
              color: "var(--text-primary)",
              marginTop: 24,
              maxWidth: 820,
            }}
          >
            <span className="hero-line hero-line-strong">Predict the Backlash</span>
            <span className="hero-line hero-line-strong" style={{ color: "var(--accent)" }}>
              Before You Ship
            </span>
          </h1>

          <p
            className="hero-copy"
            style={{
              fontSize: 17,
              color: "var(--text-secondary)",
              marginTop: 24,
              maxWidth: 620,
            }}
          >
            Start with seeded test audiences in developer mode, then map your
            own customer segments into synthetic agents for production
            simulations. Atharias turns audience data into many distinct voices
            so you can model how sentiment spreads instead of guessing from one
            example user.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 16,
              marginTop: 44,
            }}
          >
            <Link href="/waitlist" className="btn-primary">
              Request access
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
