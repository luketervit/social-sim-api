"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentMessage } from "@/lib/simulation/types";
import Reveal from "./Reveal";

const PLAYBACK_DURATION_MS = 15_000;
const POST_COMPLETE_DELAY_MS = 400;

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
  isSignedIn: boolean;
  /** Optional override of the prompt shown in the textarea. */
  defaultPrompt?: string;
}

const PLATFORM_LABELS: Record<MockedRun["platform"], string> = {
  twitter: "Twitter / X",
  reddit: "Reddit",
  slack: "Slack",
};

const PLATFORM_CONTEXT: Record<MockedRun["platform"], string> = {
  twitter: "Short-form, fast spread, high signal",
  reddit: "Long-form, threaded, technical scrutiny",
  slack: "Corporate, internal, team dynamics",
};

const AGGRESSION_COLORS: Record<MockedRun["aggression_score"], string> = {
  low: "#34D399",
  moderate: "#F59E0B",
  high: "#F97066",
  critical: "#EF4444",
};

const SENTIMENT_COLORS: Record<AgentMessage["sentiment"], string> = {
  positive: "#34D399",
  neutral: "#9E9E9E",
  negative: "#F97066",
  hostile: "#EF4444",
};

const SENTIMENT_LABELS: Record<AgentMessage["sentiment"], string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  hostile: "Hostile",
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
  /** Index into thread where this round's messages start. */
  startIndex: number;
  /** Number of messages in this round. */
  count: number;
  /** Round number from the AgentMessage. */
  round: number;
  /** ms from playback start when this round begins revealing. */
  startTime: number;
  /** ms from playback start when this round finishes revealing. */
  endTime: number;
}

/**
 * Group thread messages by round, then assign each round a slice of the total
 * playback window. Within each slice, messages stream in evenly so the round
 * arrives in a recognisable burst (matching dissertation §3.5.1 synchronous
 * activation).
 */
function buildSchedule(thread: AgentMessage[]): RoundSchedule[] {
  if (thread.length === 0) return [];
  const rounds: RoundSchedule[] = [];
  let cursor = 0;
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
  // Distribute time: each round gets a base slice + a small ramp-up bias toward
  // earlier rounds (so the user doesn't wait long for the first replies).
  const base = PLAYBACK_DURATION_MS / rounds.length;
  let elapsed = 0;
  for (const r of rounds) {
    r.startTime = elapsed;
    r.endTime = elapsed + base;
    elapsed += base;
    cursor += r.count;
  }
  void cursor;
  return rounds;
}

export default function MockedPlayground({
  slug,
  isSignedIn,
  defaultPrompt,
}: MockedPlaygroundProps) {
  const [run, setRun] = useState<MockedRun | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState(defaultPrompt ?? "");
  const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");
  const [revealedCount, setRevealedCount] = useState(0);
  const [activeRound, setActiveRound] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const liveListRef = useRef<HTMLDivElement | null>(null);

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
        if (!defaultPrompt) setInput(data.input);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, defaultPrompt]);

  // Auto-scroll the streaming list as messages reveal.
  useEffect(() => {
    if (!liveListRef.current) return;
    liveListRef.current.scrollTop = liveListRef.current.scrollHeight;
  }, [revealedCount]);

  // Clean up timer on unmount.
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

      // Find which round we're in and how far through it.
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

      setRevealedCount((prev) =>
        totalRevealed > prev ? totalRevealed : prev
      );

      const liveRound = schedule[currentRoundIdx]?.round ?? schedule.at(-1)?.round ?? 0;
      setActiveRound(liveRound);

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
    if (!run)
      return { hostile: 0, negative: 0, neutral: 0, positive: 0 };
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

  const ctaHref = isSignedIn ? "/dashboard" : "/login?mode=signup&next=%2Fdashboard";
  const ctaLabel = isSignedIn ? "Open dashboard" : "Sign up to run yours";

  return (
    <section
      id="playground"
      className="section-shell"
      style={{ paddingTop: 48, paddingBottom: 64 }}
    >
      <div
        className="mx-auto max-w-[1200px] px-6"
        style={{ display: "flex", flexDirection: "column", gap: 28 }}
      >
        <Reveal as="div">
          <div className="mono-label">THE PLAYGROUND</div>
          <h2
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "var(--text-primary)",
              fontFamily: "var(--font-display), Georgia, serif",
              marginTop: 14,
              maxWidth: 720,
            }}
          >
            Try it on something{" "}
            <span style={{ fontStyle: "italic" }}>you&apos;d actually post.</span>
          </h2>
        </Reveal>

        <Reveal
          as="div"
          className="grid gap-5"
          style={{ gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.1fr)" }}
        >
          {/* Left: form */}
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              padding: "26px 26px 22px",
              border: "1px solid var(--border)",
            }}
          >
            <label
              htmlFor={`mock-input-${slug}`}
              className="mono-label"
              style={{ display: "block", marginBottom: 10 }}
            >
              Your post
            </label>
            <textarea
              id={`mock-input-${slug}`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="input"
              rows={6}
              maxLength={2000}
              style={{
                width: "100%",
                minHeight: 160,
                resize: "vertical",
                fontSize: 15,
                lineHeight: 1.5,
              }}
            />

            <div
              className="grid gap-4 mt-5"
              style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}
            >
              <div>
                <span
                  className="mono-label"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Audience
                </span>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "11px 14px",
                    fontSize: 14,
                    color: "var(--text-primary)",
                  }}
                >
                  {run?.audience_name ?? "Loading…"}
                </div>
              </div>

              <div>
                <span
                  className="mono-label"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Environment
                </span>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "11px 14px",
                    fontSize: 14,
                    color: "var(--text-primary)",
                  }}
                >
                  {run ? PLATFORM_LABELS[run.platform] : "Loading…"}
                </div>
              </div>
            </div>

            <p
              className="mt-4 text-[12px]"
              style={{
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-data), monospace",
                lineHeight: 1.6,
              }}
            >
              Instant queueing &nbsp;·&nbsp; {run?.persona_cap ?? 60}-agent sample &nbsp;·&nbsp;{" "}
              {run ? PLATFORM_CONTEXT[run.platform] : "loading…"}
            </p>

            <div className="mt-5 flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={startPlayback}
                disabled={!run || status === "running"}
                className="btn-primary"
                style={{ minHeight: 44, padding: "10px 22px" }}
              >
                {status === "idle"
                  ? "Run simulation →"
                  : status === "running"
                    ? "Streaming…"
                    : "Run again"}
              </button>
              <Link
                href={ctaHref}
                className="btn-secondary"
                style={{ minHeight: 44, padding: "10px 18px" }}
              >
                {ctaLabel}
              </Link>
            </div>

            {loadError ? (
              <p
                className="mt-3 text-[12px]"
                style={{ color: "var(--coral)" }}
              >
                {loadError}
              </p>
            ) : null}
          </div>

          {/* Right: live stream */}
          <div
            style={{
              background: "var(--bg-subtle, var(--surface))",
              borderRadius: 14,
              padding: "26px 26px 22px",
              border: "1px solid var(--border)",
              minHeight: 540,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="mono-label">Live Output</div>
                <p
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 18,
                    marginTop: 6,
                    letterSpacing: "-0.02em",
                    fontFamily: "var(--font-display), Georgia, serif",
                  }}
                >
                  {run?.audience_name ?? "—"}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color:
                    status === "complete" && run
                      ? AGGRESSION_COLORS[run.aggression_score]
                      : status === "running"
                        ? "var(--accent, #7C5CFC)"
                        : "var(--text-tertiary)",
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "var(--font-data), monospace",
                  letterSpacing: "0.04em",
                }}
              >
                {status === "idle"
                  ? "ready"
                  : status === "running"
                    ? `round ${activeRound} / ${totalRounds || 10}`
                    : run
                      ? `${run.aggression_score} aggression`
                      : "complete"}
              </span>
            </div>

            {/* Live stats strip — visible during running and complete */}
            {(status === "running" || status === "complete") && run ? (
              <div
                className="mt-4 grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                }}
              >
                <StatChip
                  label="Pos"
                  value={sentimentBreakdown.positive}
                  color={SENTIMENT_COLORS.positive}
                />
                <StatChip
                  label="Neu"
                  value={sentimentBreakdown.neutral}
                  color={SENTIMENT_COLORS.neutral}
                />
                <StatChip
                  label="Neg"
                  value={sentimentBreakdown.negative}
                  color={SENTIMENT_COLORS.negative}
                />
                <StatChip
                  label="Host"
                  value={sentimentBreakdown.hostile}
                  color={SENTIMENT_COLORS.hostile}
                />
              </div>
            ) : null}

            {/* Idle-state hint */}
            {status === "idle" && run ? (
              <div
                className="mt-6"
                style={{
                  padding: "20px 18px",
                  borderRadius: 10,
                  border: "1px dashed var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Hit <strong style={{ color: "var(--text-primary)" }}>Run simulation</strong>{" "}
                to watch {run.persona_cap} synthetic users react across{" "}
                {totalRounds || 10} rounds in real time.
              </div>
            ) : null}

            {/* Stream */}
            {(status === "running" || status === "complete") && run ? (
              <div
                ref={liveListRef}
                className="mt-4"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  flex: 1,
                  maxHeight: 420,
                  overflowY: "auto",
                  paddingRight: 4,
                  scrollBehavior: "smooth",
                }}
              >
                {/* Root post — what they're reacting to */}
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontSize: 13,
                    lineHeight: 1.5,
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <div
                    className="mono-label"
                    style={{ fontSize: 10, color: "var(--text-tertiary)" }}
                  >
                    ROOT POST
                  </div>
                  <div
                    style={{
                      color: "var(--text-primary)",
                      marginTop: 6,
                      fontStyle: "italic",
                    }}
                  >
                    “{run.input}”
                  </div>
                </div>

                {/* Replies */}
                {visibleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      background: "var(--surface)",
                      border: `1px solid ${SENTIMENT_COLORS[msg.sentiment]}33`,
                      borderLeft: `3px solid ${SENTIMENT_COLORS[msg.sentiment]}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 13,
                      lineHeight: 1.5,
                      animation: "atharias-fade-in 220ms ease-out both",
                    }}
                  >
                    <div
                      className="flex items-center justify-between gap-2"
                      style={{ marginBottom: 4 }}
                    >
                      <span
                        className="mono-label"
                        style={{
                          fontSize: 10,
                          color: "var(--text-tertiary)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {formatHandle(run.platform, msg.archetype)} · R{msg.round}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: SENTIMENT_COLORS[msg.sentiment],
                          fontFamily: "var(--font-data), monospace",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {SENTIMENT_LABELS[msg.sentiment]}
                      </span>
                    </div>
                    <div style={{ color: "var(--text-primary)" }}>
                      {msg.message}
                    </div>
                  </div>
                ))}

                {/* Typing-indicator-style placeholder for the next round */}
                {status === "running" && visibleMessages.length > 0 ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      color: "var(--text-tertiary)",
                      fontSize: 11,
                      fontFamily: "var(--font-data), monospace",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span className="atharias-pulse">round {activeRound} streaming…</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Reveal>
      </div>

      <style jsx global>{`
        @keyframes atharias-fade-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes atharias-pulse-anim {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 1;
          }
        }
        .atharias-pulse {
          animation: atharias-pulse-anim 1.2s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "8px 10px",
        textAlign: "center",
        transition: "all 160ms ease-out",
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-data), monospace",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          color,
          fontFamily: "var(--font-display), Georgia, serif",
          marginTop: 2,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
