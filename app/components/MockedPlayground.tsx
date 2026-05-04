"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentMessage } from "@/lib/simulation/types";
import Reveal from "./Reveal";

const PLAYBACK_DURATION_MS = 15_000;
const FINAL_REVEAL_BUFFER_MS = 600;
const TICK_MS = 90;

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

const HANDLE_PREFIX: Record<MockedRun["platform"], string> = {
  twitter: "@",
  reddit: "u/",
  slack: "",
};

function formatHandle(platform: MockedRun["platform"], archetype: string): string {
  return `${HANDLE_PREFIX[platform]}${archetype.replace(/\s+/g, platform === "reddit" ? "_" : "")}`;
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
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
  const [progressPct, setProgressPct] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const liveListRef = useRef<HTMLDivElement | null>(null);

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
    setProgressPct(0);
    setRevealedCount(0);
    startedAtRef.current = performance.now();

    if (tickerRef.current != null) window.clearInterval(tickerRef.current);
    tickerRef.current = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - (startedAtRef.current ?? now);
      const linearT = Math.min(1, elapsed / PLAYBACK_DURATION_MS);
      const easedT = easeOutCubic(linearT);
      const pct = Math.min(99, Math.round(easedT * 99));
      setProgressPct(pct);

      // Reveal messages in pace with eased progress (so they feel like they're
      // actually streaming in).
      const targetCount = Math.min(
        run.thread.length,
        Math.floor(easedT * run.thread.length)
      );
      setRevealedCount((prev) => (targetCount > prev ? targetCount : prev));

      if (linearT >= 1) {
        if (tickerRef.current != null) window.clearInterval(tickerRef.current);
        tickerRef.current = null;
        setProgressPct(100);
        setRevealedCount(run.thread.length);
        // Brief pause before snapping to complete state — feels less jarring.
        window.setTimeout(() => setStatus("complete"), FINAL_REVEAL_BUFFER_MS);
      }
    }, TICK_MS);
  }

  const sentimentBreakdown = useMemo(() => {
    if (!run) return { hostile: 0, negative: 0, neutral: 0, positive: 0 };
    return {
      hostile: run.thread.filter((m) => m.sentiment === "hostile").length,
      negative: run.thread.filter((m) => m.sentiment === "negative").length,
      neutral: run.thread.filter((m) => m.sentiment === "neutral").length,
      positive: run.thread.filter((m) => m.sentiment === "positive").length,
    };
  }, [run]);

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
            <span style={{ fontStyle: "italic" }}>you'd actually post.</span>
          </h2>
        </Reveal>

        <Reveal
          as="div"
          className="grid gap-5"
          style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}
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
                    ? "Running…"
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

          {/* Right: live output */}
          <div
            style={{
              background: "var(--bg-subtle, var(--surface))",
              borderRadius: 14,
              padding: "26px 26px 22px",
              border: "1px solid var(--border)",
              minHeight: 480,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="flex items-center justify-between gap-3">
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
                      : "var(--text-tertiary)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {status === "idle"
                  ? "ready"
                  : status === "running"
                    ? "running"
                    : run
                      ? `${run.aggression_score} aggression`
                      : "complete"}
              </span>
            </div>

            {status === "idle" && run ? (
              <p
                className="mt-6 text-[13px]"
                style={{ color: "var(--text-tertiary)", lineHeight: 1.6 }}
              >
                Hit <strong>Run simulation</strong> to watch {run.persona_cap} synthetic users
                react in real time.
              </p>
            ) : null}

            {(status === "running" || status === "complete") && run ? (
              <div className="mt-4">
                <div
                  className="h-1 overflow-hidden rounded-full"
                  style={{ background: "var(--border)" }}
                >
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      background: AGGRESSION_COLORS[run.aggression_score],
                      borderRadius: 999,
                      transition: "width 90ms linear",
                    }}
                  />
                </div>
                <div
                  className="mt-2 flex items-center justify-between text-[11px]"
                  style={{
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-data), monospace",
                  }}
                >
                  <span>
                    {visibleMessages.length} / {run.thread.length} replies
                  </span>
                  <span>{progressPct}%</span>
                </div>

                {/* Streaming reply list */}
                <div
                  ref={liveListRef}
                  className="mt-4"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    maxHeight: 320,
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  {visibleMessages.slice(-10).map((msg) => (
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
                        animation: "atharias-fade-in 240ms ease-out both",
                      }}
                    >
                      <div
                        className="mono-label"
                        style={{ fontSize: 10, color: "var(--text-tertiary)" }}
                      >
                        {formatHandle(run.platform, msg.archetype)}
                      </div>
                      <div style={{ color: "var(--text-primary)", marginTop: 4 }}>
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </div>

                {status === "complete" ? (
                  <div
                    className="mt-5 grid gap-3"
                    style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
                  >
                    <SentimentChip
                      label="Positive"
                      value={sentimentBreakdown.positive}
                      color={SENTIMENT_COLORS.positive}
                    />
                    <SentimentChip
                      label="Neutral"
                      value={sentimentBreakdown.neutral}
                      color={SENTIMENT_COLORS.neutral}
                    />
                    <SentimentChip
                      label="Negative"
                      value={sentimentBreakdown.negative}
                      color={SENTIMENT_COLORS.negative}
                    />
                    <SentimentChip
                      label="Hostile"
                      value={sentimentBreakdown.hostile}
                      color={SENTIMENT_COLORS.hostile}
                    />
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
      `}</style>
    </section>
  );
}

function SentimentChip({
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
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-data), monospace",
          letterSpacing: "0.06em",
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
        }}
      >
        {value}
      </div>
    </div>
  );
}
