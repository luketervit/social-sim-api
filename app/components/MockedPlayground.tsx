"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentMessage } from "@/lib/simulation/types";

const PLAYBACK_DURATION_MS = 15_000;
const POST_COMPLETE_DELAY_MS = 350;

interface MockedRun {
  slug: string;
  audience_id: string;
  audience_name: string;
  platform: "twitter" | "reddit" | "slack";
  input: string;
  persona_cap: number;
  aggression_score: "low" | "moderate" | "high" | "critical";
  thread: AgentMessage[];
  generated_at: string;
}

interface MockedPlaygroundProps {
  /** /mocked-runs/{slug}.json under /public */
  slug: string;
  /** Whether the visitor is signed in (controls CTA target). Defaults false. */
  isSignedIn?: boolean;
}

const PLATFORM_LABELS: Record<MockedRun["platform"], string> = {
  twitter: "Twitter / X",
  reddit: "Reddit",
  slack: "Slack",
};

const SENTIMENT_COLORS: Record<AgentMessage["sentiment"], string> = {
  positive: "#1F8A55",
  neutral: "#6B6B6B",
  negative: "#C8552B",
  hostile: "#B23226",
};

const SENTIMENT_LABELS: Record<AgentMessage["sentiment"], string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  hostile: "Hostile",
};

const AGGRESSION_LABEL: Record<MockedRun["aggression_score"], string> = {
  low: "low aggression",
  moderate: "moderate aggression",
  high: "high aggression",
  critical: "critical aggression",
};

interface ClosingVerdict {
  surface: string;
  body: ReactNode;
}

const CLOSING_VERDICT: Record<string, ClosingVerdict> = {
  home: {
    surface: "From the outside, this is a routine free-tier announcement.",
    body: (
      <>
        Running this <strong>stopped the enshittification post.</strong> The
        thread read it as a sketchy data play, an ad-tier-incoming setup, and
        &ldquo;lol the cycle.&rdquo; You have time to add the line that says
        what your free tier <em>isn&rsquo;t</em>.
      </>
    ),
  },
  founder: {
    surface: "From the outside, this is a clean v2 launch tweet.",
    body: (
      <>
        Running this <strong>stopped the four-day apology cycle.</strong> The
        thread read it as another wrapper, a stealth price-hike, and
        &ldquo;shipping &gt; posting.&rdquo; Your reply guys would have ratio&rsquo;d
        you inside an hour.
      </>
    ),
  },
  vc: {
    surface: "On paper, this is the standard restructuring statement.",
    body: (
      <>
        Running this <strong>stopped the TechCrunch ratio.</strong> The audience
        read it as runway theatre, a soft fire, and a hint the next round
        won&rsquo;t close — 48 hours before the leak would have framed the
        narrative for you.
      </>
    ),
  },
  pm: {
    surface:
      "From the outside, this is a generous grandfather-clause pricing change.",
    body: (
      <>
        Running this <strong>stopped the cancel thread.</strong> The audience
        read the 12-month grace period as cover for a stealth hike on existing
        users. The App Store review brigade was already drafting.
      </>
    ),
  },
  alignment: {
    surface: "On its face, this is a neutral research finding.",
    body: (
      <>
        Running this <strong>stopped the citogenesis trap.</strong> The same
        line gets quoted by both sides of the AI debate, then re-cited as a
        primary source. Press would have framed your finding before you did.
      </>
    ),
  },
  comms: {
    surface: "Looks like a cleanly-worded RTO mandate.",
    body: (
      <>
        Running this <strong>stopped the leak.</strong> Senior engineers
        refreshed their LinkedIns by round two; remote hires asked about
        severance by round five. HR has 24 hours and a rewrite to keep the
        team.
      </>
    ),
  },
};

const HANDLE_PREFIX: Record<MockedRun["platform"], string> = {
  twitter: "@",
  reddit: "u/",
  slack: "",
};

function formatHandle(platform: MockedRun["platform"], archetype: string): string {
  const cleaned = archetype.replace(/\s+/g, platform === "reddit" ? "_" : "");
  return `${HANDLE_PREFIX[platform]}${cleaned}`;
}

interface RoundSchedule {
  startIndex: number;
  count: number;
  round: number;
  startTime: number;
  endTime: number;
}

/**
 * Group thread messages by round, then assign each round an equal slice of the
 * total playback window. Within each slice messages reveal in order — feels
 * like simultaneous activation per the dissertation §3.5.1.
 */
function buildSchedule(thread: AgentMessage[]): RoundSchedule[] {
  if (thread.length === 0) return [];
  const rounds: RoundSchedule[] = [];
  let currentRound = thread[0].round;
  let runStart = 0;
  for (let i = 0; i <= thread.length; i++) {
    const next = thread[i];
    if (i === thread.length || (next && next.round !== currentRound)) {
      rounds.push({
        startIndex: runStart,
        count: i - runStart,
        round: currentRound,
        startTime: 0,
        endTime: 0,
      });
      runStart = i;
      if (next) currentRound = next.round;
    }
  }
  const base = PLAYBACK_DURATION_MS / rounds.length;
  let elapsed = 0;
  for (const r of rounds) {
    r.startTime = elapsed;
    r.endTime = elapsed + base;
    elapsed += base;
  }
  return rounds;
}

export default function MockedPlayground({
  slug,
  isSignedIn = false,
}: MockedPlaygroundProps) {
  const [run, setRun] = useState<MockedRun | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");
  const [revealedCount, setRevealedCount] = useState(0);
  const [activeRound, setActiveRound] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const schedule = useMemo(() => (run ? buildSchedule(run.thread) : []), [run]);
  const totalRounds = schedule.length;

  // Load the cached run on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`/mocked-runs/${slug}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load mocked run (${res.status})`);
        return res.json();
      })
      .then((data: MockedRun) => {
        if (cancelled) return;
        setRun(data);
        setInput(data.input);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Auto-scroll the streaming list as new messages reveal.
  useEffect(() => {
    if (!streamRef.current) return;
    const el = streamRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [revealedCount]);

  // Cleanup the ticker on unmount.
  useEffect(() => {
    return () => {
      if (tickerRef.current != null) window.clearInterval(tickerRef.current);
    };
  }, []);

  function startPlayback() {
    if (!run || status === "running") return;
    setStatus("running");
    setRevealedCount(0);
    setActiveRound(schedule[0]?.round ?? 0);
    startedAtRef.current = performance.now();

    if (tickerRef.current != null) window.clearInterval(tickerRef.current);
    tickerRef.current = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - (startedAtRef.current ?? now);

      let totalRevealed = 0;
      let currentRoundIdx = 0;
      for (let i = 0; i < schedule.length; i++) {
        const r = schedule[i];
        if (elapsed >= r.endTime) {
          totalRevealed += r.count;
          currentRoundIdx = i + 1;
          continue;
        }
        if (elapsed >= r.startTime) {
          const t = (elapsed - r.startTime) / (r.endTime - r.startTime);
          totalRevealed += Math.floor(t * r.count);
          currentRoundIdx = i;
          break;
        }
        break;
      }

      setRevealedCount((prev) => (totalRevealed > prev ? totalRevealed : prev));
      setActiveRound(schedule[currentRoundIdx]?.round ?? schedule.at(-1)?.round ?? 0);

      if (elapsed >= PLAYBACK_DURATION_MS) {
        if (tickerRef.current != null) window.clearInterval(tickerRef.current);
        tickerRef.current = null;
        setRevealedCount(run.thread.length);
        setActiveRound(schedule.at(-1)?.round ?? 0);
        window.setTimeout(() => setStatus("complete"), POST_COMPLETE_DELAY_MS);
      }
    }, 80);
  }

  const sentimentBreakdown = useMemo(() => {
    if (!run) return { hostile: 0, negative: 0, neutral: 0, positive: 0 };
    const visible = run.thread.slice(0, revealedCount);
    return {
      hostile: visible.filter((m) => m.sentiment === "hostile").length,
      negative: visible.filter((m) => m.sentiment === "negative").length,
      neutral: visible.filter((m) => m.sentiment === "neutral").length,
      positive: visible.filter((m) => m.sentiment === "positive").length,
    };
  }, [run, revealedCount]);

  const visibleMessages = useMemo(() => {
    if (!run) return [] as AgentMessage[];
    return run.thread.slice(0, revealedCount);
  }, [run, revealedCount]);

  const ctaHref = isSignedIn
    ? "/dashboard"
    : "/login?mode=signup&next=%2Fdashboard";
  const ctaLabel = isSignedIn ? "Open dashboard" : "Get early access";

  const submitLabel =
    status === "running"
      ? `streaming · round ${activeRound} / ${totalRounds || 10}`
      : status === "complete" && run
        ? `${run.aggression_score} · ${visibleMessages.length} replies`
        : "Run simulation →";

  return (
    <section
      id="playground"
      style={{ padding: "72px 0 96px", background: "var(--bg)" }}
    >
      <div
        className="mx-auto px-6"
        style={{ maxWidth: 760 }}
      >
        <div className="mono-label" style={{ color: "var(--text-tertiary)" }}>
          THE PLAYGROUND
        </div>
        <h2 className="atharias-mock-title">
          Try it on something{" "}
          <span style={{ fontStyle: "italic" }}>you&rsquo;d actually post.</span>
        </h2>
        <p className="atharias-mock-sub">
          Drop a draft, pick an audience, watch {run?.persona_cap ?? 60} synthetic
          users react across {totalRounds || 10} rounds in 15 seconds.
        </p>

        {/* Composer */}
        <div className="atharias-mock-composer">
          <div className="atharias-mock-meta">
            <span className="mono-label" style={{ color: "var(--text-tertiary)" }}>
              {run?.audience_name ?? "Loading…"}
            </span>
            <span aria-hidden="true" className="atharias-mock-dot">
              ·
            </span>
            <span className="mono-label" style={{ color: "var(--text-tertiary)" }}>
              {run ? PLATFORM_LABELS[run.platform] : ""}
            </span>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="atharias-mock-textarea"
            rows={3}
            maxLength={2000}
            aria-label="Post draft"
          />

          <div className="atharias-mock-actions">
            <button
              type="button"
              onClick={startPlayback}
              disabled={!run || status === "running"}
              className="atharias-mock-run"
              aria-busy={status === "running"}
              aria-live="polite"
            >
              {submitLabel}
            </button>
            <Link href={ctaHref} className="atharias-mock-cta">
              {ctaLabel}
            </Link>
          </div>

          {loadError ? (
            <p className="atharias-mock-error" role="alert">
              {loadError}
            </p>
          ) : null}
        </div>

        {/* Stream */}
        {status !== "idle" && run ? (
          <div className="atharias-mock-stream-wrap">
            <div className="atharias-mock-stream-header">
              <span className="mono-label" style={{ color: "var(--text-tertiary)" }}>
                LIVE THREAD
              </span>
              <span
                className="atharias-mock-stats"
                aria-live="polite"
              >
                <Stat
                  count={sentimentBreakdown.positive}
                  label="positive"
                  color={SENTIMENT_COLORS.positive}
                />
                <Stat
                  count={sentimentBreakdown.neutral}
                  label="neutral"
                  color={SENTIMENT_COLORS.neutral}
                />
                <Stat
                  count={sentimentBreakdown.negative}
                  label="negative"
                  color={SENTIMENT_COLORS.negative}
                />
                <Stat
                  count={sentimentBreakdown.hostile}
                  label="hostile"
                  color={SENTIMENT_COLORS.hostile}
                />
                {status === "complete" ? (
                  <span className="atharias-mock-aggregate">
                    {AGGRESSION_LABEL[run.aggression_score]}
                  </span>
                ) : null}
              </span>
            </div>

            <div ref={streamRef} className="atharias-mock-stream">
              {/* Replies */}
              {visibleMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="atharias-mock-reply"
                  style={{ borderLeftColor: SENTIMENT_COLORS[msg.sentiment] }}
                >
                  <div className="atharias-mock-reply-head">
                    <span className="atharias-mock-handle">
                      {formatHandle(run.platform, msg.archetype)}
                    </span>
                    <span className="atharias-mock-round">R{msg.round}</span>
                    <span
                      className="atharias-mock-sentiment"
                      style={{ color: SENTIMENT_COLORS[msg.sentiment] }}
                    >
                      {SENTIMENT_LABELS[msg.sentiment]}
                    </span>
                  </div>
                  <p className="atharias-mock-body">{msg.message}</p>
                </div>
              ))}

              {/* Pulsing placeholder while a round is in progress */}
              {status === "running" && visibleMessages.length > 0 ? (
                <div
                  aria-hidden="true"
                  className="atharias-mock-streaming-tail"
                >
                  <span className="atharias-mock-pulse">
                    round {activeRound} streaming…
                  </span>
                </div>
              ) : null}
            </div>

            {status === "complete" && CLOSING_VERDICT[slug] ? (
              <div className="atharias-mock-verdict">
                <div className="atharias-mock-verdict-eyebrow">
                  <span className="mono-label">VERDICT</span>
                  <span className="atharias-mock-verdict-aggression">
                    {AGGRESSION_LABEL[run.aggression_score]}
                  </span>
                </div>
                <p className="atharias-mock-verdict-surface">
                  &ldquo;{CLOSING_VERDICT[slug].surface}&rdquo;
                </p>
                <p className="atharias-mock-verdict-body">
                  {CLOSING_VERDICT[slug].body}
                </p>
                <Link href={ctaHref} className="atharias-mock-verdict-cta">
                  {ctaLabel} →
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        .atharias-mock-title {
          font-family: var(--font-display), Georgia, serif;
          font-size: clamp(36px, 5vw, 56px);
          line-height: 1.05;
          letter-spacing: -0.04em;
          color: var(--text-primary);
          margin-top: 12px;
          text-wrap: balance;
        }
        .atharias-mock-sub {
          color: var(--text-secondary);
          font-size: 16px;
          line-height: 1.55;
          margin-top: 16px;
          max-width: 580px;
          font-variant-numeric: tabular-nums;
          text-wrap: pretty;
        }

        .atharias-mock-composer {
          margin-top: 32px;
          padding: 22px 24px 20px;
          background: var(--bg-element, #ffffff);
          border-radius: 18px;
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.05),
            0 1px 3px rgba(0, 0, 0, 0.03),
            0 12px 32px rgba(0, 0, 0, 0.04);
        }
        .atharias-mock-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }
        .atharias-mock-dot {
          color: var(--text-tertiary);
          font-family: var(--font-data), monospace;
        }
        .atharias-mock-textarea {
          width: 100%;
          margin-top: 14px;
          padding: 4px 0;
          font-family: var(--font-display), Georgia, serif;
          font-size: 22px;
          line-height: 1.4;
          color: var(--text-primary);
          background: transparent;
          border: none;
          resize: none;
          outline: none;
          letter-spacing: -0.01em;
          min-height: 96px;
        }
        .atharias-mock-textarea::placeholder {
          color: var(--text-tertiary);
        }

        .atharias-mock-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 18px;
          flex-wrap: wrap;
        }
        .atharias-mock-run {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 22px;
          border-radius: 999px;
          background: var(--ink, #141413);
          color: var(--butter-deep, #e8d27a);
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.01em;
          border: none;
          cursor: pointer;
          min-width: 200px;
          transition:
            background 160ms cubic-bezier(0.215, 0.61, 0.355, 1),
            transform 80ms cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .atharias-mock-run:hover {
            background: #1f1f1d;
          }
        }
        .atharias-mock-run:active {
          transform: scale(0.99);
        }
        .atharias-mock-run:disabled {
          opacity: 0.85;
          cursor: progress;
        }
        .atharias-mock-run:focus-visible {
          outline: 2px solid var(--ink, #141413);
          outline-offset: 3px;
        }

        .atharias-mock-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 18px;
          border-radius: 999px;
          background: transparent;
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
          transition:
            background 160ms cubic-bezier(0.215, 0.61, 0.355, 1),
            box-shadow 160ms cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .atharias-mock-cta:hover {
            background: var(--bg-subtle, #f5f4f2);
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
          }
        }
        .atharias-mock-cta:focus-visible {
          outline: 2px solid var(--ink, #141413);
          outline-offset: 3px;
        }

        .atharias-mock-error {
          margin-top: 14px;
          font-size: 13px;
          color: #b1311a;
        }

        .atharias-mock-stream-wrap {
          margin-top: 28px;
        }
        .atharias-mock-stream-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        .atharias-mock-stats {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          font-family: var(--font-data), monospace;
          font-size: 12px;
          color: var(--text-tertiary);
          font-variant-numeric: tabular-nums;
        }
        .atharias-mock-stat {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          min-width: 56px;
        }
        .atharias-mock-stat-num {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          font-size: 13px;
        }
        .atharias-mock-aggregate {
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--bg-subtle, #f5f4f2);
          color: var(--text-primary);
          font-family: var(--font-data), monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .atharias-mock-stream {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 6px;
        }
        .atharias-mock-reply {
          padding: 12px 14px;
          background: var(--bg-element, #ffffff);
          border-radius: 12px;
          border-left: 3px solid;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.04);
          animation: atharias-mock-fade-in 220ms cubic-bezier(0.215, 0.61, 0.355, 1)
            both;
        }
        .atharias-mock-reply-head {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
          font-family: var(--font-data), monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
        }
        .atharias-mock-handle {
          color: var(--text-primary);
          font-weight: 600;
        }
        .atharias-mock-round {
          color: var(--text-tertiary);
          font-variant-numeric: tabular-nums;
        }
        .atharias-mock-sentiment {
          margin-left: auto;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.06em;
        }
        .atharias-mock-body {
          margin-top: 6px;
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-primary);
          text-wrap: pretty;
        }

        .atharias-mock-streaming-tail {
          padding: 6px 4px 0;
          font-family: var(--font-data), monospace;
          font-size: 11px;
          color: var(--text-tertiary);
          font-variant-numeric: tabular-nums;
          pointer-events: none;
          user-select: none;
        }
        .atharias-mock-pulse {
          animation: atharias-mock-pulse 1.2s
            cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
        }

        .atharias-mock-verdict {
          margin-top: 28px;
          padding: 26px 28px 24px;
          background: var(--ink, #141413);
          color: rgba(245, 244, 242, 0.95);
          border-radius: 18px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12);
        }
        .atharias-mock-verdict-eyebrow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .atharias-mock-verdict-eyebrow .mono-label {
          color: var(--butter-deep, #e8d27a);
        }
        .atharias-mock-verdict-aggression {
          font-family: var(--font-data), monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(245, 244, 242, 0.55);
          font-variant-numeric: tabular-nums;
        }
        .atharias-mock-verdict-surface {
          margin-top: 16px;
          font-family: var(--font-display), Georgia, serif;
          font-style: italic;
          font-size: clamp(20px, 2.4vw, 24px);
          line-height: 1.3;
          color: rgba(245, 244, 242, 0.78);
          letter-spacing: -0.01em;
          text-wrap: balance;
        }
        .atharias-mock-verdict-body {
          margin-top: 14px;
          font-size: 16px;
          line-height: 1.55;
          color: rgba(245, 244, 242, 0.95);
          text-wrap: pretty;
        }
        .atharias-mock-verdict-body strong {
          color: var(--butter-deep, #e8d27a);
          font-weight: 600;
        }
        .atharias-mock-verdict-body em {
          font-style: italic;
        }
        .atharias-mock-verdict-cta {
          display: inline-flex;
          align-items: center;
          margin-top: 22px;
          padding: 11px 20px;
          border-radius: 999px;
          background: var(--butter-deep, #e8d27a);
          color: var(--ink, #141413);
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          text-decoration: none;
          transition:
            background 160ms cubic-bezier(0.215, 0.61, 0.355, 1),
            transform 80ms cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .atharias-mock-verdict-cta:hover {
            background: #f0db90;
          }
        }
        .atharias-mock-verdict-cta:active {
          transform: scale(0.99);
        }
        .atharias-mock-verdict-cta:focus-visible {
          outline: 2px solid var(--butter-deep, #e8d27a);
          outline-offset: 3px;
        }

        @keyframes atharias-mock-fade-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes atharias-mock-pulse {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .atharias-mock-reply,
          .atharias-mock-pulse {
            animation: none;
          }
          .atharias-mock-run,
          .atharias-mock-cta,
          .atharias-mock-verdict-cta {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}

function Stat({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <span className="atharias-mock-stat">
      <span className="atharias-mock-stat-num" style={{ color }}>
        {count}
      </span>
      <span>{label}</span>
    </span>
  );
}
