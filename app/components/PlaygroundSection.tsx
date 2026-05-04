"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { AgentMessage } from "@/lib/simulation/types";
import Reveal from "./Reveal";
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

const LOADER_COLORS = ["#7C5CFC", "#F97066", "#34D399", "#F59E0B"];

interface LoaderNode {
  x: number;
  y: number;
  radius: number;
  color: string;
  phase: number;
  speed: number;
  orbitRadius: number;
  orbitAngle: number;
  opacity: number;
  born: number;
}

function SimulationLoader({ progress }: { progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<LoaderNode[]>([]);
  const edgesRef = useRef<[number, number][]>([]);
  const startRef = useRef<number>(0);

  const spawnNodes = useCallback((count: number, now: number) => {
    const nodes = nodesRef.current;
    const cx = 140;
    const cy = 90;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const orbit = 25 + Math.random() * 55;
      nodes.push({
        x: cx + Math.cos(angle) * orbit,
        y: cy + Math.sin(angle) * orbit,
        radius: 2 + Math.random() * 2.5,
        color: LOADER_COLORS[Math.floor(Math.random() * LOADER_COLORS.length)],
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        orbitRadius: orbit,
        orbitAngle: angle,
        opacity: 0,
        born: now,
      });
    }

    // Add edges for new nodes connecting to nearby existing ones
    const startIdx = nodes.length - count;
    for (let i = startIdx; i < nodes.length; i++) {
      // Connect to 1-2 random existing nodes
      const connections = 1 + Math.floor(Math.random() * 2);
      for (let c = 0; c < connections; c++) {
        const target = Math.floor(Math.random() * nodes.length);
        if (target !== i) {
          edgesRef.current.push([i, target]);
        }
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 280 * dpr;
    canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);

    startRef.current = performance.now();
    // Seed initial nodes
    spawnNodes(6, startRef.current);

    let lastSpawnProgress = 0;

    function draw(now: number) {
      ctx!.clearRect(0, 0, 280, 180);
      const elapsed = now - startRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Spawn new nodes as progress increases
      if (progress - lastSpawnProgress > 5 && nodes.length < 40) {
        spawnNodes(1 + Math.floor(Math.random() * 2), now);
        lastSpawnProgress = progress;
      }

      // Draw edges
      for (const [i, j] of edges) {
        if (i >= nodes.length || j >= nodes.length) continue;
        const a = nodes[i];
        const b = nodes[j];
        const edgeAge = Math.min(1, (now - Math.max(a.born, b.born)) / 1200);
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.002 + i * 0.5);
        const alpha = edgeAge * 0.12 * pulse;
        if (alpha < 0.01) continue;

        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.strokeStyle = `rgba(124, 92, 252, ${alpha})`;
        ctx!.lineWidth = 0.6;
        ctx!.stroke();
      }

      // Draw + update nodes
      for (const node of nodes) {
        const age = now - node.born;
        // Fade in
        node.opacity = Math.min(1, age / 600);

        // Gentle orbit drift
        node.orbitAngle += node.speed * 0.003;
        const breathe = Math.sin(now * 0.0015 + node.phase) * 3;
        const cx = 140;
        const cy = 90;
        node.x = cx + Math.cos(node.orbitAngle) * (node.orbitRadius + breathe);
        node.y = cy + Math.sin(node.orbitAngle) * (node.orbitRadius + breathe);

        // Pulse radius
        const rPulse = 1 + 0.2 * Math.sin(now * 0.003 + node.phase);
        const r = node.radius * rPulse;

        // Glow
        const grad = ctx!.createRadialGradient(
          node.x, node.y, r * 0.3,
          node.x, node.y, r * 3
        );
        grad.addColorStop(0, node.color);
        grad.addColorStop(1, "transparent");
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, r * 3, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.globalAlpha = 0.06 * node.opacity;
        ctx!.fill();

        // Node
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = node.color;
        ctx!.globalAlpha = node.opacity * 0.8;
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      // Center ripple pulse
      const ripplePhase = (elapsed % 3000) / 3000;
      const rippleR = 15 + ripplePhase * 60;
      const rippleAlpha = (1 - ripplePhase) * 0.06;
      ctx!.beginPath();
      ctx!.arc(140, 90, rippleR, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(124, 92, 252, ${rippleAlpha})`;
      ctx!.lineWidth = 1;
      ctx!.stroke();

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animRef.current);
  }, [progress, spawnNodes]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 280, height: 180, display: "block", margin: "0 auto" }}
    />
  );
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
  const [input, setInput] = useState("We're launching a free tier for all new users starting next week.");
  const [audienceId, setAudienceId] = useState(
    audiences.find((a) => a.id === "genz")?.id ?? audiences[0]?.id ?? "genz"
  );
  const [platform, setPlatform] = useState<(typeof PLATFORM_OPTIONS)[number]["value"]>("twitter");
  const [error, setError] = useState<string | null>(null);
  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<PlaygroundSimulation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
        padding: "clamp(80px, 11vh, 128px) 0 clamp(96px, 13vh, 160px)",
        scrollMarginTop: 96,
        background:
          "linear-gradient(180deg, rgba(124, 92, 252, 0.025) 0%, transparent 60%)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div
          style={{
            marginBottom: 36,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <span className="mono-label">The playground</span>
            <Reveal
              as="h2"
              className="reveal-heading"
              threshold={0.3}
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                marginTop: 12,
                maxWidth: 16 + "ch",
              }}
            >
              <span className="reveal-word" style={{ ["--reveal-i" as string]: 0 }}>Try</span>{" "}
              <span className="reveal-word" style={{ ["--reveal-i" as string]: 1 }}>it</span>{" "}
              <span className="reveal-word" style={{ ["--reveal-i" as string]: 2 }}>on</span>{" "}
              <span className="reveal-word" style={{ ["--reveal-i" as string]: 3 }}>something</span>{" "}
              <span className="reveal-word" style={{ ["--reveal-i" as string]: 4, fontStyle: "italic" }}>you&apos;d</span>{" "}
              <span className="reveal-word" style={{ ["--reveal-i" as string]: 5, fontStyle: "italic" }}>actually</span>{" "}
              <span className="reveal-word" style={{ ["--reveal-i" as string]: 6, fontStyle: "italic" }}>post.</span>
            </Reveal>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              lineHeight: 1.55,
              maxWidth: 320,
              fontFamily: "var(--font-data), monospace",
              letterSpacing: "0.02em",
            }}
          >
            {PLAYGROUND_RUNS_INCLUDED} free runs / day · {PLAYGROUND_PERSONA_CAP}-agent
            cap · same engine, smaller room.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
            {/* Left: Form */}
            <div>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-6">
                  <div>
                    <label
                      htmlFor="playground-input"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Your post
                    </label>
                    <textarea
                      id="playground-input"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      rows={5}
                      maxLength={2000}
                      className="input"
                      placeholder="we're sunsetting the free tier next month — paid plans start at $19/mo."
                      style={{ resize: "vertical", minHeight: 140, borderRadius: 14 }}
                    />
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="playground-audience"
                        style={{
                          display: "block",
                          marginBottom: 8,
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          letterSpacing: "-0.01em",
                        }}
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
                        style={{
                          display: "block",
                          marginBottom: 8,
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          letterSpacing: "-0.01em",
                        }}
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
                  className="mt-5 flex flex-wrap items-center gap-3"
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-data), monospace",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span>Instant queueing</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{PLAYGROUND_PERSONA_CAP}-agent sample</span>
                  <span style={{ opacity: 0.4 }}>·</span>
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

                <div className="mt-7 flex flex-wrap gap-3">
                  {isSignedIn ? (
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ background: "var(--ink)", color: "var(--butter-deep)" }}
                      disabled={isRunning || input.trim().length === 0}
                    >
                      {isRunning ? "Running..." : "Run simulation →"}
                    </button>
                  ) : (
                    <>
                      <Link
                        href={authHref}
                        className="btn-primary"
                        style={{ background: "var(--ink)", color: "var(--butter-deep)" }}
                      >
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
            <div suppressHydrationWarning style={{ minHeight: 480 }}>
              {!mounted ? null : simulation ? (
                <div
                  style={{
                    padding: 28,
                    background: "var(--bg-subtle)",
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                  }}
                >
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
                  {simulation.status === "queued" || simulation.status === "running" ? (
                    <div className="mt-5">
                      <SimulationLoader progress={progressPercent} />
                      <div
                        className="mt-3 flex items-center gap-3"
                        style={{ maxWidth: 280, margin: "0 auto" }}
                      >
                        <div
                          className="h-1 flex-1 overflow-hidden rounded-full"
                          style={{ background: "var(--border)" }}
                        >
                          <div
                            style={{
                              width: `${progressPercent}%`,
                              height: "100%",
                              background: "var(--accent)",
                              borderRadius: "999px",
                              transition: "width 300ms ease-out",
                            }}
                          />
                        </div>
                        <span
                          className="tabular-nums text-[11px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {progressPercent}%
                        </span>
                      </div>
                      <p
                        className="mt-2 text-center text-[12px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        Generating responses...
                      </p>
                    </div>
                  ) : null}

                  {simulation.status === "completed" ? (
                    <>
                      <SimulationResults
                        simulation={simulation}
                        sentimentBreakdown={sentimentBreakdown}
                      />
                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link href={`/sim/${simulation.simulation_id}`} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                          View full results
                        </Link>
                        <Link href="/waitlist" className="btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
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
                </div>
              ) : (
                <PlaygroundPreview />
              )}
            </div>
        </div>
      </div>

    </section>
  );
}

type PreviewSentiment = "hostile" | "positive" | "neutral";
const PREVIEW_CHIPS: { handle: string; body: string; sentiment: PreviewSentiment; pending?: boolean }[] = [
  { handle: "@reply_guy", body: "ratio incoming", sentiment: "hostile" },
  { handle: "@power_user", body: "honestly fair", sentiment: "positive" },
  { handle: "@too_online", body: "and the support tickets begin", sentiment: "hostile" },
  { handle: "@noopinion", body: "huh", sentiment: "neutral" },
  { handle: "@buildlogs", body: "[generating…]", sentiment: "neutral", pending: true },
];

function previewDot(s: PreviewSentiment) {
  if (s === "hostile") return "var(--coral)";
  if (s === "positive") return "var(--mint)";
  return "var(--text-tertiary)";
}

function PlaygroundPreview() {
  return (
    <div
      style={{
        position: "relative",
        background: "var(--ink)",
        color: "rgba(245, 244, 242, 0.95)",
        borderRadius: 18,
        padding: 24,
        minHeight: 480,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 14px 40px rgba(20,20,19,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--butter-deep)",
            fontWeight: 500,
          }}
        >
          Preview · what you&apos;ll see
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontFamily: "var(--font-data), monospace",
            letterSpacing: "0.08em",
            color: "rgba(245, 244, 242, 0.5)",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "rgba(245, 244, 242, 0.4)",
            }}
          />
          Idle
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        {PREVIEW_CHIPS.map((c, i) => (
          <div
            key={i}
            style={{
              padding: "10px 14px",
              background: "rgba(28, 27, 25, 0.92)",
              border: "1px solid rgba(245, 244, 242, 0.1)",
              borderRadius: 12,
              transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 0.5}deg)`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.25), 0 6px 16px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: previewDot(c.sentiment),
                  animation: c.pending ? "pulse-soft 1.4s ease-in-out infinite" : undefined,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-data), monospace",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  color: "rgba(245, 244, 242, 0.5)",
                }}
              >
                {c.handle}
              </span>
            </div>
            <span
              style={{
                fontSize: 13,
                color: c.pending ? "rgba(245, 244, 242, 0.55)" : "rgba(245, 244, 242, 0.95)",
                fontStyle: c.pending ? "italic" : undefined,
              }}
            >
              {c.body}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(245, 244, 242, 0.04)",
          border: "1px dashed rgba(245, 244, 242, 0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, color: "rgba(245, 244, 242, 0.78)" }}>
          Hit{" "}
          <span
            style={{
              fontFamily: "var(--font-data), monospace",
              padding: "2px 6px",
              borderRadius: 6,
              background: "var(--butter-deep)",
              color: "var(--ink)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            run
          </span>{" "}
          to summon a real audience.
        </span>
        <span
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(245, 244, 242, 0.45)",
          }}
        >
          ~30s · {PLAYGROUND_PERSONA_CAP} agents
        </span>
      </div>
    </div>
  );
}

function SimulationResults({
  simulation,
  sentimentBreakdown,
}: {
  simulation: PlaygroundSimulation;
  sentimentBreakdown: { hostile: number; negative: number; neutral: number; positive: number };
}) {
  return (
    <>
      <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "Messages", value: `${simulation.thread.length}`, color: "var(--accent)" },
          { label: "Positive", value: `${sentimentBreakdown.positive}`, color: "var(--mint)" },
          { label: "Negative", value: `${sentimentBreakdown.negative}`, color: "var(--coral)" },
          { label: "Hostile", value: `${sentimentBreakdown.hostile}`, color: "#EF4444" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: 14,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              textAlign: "center",
            }}
          >
            <p
              className="tabular-nums"
              style={{
                fontSize: 24,
                color: item.color,
                fontWeight: 600,
              }}
            >
              {item.value}
            </p>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: "var(--font-data), monospace",
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {simulation.aggression_score ? (
        <div
          className="mt-4"
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Aggression level</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: AGGRESSION_COLORS[simulation.aggression_score] ?? "var(--text-primary)",
              textTransform: "capitalize",
            }}
          >
            {simulation.aggression_score}
          </span>
        </div>
      ) : null}
    </>
  );
}
