"use client";

import { useEffect, useState } from "react";

type Sentiment = "hostile" | "positive" | "noise";

type Reaction = {
  body: string;
  handle: string;
  sentiment: Sentiment;
  x: number;
  y: number;
  rotate: number;
  delay: number;
};

const REACTIONS: Reaction[] = [
  { body: "ratio", handle: "@dril_lite", sentiment: "hostile", x: 6, y: 10, rotate: -3, delay: 600 },
  { body: "this is so out of touch", handle: "@notgenz", sentiment: "hostile", x: 72, y: 4, rotate: 2, delay: 800 },
  { body: "based actually", handle: "@buildlogs", sentiment: "positive", x: 78, y: 30, rotate: -1, delay: 1100 },
  { body: "ok PM", handle: "@quietquit", sentiment: "hostile", x: 4, y: 48, rotate: 1, delay: 1300 },
  { body: "who asked", handle: "@reply_guy", sentiment: "hostile", x: 84, y: 60, rotate: -2, delay: 1500 },
  { body: "deleting my account", handle: "@bigfeels", sentiment: "hostile", x: 2, y: 76, rotate: 2, delay: 1700 },
  { body: "finally", handle: "@power_user", sentiment: "positive", x: 70, y: 82, rotate: -3, delay: 1900 },
  { body: "lol", handle: "@anon", sentiment: "noise", x: 36, y: 92, rotate: 1, delay: 2100 },
  { body: "i'm screenshotting this", handle: "@receipts", sentiment: "hostile", x: 48, y: -2, rotate: -1, delay: 2300 },
  { body: "shipping > posting", handle: "@founder", sentiment: "positive", x: 16, y: 28, rotate: -2, delay: 2500 },
  { body: "this didn't need to be a tweet", handle: "@editor", sentiment: "hostile", x: 86, y: 46, rotate: 2, delay: 2700 },
  { body: "huh", handle: "@noopinion", sentiment: "noise", x: 12, y: 64, rotate: 1, delay: 2900 },
];

type Theme = "light" | "dark";

export default function ReactionSwarm({ theme = "light" }: { theme?: Theme }) {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handle = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  const isDark = theme === "dark";
  const surface = isDark ? "rgba(28, 27, 25, 0.92)" : "var(--surface)";
  const chipBorder = isDark ? "1px solid rgba(245, 244, 242, 0.12)" : "1px solid var(--border)";
  const text = isDark ? "rgba(245, 244, 242, 0.95)" : "var(--text-primary)";
  const muted = isDark ? "rgba(245, 244, 242, 0.5)" : "var(--text-tertiary)";
  const chipShadow = isDark
    ? "0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.35)"
    : "0 1px 2px rgba(0,0,0,0.03), 0 6px 18px rgba(20,20,19,0.05)";
  const postShadow = isDark
    ? "0 0 0 1px rgba(245, 244, 242, 0.08), 0 16px 48px rgba(0,0,0,0.45)"
    : "0 0 0 1px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04), 0 16px 40px rgba(20,20,19,0.06)";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
        aspectRatio: "5 / 4",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {/* Central post */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(360px, 62%)",
          background: surface,
          borderRadius: 18,
          padding: "20px 22px 18px",
          boxShadow: postShadow,
          opacity: mounted || reduced ? 1 : 0,
          transition: "opacity 600ms var(--ease-out-cubic)",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: isDark
                ? "linear-gradient(135deg, var(--butter-deep) 0%, var(--tomato) 100%)"
                : "linear-gradient(135deg, var(--accent) 0%, var(--tomato) 100%)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: text }}>
              your launch post
            </span>
            <span style={{ fontSize: 11, color: muted }}>
              @you · drafted 2m ago
            </span>
          </div>
        </div>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: text,
            margin: 0,
          }}
        >
          we&apos;re sunsetting the free tier next month
        </p>
      </div>

      {/* Reaction chips */}
      {REACTIONS.map((r, i) => {
        const visible = reduced ? true : mounted;
        const delay = reduced ? 0 : r.delay;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${r.x}%`,
              top: `${r.y}%`,
              maxWidth: 220,
              padding: "9px 13px 10px",
              background: surface,
              borderRadius: 14,
              border: chipBorder,
              boxShadow: chipShadow,
              transform: `rotate(${r.rotate}deg) translateY(${visible ? 0 : 8}px) scale(${visible ? 1 : 0.92})`,
              opacity: visible ? 1 : 0,
              transition: `opacity 500ms var(--ease-out-cubic) ${delay}ms, transform 600ms var(--ease-out-quint) ${delay}ms`,
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background:
                    r.sentiment === "hostile"
                      ? "var(--coral)"
                      : r.sentiment === "positive"
                      ? "var(--mint)"
                      : muted,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  color: muted,
                  fontFamily: "var(--font-data), monospace",
                }}
              >
                {r.handle}
              </span>
            </div>
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.4,
                color: text,
              }}
            >
              {r.body}
            </span>
          </div>
        );
      })}
    </div>
  );
}
