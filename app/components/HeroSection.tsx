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
            <span className="hero-kicker">Atharias / Instant playground, gated API</span>
          </div>

          <h1
            className="hero-headline"
            style={{
              fontSize: "clamp(3.25rem, 8vw, 5.6rem)",
              color: "var(--text-primary)",
              marginTop: 24,
              maxWidth: 900,
            }}
          >
            <span className="hero-line hero-line-strong">Landing to Simulation</span>
            <span className="hero-line hero-line-strong" style={{ color: "var(--accent)" }}>
              in One Sign-Up
            </span>
          </h1>

          <p
            className="hero-copy"
            style={{
              fontSize: 17,
              color: "var(--text-secondary)",
              marginTop: 24,
              maxWidth: 720,
            }}
          >
            Sign up and run the free playground immediately. Test a launch,
            pricing change, or product announcement against seeded audiences,
            then publish the result as a shareable simulation page. Raw API
            access still stays on a separate waitlist for production teams.
          </p>

          <div
            className="panel"
            style={{
              marginTop: 30,
              padding: 18,
              maxWidth: 780,
              width: "100%",
              background:
                "linear-gradient(180deg, rgba(236, 253, 245, 0.06), rgba(24, 24, 27, 0.22) 55%, transparent 100%)",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                textAlign: "left",
              }}
            >
              {[
                ["01", "Sign up", "No waitlist on the free tier."],
                ["02", "Playground", "Run the first simulation instantly."],
                ["03", "Share", "Turn the result into a public link."],
                ["04", "API", "Apply separately for direct integration."],
              ].map(([index, title, detail]) => (
                <div key={index}>
                  <div className="mono-label">{index}</div>
                  <div style={{ marginTop: 8, color: "var(--text-primary)", fontSize: 16 }}>
                    {title}
                  </div>
                  <div style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 13 }}>
                    {detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 16,
              marginTop: 44,
            }}
          >
            <Link href="/login?mode=signup" className="btn-primary">
              Start free
            </Link>
            <Link href="/waitlist" className="btn-secondary">
              Join API waitlist
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
