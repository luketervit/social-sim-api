"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AgentMessage } from "@/lib/simulation/types";

interface SimulateComposerProps {
  audienceId: string;
  defaultPlatform: "twitter" | "reddit" | "slack";
  audienceSize: number;
}

type Platform = "twitter" | "reddit" | "slack";
type RunStatus = "idle" | "queued" | "running" | "completed" | "failed";

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

const PLATFORM_LABEL: Record<Platform, string> = {
  twitter: "Twitter / X",
  reddit: "Reddit",
  slack: "Slack",
};

const PLATFORM_HANDLE: Record<Platform, string> = {
  twitter: "@",
  reddit: "u/",
  slack: "",
};

const DEFAULT_PERSONA_CAP = 25;
const SIMULATION_ROUNDS = 10;
const POLL_INTERVAL_MS = 1500;

function formatHandle(platform: Platform, archetype: string): string {
  const cleaned = archetype.replace(/\s+/g, platform === "reddit" ? "_" : "");
  return `${PLATFORM_HANDLE[platform]}${cleaned}`;
}

export default function SimulateComposer({
  audienceId,
  defaultPlatform,
  audienceSize,
}: SimulateComposerProps) {
  const [post, setPost] = useState("");
  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const [personaCap, setPersonaCap] = useState<number>(
    Math.min(DEFAULT_PERSONA_CAP, audienceSize || DEFAULT_PERSONA_CAP)
  );
  const [variations, setVariations] = useState(false);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [thread, setThread] = useState<AgentMessage[]>([]);
  const [aggression, setAggression] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const cappedSize = Math.max(5, Math.min(personaCap, audienceSize || 200));
  const estCredits = cappedSize * SIMULATION_ROUNDS;

  // Poll the status endpoint while a sim is running.
  useEffect(() => {
    if (!simulationId) return;
    if (status !== "queued" && status !== "running") return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/simulate/${simulationId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (Array.isArray(data.thread)) {
          setThread(data.thread as AgentMessage[]);
        }
        if (data.aggressionScore) {
          setAggression(data.aggressionScore as string);
        }

        if (data.status === "running") {
          setStatus("running");
        } else if (data.status === "completed") {
          setStatus("completed");
        } else if (data.status === "failed") {
          setStatus("failed");
          setError(
            typeof data.errorMessage === "string"
              ? data.errorMessage
              : "Simulation failed."
          );
        }
      } catch {
        // ignore network blips
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [simulationId, status]);

  // Auto-scroll the thread.
  useEffect(() => {
    if (!streamRef.current) return;
    const el = streamRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [thread.length]);

  async function handleRun() {
    if (post.trim().length === 0) {
      setError("Paste a post first.");
      return;
    }
    setError(null);
    setThread([]);
    setAggression(null);
    setSimulationId(null);
    setStatus("queued");

    try {
      const res = await fetch("/api/v1/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceId,
          platform,
          input: post.trim(),
          personaCap: cappedSize,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Could not start simulation.");
      }

      setSimulationId(payload.simulationId as string);
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Failed to start.");
    }
  }

  const isRunning = status === "queued" || status === "running";

  const sentimentBreakdown = {
    hostile: thread.filter((m) => m.sentiment === "hostile").length,
    negative: thread.filter((m) => m.sentiment === "negative").length,
    neutral: thread.filter((m) => m.sentiment === "neutral").length,
    positive: thread.filter((m) => m.sentiment === "positive").length,
  };

  return (
    <section
      aria-label="Run a simulation"
      style={{
        padding: "clamp(28px, 3vw, 40px)",
        borderRadius: 20,
        background: "var(--surface)",
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.04), 0 14px 40px rgba(20,20,19,0.04)",
      }}
    >
      <span className="mono-label">Step 2 · run a simulation</span>
      <h2
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "clamp(1.6rem, 3vw, 2.1rem)",
          letterSpacing: "-0.025em",
          lineHeight: 1.05,
          marginTop: 10,
        }}
      >
        Paste a post.{" "}
        <span style={{ fontStyle: "italic" }}>Watch them react.</span>
      </h2>

      <div
        style={{
          marginTop: 22,
          padding: "18px 20px",
          borderRadius: 14,
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
        }}
      >
        <textarea
          value={post}
          onChange={(e) => setPost(e.target.value)}
          placeholder="Drop a draft tweet, post, or memo. Up to 2,000 characters."
          maxLength={2000}
          rows={4}
          aria-label="Post draft"
          style={{
            width: "100%",
            padding: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "vertical",
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 19,
            lineHeight: 1.45,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
            minHeight: 96,
          }}
        />

        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            <span
              className="mono-label"
              style={{ color: "var(--text-tertiary)" }}
            >
              PLATFORM
            </span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="input"
              style={{
                minHeight: 36,
                padding: "8px 12px",
                fontSize: 13,
                width: "auto",
              }}
              aria-label="Platform"
            >
              <option value="twitter">Twitter / X</option>
              <option value="reddit">Reddit</option>
              <option value="slack">Slack</option>
            </select>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            <span
              className="mono-label"
              style={{ color: "var(--text-tertiary)" }}
            >
              PERSONAS
            </span>
            <input
              type="number"
              min={5}
              max={Math.max(5, audienceSize || 200)}
              step={5}
              value={cappedSize}
              onChange={(e) =>
                setPersonaCap(Number.parseInt(e.target.value, 10) || 5)
              }
              className="input tabular-nums"
              style={{
                minHeight: 36,
                padding: "8px 12px",
                fontSize: 13,
                width: 76,
              }}
              aria-label="Persona cap"
            />
          </label>

          <span
            className="mono-label tabular-nums"
            style={{
              color: "var(--text-tertiary)",
              marginLeft: "auto",
            }}
          >
            ~{estCredits.toLocaleString()} CREDITS
          </span>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning || post.trim().length === 0}
            className="btn-primary"
            style={{
              background: "var(--ink)",
              color: "var(--butter-deep)",
              minHeight: 44,
              padding: "10px 22px",
            }}
            aria-busy={isRunning}
          >
            {isRunning
              ? status === "queued"
                ? "Queuing…"
                : `Running · ${thread.length} replies`
              : "Run simulation →"}
          </button>

          <label
            title="Coming soon — generate AI variations of the post and run them all"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-tertiary)",
              cursor: "not-allowed",
            }}
          >
            <input
              type="checkbox"
              checked={variations}
              disabled
              onChange={() => setVariations((v) => !v)}
              aria-label="Generate AI variations"
              style={{ accentColor: "var(--accent)" }}
            />
            Generate variations
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--butter)",
                color: "var(--ink)",
                fontFamily: "var(--font-data), monospace",
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Soon · 5× credits
            </span>
          </label>
        </div>

        {error ? (
          <p
            role="alert"
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "var(--coral)",
            }}
          >
            {error}
          </p>
        ) : null}
      </div>

      {/* Thread output */}
      {(isRunning || status === "completed" || status === "failed") &&
      thread.length === 0 ? (
        <div
          style={{
            marginTop: 24,
            padding: "20px 22px",
            borderRadius: 14,
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          {status === "failed"
            ? "Simulation failed. Try again."
            : "Spinning up the room… first replies should land in a few seconds."}
        </div>
      ) : null}

      {thread.length > 0 ? (
        <div style={{ marginTop: 26 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              paddingBottom: 12,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span className="mono-label">Live thread</span>
            <div
              className="tabular-nums"
              style={{
                display: "inline-flex",
                gap: 14,
                fontFamily: "var(--font-data), monospace",
                fontSize: 12,
                color: "var(--text-tertiary)",
              }}
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
            </div>
          </div>

          <div
            ref={streamRef}
            style={{
              marginTop: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxHeight: 520,
              overflowY: "auto",
              paddingRight: 6,
            }}
          >
            {thread.map((msg, i) => (
              <div
                key={msg.id ?? `${msg.agent_id}-${msg.round}-${i}`}
                style={{
                  padding: "12px 14px",
                  background: "var(--surface)",
                  borderRadius: 12,
                  borderLeft: `3px solid ${SENTIMENT_COLORS[msg.sentiment]}`,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.04)",
                  animation:
                    "sim-bubble-in 220ms cubic-bezier(0.215, 0.61, 0.355, 1) both",
                  willChange: "opacity, transform",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    fontFamily: "var(--font-data), monospace",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                  }}
                >
                  <span
                    style={{ color: "var(--text-primary)", fontWeight: 600 }}
                  >
                    {formatHandle(platform, msg.archetype)}
                  </span>
                  <span
                    style={{ color: "var(--text-tertiary)" }}
                    className="tabular-nums"
                  >
                    R{msg.round}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      color: SENTIMENT_COLORS[msg.sentiment],
                      textTransform: "uppercase",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {SENTIMENT_LABELS[msg.sentiment]}
                  </span>
                </div>
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "var(--text-primary)",
                  }}
                >
                  {msg.message}
                </p>
              </div>
            ))}
          </div>

          {status === "completed" && simulationId ? (
            <div
              style={{
                marginTop: 26,
                padding: "22px 24px",
                background: "var(--ink)",
                color: "rgba(245, 244, 242, 0.95)",
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="mono-label"
                  style={{ color: "var(--butter-deep)" }}
                >
                  VERDICT
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: "var(--font-data), monospace",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "rgba(245, 244, 242, 0.55)",
                  }}
                >
                  {aggression ? `${aggression} aggression` : "complete"} · {thread.length} replies
                </span>
              </div>
              <p
                style={{
                  marginTop: 12,
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontStyle: "italic",
                  fontSize: "clamp(18px, 2.2vw, 22px)",
                  lineHeight: 1.35,
                  color: "rgba(245, 244, 242, 0.85)",
                }}
              >
                {sentimentBreakdown.hostile + sentimentBreakdown.negative >
                sentimentBreakdown.positive
                  ? "This would have ratio'd you. Rewrite before shipping."
                  : "This room would let you ship it. The negative voices stay in the minority."}
              </p>
              <Link
                href={`/sim/${simulationId}`}
                target="_blank"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  marginTop: 18,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "var(--butter-deep)",
                  color: "var(--ink)",
                  fontWeight: 500,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Open shareable view →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <style jsx>{`
        @keyframes sim-bubble-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
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
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
      }}
    >
      <span style={{ color, fontWeight: 600 }}>{count}</span>
      <span>{label}</span>
    </span>
  );
}
