"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import ReactionSwarm, { type Reaction } from "./ReactionSwarm";

export type IndustryHeroConfig = {
  kicker: string;
  headline: ReactNode;
  italicSubline: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  postLabel: string;
  postAuthor: string;
  postBody: string;
  reactions: Reaction[];
  sentiment: { hostile: number; positive: number; noise: number };
};

export default function IndustryHero({ config }: { config: IndustryHeroConfig }) {
  const [counts, setCounts] = useState({ hostile: 0, positive: 0, noise: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const raf = requestAnimationFrame(() => {
        setCounts(config.sentiment);
      });
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const duration = 2200;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setCounts({
        hostile: Math.round(config.sentiment.hostile * eased),
        positive: Math.round(config.sentiment.positive * eased),
        noise: Math.round(config.sentiment.noise * eased),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [config.sentiment]);

  return (
    <section
      style={{
        background: "var(--ink)",
        color: "rgba(245, 244, 242, 0.95)",
        padding: "clamp(64px, 10vh, 112px) 0 clamp(56px, 9vh, 96px)",
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
        }}
      >
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
          {config.kicker}
        </span>

        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "clamp(2.6rem, 6.4vw, 4.8rem)",
            marginTop: 16,
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
            fontWeight: 400,
            color: "rgba(245, 244, 242, 0.98)",
            maxWidth: 22 + "ch",
          }}
        >
          {config.headline}
        </h1>

        <p
          style={{
            marginTop: 18,
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(1.1rem, 1.6vw, 1.4rem)",
            color: "rgba(245, 244, 242, 0.7)",
            letterSpacing: "-0.01em",
            lineHeight: 1.4,
            maxWidth: 32 + "ch",
          }}
        >
          {config.italicSubline}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
            marginTop: 32,
          }}
        >
          <Link
            href={config.primaryCta.href}
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
            {config.primaryCta.label}
          </Link>
          <Link
            href={config.secondaryCta.href}
            className="cta-ghost"
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
              color: "rgba(245, 244, 242, 0.95)",
              background: "transparent",
              border: "1px solid rgba(245, 244, 242, 0.22)",
              textDecoration: "none",
            }}
          >
            {config.secondaryCta.label}
          </Link>
        </div>

        <div style={{ marginTop: 48, width: "100%" }}>
          <ReactionSwarm
            theme="dark"
            reactions={config.reactions}
            postLabel={config.postLabel}
            postAuthor={config.postAuthor}
            postBody={config.postBody}
          />
        </div>

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
