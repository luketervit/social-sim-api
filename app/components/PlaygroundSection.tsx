"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
    description: "Short-form, fast spread, high signal",
  },
  {
    value: "reddit",
    label: "Reddit",
    description: "Long-form, anonymous, high depth",
  },
  {
    value: "slack",
    label: "Slack",
    description: "Corporate, internal, team dynamics",
  },
] as const;

const AGGRESSION_COLORS: Record<string, string> = {
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

function formatAudienceLabel(audienceId: string, audiences: AudienceOption[]) {
  return audiences.find((audience) => audience.id === audienceId)?.name ?? audienceId.replace(/_/g, " ");
}

async function parseJsonPayload<T>(response: Response): Promise<(T & { error?: string }) | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as T & { error?: string };
  } catch {
    return null;
  }
}

function CustomSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }} suppressHydrationWarning>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        className="input"
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? value}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
            padding: "4px 0",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 14px",
                fontSize: 14,
                color:
                  option.value === value
                    ? "var(--accent)"
                    : "var(--text-primary)",
                fontWeight: option.value === value ? 500 : 400,
                background:
                  option.value === value
                    ? "rgba(124, 92, 252, 0.06)"
                    : "transparent",
                border: "none",
                cursor: "pointer",
                display: "block",
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => {
                if (option.value !== value) {
                  e.currentTarget.style.background = "var(--bg-subtle)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  option.value === value
                    ? "rgba(124, 92, 252, 0.06)"
                    : "transparent";
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
        const payload = await parseJsonPayload<PlaygroundSimulation>(response);

        if (response.status === 401) {
          window.location.assign("/login?mode=signin&next=%2Fdashboard");
          return;
        }

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load playground simulation");
        }

        if (cancelled) {
          return;
        }

        if (!payload) {
          throw new Error("Failed to load playground simulation");
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

    if (!isSignedIn) {
      window.location.assign(authHref);
      return;
    }

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

      const payload = await parseJsonPayload<PlaygroundSimulation>(response);

      if (response.status === 401) {
        window.location.assign(authHref);
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to start playground simulation");
      }

      if (!payload) {
        throw new Error("Failed to start playground simulation");
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
    <section
      id="playground"
      style={{
        padding: "48px 0 96px",
        scrollMarginTop: 96,
        background: "linear-gradient(180deg, rgba(124, 92, 252, 0.02) 0%, transparent 100%)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div style={{ marginBottom: 48, maxWidth: 560 }}>
          <span className="mono-label">Interactive Playground</span>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              marginTop: 14,
            }}
          >
            Try it yourself.
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 16,
              lineHeight: 1.7,
              marginTop: 14,
            }}
          >
            {PLAYGROUND_RUNS_INCLUDED} free runs per day with a {PLAYGROUND_PERSONA_CAP}-agent cap.
            The full simulation engine, just a smaller audience slice.
          </p>
        </div>

        <div className="section-shell" style={{ border: "1px solid var(--border)" }}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            {/* Left: Form */}
            <div>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-5">
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
                      style={{ resize: "vertical", minHeight: 140, borderRadius: 12 }}
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="playground-audience"
                        className="mono-label"
                        style={{ display: "block", marginBottom: 10 }}
                      >
                        Audience
                      </label>
                      <CustomSelect
                        id="playground-audience"
                        value={audienceId}
                        onChange={setAudienceId}
                        options={audiences.map((a) => ({ value: a.id, label: a.name }))}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="playground-platform"
                        className="mono-label"
                        style={{ display: "block", marginBottom: 10 }}
                      >
                        Environment
                      </label>
                      <CustomSelect
                        id="playground-platform"
                        value={platform}
                        onChange={(v) => setPlatform(v as (typeof PLATFORM_OPTIONS)[number]["value"])}
                        options={PLATFORM_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="mt-4 flex flex-wrap items-center gap-3"
                  style={{ fontSize: 13, color: "var(--text-tertiary)" }}
                >
                  <span>Instant queueing</span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span>{PLAYGROUND_PERSONA_CAP}-agent sample</span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span>
                    {
                      PLATFORM_OPTIONS.find((option) => option.value === platform)?.description
                    }
                  </span>
                </div>

                {error ? (
                  <p className="mt-4 text-[13px]" style={{ color: "var(--coral)" }}>
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
                      {isRunning ? "Running..." : "Run simulation"}
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

            {/* Right: Output */}
            <div
              style={{
                padding: 28,
                minHeight: 480,
                background: "var(--bg-subtle)",
                borderRadius: 14,
                border: "1px solid var(--border)",
              }}
            >
              {simulation ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="mono-label">Live Output</div>
                      <p
                        style={{
                          color: "var(--text-primary)",
                          fontSize: 18,
                          marginTop: 8,
                          letterSpacing: "-0.02em",
                          fontFamily: "var(--font-display), Georgia, serif",
                        }}
                      >
                        {formatAudienceLabel(simulation.audience_id, audiences)}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1"
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color:
                          simulation.aggression_score
                            ? AGGRESSION_COLORS[simulation.aggression_score] ?? "var(--text-primary)"
                            : "var(--text-tertiary)",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {simulation.aggression_score
                        ? `${simulation.aggression_score} aggression`
                        : simulation.status === "queued" || simulation.status === "running"
                          ? simulation.status
                          : "complete"}
                    </span>
                  </div>
                  <div
                    className="mt-5"
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    <p className="mono-label" style={{ fontSize: 10 }}>Prompt</p>
                    <p
                      style={{
                        color: "var(--text-primary)",
                        fontSize: 14,
                        lineHeight: 1.65,
                        marginTop: 8,
                      }}
                    >
                      {simulation.input}
                    </p>
                  </div>

                  {simulation.status === "queued" || simulation.status === "running" ? (
                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="mono-label" style={{ fontSize: 10 }}>Progress</span>
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--text-secondary)", fontSize: 12 }}
                        >
                          {simulation.progress_messages}/{simulation.expected_messages}
                        </span>
                      </div>
                      <div
                        className="mt-3 h-2 overflow-hidden rounded-full"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          style={{
                            width: `${progressPercent}%`,
                            height: "100%",
                            background: "var(--accent)",
                            borderRadius: "999px",
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
                          { label: "Messages", value: `${simulation.thread.length}`, color: "var(--accent)" },
                          { label: "Hostile", value: `${sentimentBreakdown.hostile}`, color: "var(--coral)" },
                          { label: "Positive", value: `${sentimentBreakdown.positive}`, color: "var(--mint)" },
                        ].map((item) => (
                          <div
                            key={item.label}
                            style={{
                              padding: 14,
                              borderRadius: 10,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                            }}
                          >
                            <div className="mono-label" style={{ fontSize: 10 }}>{item.label}</div>
                            <p
                              className="tabular-nums"
                              style={{
                                marginTop: 8,
                                fontSize: 22,
                                color: item.color,
                                fontWeight: 600,
                              }}
                            >
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="mono-label" style={{ fontSize: 10 }}>Thread Excerpt</span>
                          <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                            first {visibleMessages.length} messages
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {visibleMessages.map((message, index) => (
                            <div
                              key={`${message.agent_id}-${index}`}
                              style={{
                                padding: 14,
                                borderRadius: 10,
                                border: "1px solid var(--border)",
                                background: "var(--surface)",
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
                                    fontSize: 13,
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
                                  marginTop: 8,
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
                          Open dashboard
                        </Link>
                        <Link href="/waitlist" className="btn-secondary">
                          Join API waitlist
                        </Link>
                      </div>
                    </>
                  ) : null}

                  {simulation.status === "failed" ? (
                    <p className="mt-5 text-[13px]" style={{ color: "var(--coral)" }}>
                      {simulation.error || "The simulation failed before completion."}
                    </p>
                  ) : null}
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    height: "100%",
                    minHeight: 380,
                    padding: 32,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "var(--accent-muted)",
                      display: "grid",
                      placeItems: "center",
                      marginBottom: 20,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 4v12M4 10h12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 500 }}>
                    Run a simulation to see results
                  </p>
                  <p className="mt-2" style={{ color: "var(--text-tertiary)", fontSize: 14, maxWidth: 280 }}>
                    Fill in the form and hit run. The output will appear here in real time.
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
