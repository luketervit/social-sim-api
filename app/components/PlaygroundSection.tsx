"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AgentMessage } from "@/lib/simulation/types";
import {
  PLAYGROUND_PERSONA_CAP,
  PLAYGROUND_RUNS_INCLUDED,
  SIMULATION_ROUNDS,
} from "@/lib/credits";

interface AudienceOption {
  id: string;
  name: string;
}

interface PlaygroundSectionProps {
  audiences: AudienceOption[];
  isSignedIn: boolean;
}

interface PlaygroundSimulation {
  simulation_id: string;
  status: string;
  audience_id: string;
  persona_cap: number | null;
  platform: string;
  input: string;
  progress_messages: number;
  expected_messages: number;
  aggression_score: string | null;
  error?: string | null;
  thread: AgentMessage[];
}

const PLATFORM_OPTIONS = [
  {
    value: "twitter",
    label: "Twitter / X",
    description: "Short-form, hostile, fast spread",
  },
  {
    value: "reddit",
    label: "Reddit",
    description: "Long-form, anonymous, pile-on heavy",
  },
  {
    value: "slack",
    label: "Slack",
    description: "Corporate, passive-aggressive, internal",
  },
] as const;

const AGGRESSION_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

const SENTIMENT_COLORS: Record<AgentMessage["sentiment"], string> = {
  positive: "#22c55e",
  neutral: "#a1a1aa",
  negative: "#f97316",
  hostile: "#ef4444",
};

function formatAudienceLabel(audienceId: string, audiences: AudienceOption[]) {
  return audiences.find((audience) => audience.id === audienceId)?.name ?? audienceId.replace(/_/g, " ");
}

export default function PlaygroundSection({
  audiences,
  isSignedIn,
}: PlaygroundSectionProps) {
  const [input, setInput] = useState("We're rolling out paid verification for every creator account next month.");
  const [audienceId, setAudienceId] = useState(audiences[0]?.id ?? "genz");
  const [platform, setPlatform] = useState<(typeof PLATFORM_OPTIONS)[number]["value"]>("twitter");
  const [error, setError] = useState<string | null>(null);
  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<PlaygroundSimulation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!activeSimulationId) {
      return;
    }

    let timeoutId: number | null = null;
    let cancelled = false;

    async function pollSimulation() {
      try {
        const response = await fetch(`/api/v1/playground?id=${activeSimulationId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as PlaygroundSimulation & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load playground simulation");
        }

        if (cancelled) {
          return;
        }

        setSimulation(payload);

        if (payload.status === "queued" || payload.status === "running") {
          timeoutId = window.setTimeout(pollSimulation, 1400);
          return;
        }

        setActiveSimulationId(null);
      } catch (pollError) {
        if (cancelled) {
          return;
        }

        setError(
          pollError instanceof Error ? pollError.message : "Failed to poll playground simulation"
        );
        setActiveSimulationId(null);
      }
    }

    pollSimulation();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeSimulationId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/playground", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience_id: audienceId,
          platform,
          input,
        }),
      });

      const payload = (await response.json()) as PlaygroundSimulation & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to start playground simulation");
      }

      setSimulation(payload);
      setActiveSimulationId(payload.simulation_id);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to start playground simulation"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const sentimentBreakdown = useMemo(() => {
    const thread = simulation?.thread ?? [];

    return {
      hostile: thread.filter((message) => message.sentiment === "hostile").length,
      negative: thread.filter((message) => message.sentiment === "negative").length,
      neutral: thread.filter((message) => message.sentiment === "neutral").length,
      positive: thread.filter((message) => message.sentiment === "positive").length,
    };
  }, [simulation?.thread]);

  const visibleMessages = simulation?.thread?.slice(0, 6) ?? [];
  const progressPercent = simulation
    ? Math.max(
        6,
        Math.min(
          100,
          Math.round((simulation.progress_messages / Math.max(simulation.expected_messages, 1)) * 100)
        )
      )
    : 0;
  const isRunning =
    isSubmitting || activeSimulationId !== null || simulation?.status === "queued" || simulation?.status === "running";
  const authHref = "/login?mode=signup&next=%2Fdashboard";

  return (
    <section id="playground" style={{ padding: "36px 0 96px", scrollMarginTop: 96 }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="section-shell border border-[rgba(39,39,42,0.58)]">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
            <div>
              <span className="mono-label">PLAYGROUND :: CAPPED_FREE_SIM</span>
              <h2
                style={{
                  fontSize: "clamp(30px, 4vw, 44px)",
                  color: "var(--text-primary)",
                  marginTop: 14,
                  maxWidth: 620,
                }}
              >
                Run a live sample before you ever touch the API.
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 15,
                  lineHeight: 1.72,
                  marginTop: 16,
                  maxWidth: 620,
                }}
              >
                Signed-in accounts can launch {PLAYGROUND_RUNS_INCLUDED} free sample runs with a{" "}
                {PLAYGROUND_PERSONA_CAP}-agent cap each day. The product flow is open immediately, while
                direct API access still stays on a separate approval queue.
              </p>

              <div
                className="mt-6 grid gap-3 sm:grid-cols-3"
                style={{ maxWidth: 700 }}
              >
                {[
                  {
                    label: "Audience cap",
                    value: `${PLAYGROUND_PERSONA_CAP} agents`,
                  },
                  {
                    label: "Simulation depth",
                    value: `${SIMULATION_ROUNDS} rounds`,
                  },
                  {
                    label: "Account policy",
                    value: "Free sign-up, instant access",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="panel"
                    style={{
                      padding: 18,
                      background:
                        "linear-gradient(180deg, rgba(39,39,42,0.24), rgba(24,24,27,0.08) 58%, transparent 100%)",
                    }}
                  >
                    <div className="mono-label">{item.label}</div>
                    <p
                      style={{
                        color: "var(--text-primary)",
                        fontSize: 14,
                        marginTop: 10,
                      }}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="mt-8">
                <div className="grid gap-4">
                  <div>
                    <label
                      htmlFor="playground-input"
                      className="mono-label"
                      style={{ display: "block", marginBottom: 10 }}
                    >
                      Prompt
                    </label>
                    <textarea
                      id="playground-input"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      rows={5}
                      maxLength={2000}
                      className="input"
                      placeholder="Paste the announcement, launch post, or internal message you want to pressure test."
                      style={{ resize: "vertical", minHeight: 140 }}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="playground-audience"
                        className="mono-label"
                        style={{ display: "block", marginBottom: 10 }}
                      >
                        Audience
                      </label>
                      <select
                        id="playground-audience"
                        value={audienceId}
                        onChange={(event) => setAudienceId(event.target.value)}
                        className="input"
                      >
                        {audiences.map((audience) => (
                          <option key={audience.id} value={audience.id}>
                            {audience.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="playground-platform"
                        className="mono-label"
                        style={{ display: "block", marginBottom: 10 }}
                      >
                        Environment
                      </label>
                      <select
                        id="playground-platform"
                        value={platform}
                        onChange={(event) =>
                          setPlatform(event.target.value as (typeof PLATFORM_OPTIONS)[number]["value"])
                        }
                        className="input"
                      >
                        {PLATFORM_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-5 flex flex-wrap items-center gap-3"
                  style={{ fontSize: 12, color: "var(--text-tertiary)" }}
                >
                  <span>Instant queueing</span>
                  <span style={{ opacity: 0.35 }}>|</span>
                  <span>{PLAYGROUND_PERSONA_CAP}-agent sample</span>
                  <span style={{ opacity: 0.35 }}>|</span>
                  <span>
                    {
                      PLATFORM_OPTIONS.find((option) => option.value === platform)?.description
                    }
                  </span>
                </div>

                {error ? (
                  <p className="mt-4 text-[13px]" style={{ color: "#f87171" }}>
                    {error}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  {isSignedIn ? (
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isRunning || input.trim().length === 0}
                    >
                      {isRunning ? "Running sample..." : "Run playground simulation"}
                    </button>
                  ) : (
                    <>
                      <Link href={authHref} className="btn-primary">
                        Create free account
                      </Link>
                      <Link href="/login?mode=signin&next=%2Fdashboard" className="btn-secondary">
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </form>
            </div>

            <div
              className="panel"
              style={{
                padding: 24,
                minHeight: 560,
                background:
                  "linear-gradient(180deg, rgba(39,39,42,0.32), rgba(24,24,27,0.16) 42%, rgba(9,9,11,0.3) 100%)",
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="mono-label">LIVE_OUTPUT</div>
                  <p
                    style={{
                      color: "var(--text-primary)",
                      fontSize: 20,
                      marginTop: 8,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {simulation
                      ? formatAudienceLabel(simulation.audience_id, audiences)
                      : "Run a sample to inspect the thread."}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1"
                  style={{
                    border: "1px solid var(--border)",
                    background: "rgba(24,24,27,0.72)",
                    color:
                      simulation?.aggression_score
                        ? AGGRESSION_COLORS[simulation.aggression_score] ?? "var(--text-primary)"
                        : "var(--text-tertiary)",
                    fontSize: 12,
                  }}
                >
                  {simulation?.aggression_score
                    ? `${simulation.aggression_score} aggression`
                    : simulation?.status === "queued" || simulation?.status === "running"
                      ? simulation.status
                      : "sample pending"}
                </span>
              </div>

              {simulation ? (
                <>
                  <div
                    className="mt-5 rounded-2xl p-4"
                    style={{
                      border: "1px solid var(--border)",
                      background: "rgba(9,9,11,0.42)",
                    }}
                  >
                    <p className="mono-label">PROMPT</p>
                    <p
                      style={{
                        color: "var(--text-primary)",
                        fontSize: 14,
                        lineHeight: 1.65,
                        marginTop: 10,
                      }}
                    >
                      {simulation.input}
                    </p>
                  </div>

                  {simulation.status === "queued" || simulation.status === "running" ? (
                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="mono-label">QUEUE_PROGRESS</span>
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--text-secondary)", fontSize: 12 }}
                        >
                          {simulation.progress_messages}/{simulation.expected_messages}
                        </span>
                      </div>
                      <div
                        className="mt-3 h-2 overflow-hidden rounded-full"
                        style={{ background: "rgba(63,63,70,0.4)" }}
                      >
                        <div
                          style={{
                            width: `${progressPercent}%`,
                            height: "100%",
                            background:
                              "linear-gradient(90deg, rgba(228,228,231,0.34), rgba(228,228,231,0.92))",
                            transition: "width 180ms linear",
                          }}
                        />
                      </div>
                      <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        Simulating a {simulation.persona_cap ?? PLAYGROUND_PERSONA_CAP}-agent slice
                        across {SIMULATION_ROUNDS} rounds.
                      </p>
                    </div>
                  ) : null}

                  {simulation.status === "completed" ? (
                    <>
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {[
                          {
                            label: "Messages",
                            value: `${simulation.thread.length}`,
                          },
                          {
                            label: "Hostile",
                            value: `${sentimentBreakdown.hostile}`,
                          },
                          {
                            label: "Positive",
                            value: `${sentimentBreakdown.positive}`,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-2xl p-4"
                            style={{
                              border: "1px solid var(--border)",
                              background: "rgba(9,9,11,0.4)",
                            }}
                          >
                            <div className="mono-label">{item.label}</div>
                            <p
                              className="tabular-nums"
                              style={{
                                marginTop: 10,
                                fontSize: 22,
                                color: "var(--text-primary)",
                              }}
                            >
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="mono-label">THREAD_EXCERPT</span>
                          <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                            first {visibleMessages.length} messages
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {visibleMessages.map((message, index) => (
                            <div
                              key={`${message.agent_id}-${index}`}
                              className="rounded-2xl p-4"
                              style={{
                                border: "1px solid rgba(39,39,42,0.7)",
                                background: "rgba(9,9,11,0.38)",
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: SENTIMENT_COLORS[message.sentiment] }}
                                />
                                <span
                                  style={{
                                    color: "var(--text-primary)",
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  {message.archetype}
                                </span>
                                <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                                  round {message.round}
                                </span>
                              </div>
                              <p
                                style={{
                                  marginTop: 10,
                                  color: "var(--text-secondary)",
                                  fontSize: 13,
                                  lineHeight: 1.65,
                                }}
                              >
                                {message.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link href="/dashboard" className="btn-primary">
                          Open dashboard to share
                        </Link>
                        <Link href="/waitlist" className="btn-secondary">
                          Join API waitlist
                        </Link>
                      </div>
                    </>
                  ) : null}

                  {simulation.status === "failed" ? (
                    <p className="mt-5 text-[13px]" style={{ color: "#f87171" }}>
                      {simulation.error || "The simulation failed before completion."}
                    </p>
                  ) : null}
                </>
              ) : (
                <div
                  className="mt-6 rounded-2xl p-5"
                  style={{
                    border: "1px solid var(--border)",
                    background: "rgba(9,9,11,0.4)",
                  }}
                >
                  <p style={{ color: "var(--text-primary)", fontSize: 15 }}>
                    Choose an audience, pick a platform, and watch the sample thread build in place.
                  </p>
                  <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    The preview uses the same simulation engine as paid runs, just on a smaller audience slice.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
