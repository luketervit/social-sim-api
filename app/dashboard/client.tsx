"use client";

import { useEffect, useRef, useState } from "react";
import SignOutButton from "@/app/components/SignOutButton";
import Dropdown from "@/components/Dropdown";
import type { AgentMessage } from "@/lib/simulation/types";
import {
  PLAYGROUND_KEY_PREFIX,
  PLAYGROUND_PERSONA_CAP,
  SIMULATION_ROUNDS,
} from "@/lib/credits";
import ShareModal from "./share-modal";

interface AudienceOption {
  id: string;
  name: string;
  metadata: {
    persona_count?: number;
  } | null;
}

interface SimulationRecord {
  id: string;
  api_key: string;
  audience_id: string;
  persona_cap?: number | null;
  platform: string;
  input: string;
  status: string;
  aggression_score: string | null;
  public: boolean;
  title: string | null;
  summary: string | null;
  shared_at: string | null;
  progress_messages: number;
  public_clicks: number;
  share_event_count: number;
  recent_share_events: ShareEventRecord[];
  created_at: string;
  completed_at: string | null;
  expected_messages?: number;
  thread?: AgentMessage[];
}

interface ShareEventRecord {
  simulation_id: string;
  channel: string;
  share_text: string | null;
  destination: string | null;
  created_at: string;
}

interface DashboardProps {
  audiences: AudienceOption[];
  simulations: SimulationRecord[];
  dailyRunsLimit: number;
  dailyRunsRemaining: number;
  userEmail: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  running: "#eab308",
  queued: "#a1a1aa",
  failed: "#ef4444",
};

const AGGRESSION_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

const SENTIMENT_COLORS: Record<AgentMessage["sentiment"], string> = {
  hostile: "#ef4444",
  negative: "#f97316",
  neutral: "#a1a1aa",
  positive: "#22c55e",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAbsoluteDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPlaygroundSimulation(simulation: SimulationRecord) {
  return simulation.api_key.startsWith(PLAYGROUND_KEY_PREFIX);
}

function getSimulationHeadline(simulation: SimulationRecord) {
  if (simulation.title?.trim()) return simulation.title;
  return simulation.input.slice(0, 72) + (simulation.input.length > 72 ? "\u2026" : "");
}

export default function DashboardClient({
  audiences,
  simulations,
  dailyRunsLimit,
  dailyRunsRemaining,
  userEmail,
}: DashboardProps) {
  const [sims, setSims] = useState(simulations);
  const [selectedAudience, setSelectedAudience] = useState(audiences[0]?.id ?? "toxic_gamers");
  const [selectedPlatform, setSelectedPlatform] = useState<"twitter" | "slack" | "reddit">(
    "twitter"
  );
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [runsRemainingToday, setRunsRemainingToday] = useState(dailyRunsRemaining);
  const [isRunningPlayground, setIsRunningPlayground] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareModalSim, setShareModalSim] = useState<SimulationRecord | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(
    simulations.find((simulation) => simulation.status === "queued" || simulation.status === "running")?.id ?? null
  );
  const pollingRef = useRef<Record<string, number>>({});
  const simsRef = useRef(simulations);
  const liveThreadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    simsRef.current = sims;
  }, [sims]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach((id) => window.clearTimeout(id));
      pollingRef.current = {};
    };
  }, []);

  useEffect(() => {
    sims
      .filter((s) => s.status === "queued" || s.status === "running")
      .forEach((s) => startPolling(s.id));
  }, [sims]);

  useEffect(() => {
    if (activeSimulationId) return;
    const inFlight = sims.find((simulation) => simulation.status === "queued" || simulation.status === "running");
    if (inFlight) {
      setActiveSimulationId(inFlight.id);
    }
  }, [activeSimulationId, sims]);

  /* ─── Polling ─── */
  function clearPolling(simId: string) {
    const tid = pollingRef.current[simId];
    if (tid) {
      window.clearTimeout(tid);
      delete pollingRef.current[simId];
    }
  }

  function updateSimulation(simId: string, updates: Partial<SimulationRecord>) {
    setSims((curr) => curr.map((s) => (s.id === simId ? { ...s, ...updates } : s)));
  }

  function startPolling(simId: string) {
    if (pollingRef.current[simId]) return;

    const tick = async () => {
      const current = simsRef.current.find((s) => s.id === simId);
      if (!current) {
        clearPolling(simId);
        return;
      }

      const pg = isPlaygroundSimulation(current);
      const url = pg ? `/api/v1/playground?id=${simId}` : `/api/v1/simulate?id=${simId}`;
      const headers = pg ? undefined : { "x-api-key": current.api_key };

      try {
        const res = await fetch(url, { headers });
        if (res.status === 401) {
          window.location.assign("/login?mode=signin&next=%2Fdashboard");
          return;
        }
        const text = await res.text();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let payload: any;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error("Server returned an invalid response");
        }
        if (!res.ok) throw new Error(payload.error || "Failed to load simulation");

        updateSimulation(simId, {
          status: payload.status,
          aggression_score: payload.aggression_score ?? null,
          progress_messages: payload.progress_messages ?? 0,
          completed_at: payload.completed_at ?? null,
          persona_cap: payload.persona_cap ?? current.persona_cap ?? null,
          expected_messages: payload.expected_messages ?? current.expected_messages,
          public: payload.public ?? current.public,
          title: payload.title ?? current.title,
          summary: payload.summary ?? current.summary,
          shared_at: payload.shared_at ?? current.shared_at,
          thread:
            Array.isArray(payload.thread) && payload.thread.length > 0
              ? payload.thread
              : current.thread ?? [],
        });

        if (payload.status === "completed") {
          clearPolling(simId);
          setNotice("Simulation complete.");
          return;
        }
        if (payload.status === "failed") {
          clearPolling(simId);
          setError(payload.error || "Simulation failed.");
          return;
        }

        setNotice(payload.status === "queued" ? "Simulation queued." : null);

        pollingRef.current[simId] = window.setTimeout(tick, 1800);
      } catch (err) {
        clearPolling(simId);
        setError(err instanceof Error ? err.message : "Failed to poll simulation");
      }
    };

    pollingRef.current[simId] = window.setTimeout(tick, 900);
  }

  /* ─── Run simulation ─── */
  async function handleRunPlayground() {
    setIsRunningPlayground(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/v1/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience_id: selectedAudience,
          platform: selectedPlatform,
          input: playgroundInput,
        }),
      });
      if (res.status === 401) {
        window.location.assign("/login?mode=signin&next=%2Fdashboard");
        return;
      }
      const text = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response");
      }
      if (!res.ok) {
        if (typeof payload.remaining_today === "number") {
          setRunsRemainingToday(payload.remaining_today);
        }
        throw new Error(payload.error || "Failed to start simulation");
      }

      setRunsRemainingToday(
        typeof payload.remaining_today === "number"
          ? payload.remaining_today
          : Math.max(0, runsRemainingToday - 1)
      );
      setSims((curr) => [
        {
          id: payload.simulation_id,
          api_key: PLAYGROUND_KEY_PREFIX,
          audience_id: payload.audience_id,
          persona_cap: payload.persona_cap ?? PLAYGROUND_PERSONA_CAP,
          platform: payload.platform,
          input: payload.input,
          status: payload.status,
          aggression_score: null,
          public: false,
          title: null,
          summary: null,
          shared_at: null,
          progress_messages: 0,
          public_clicks: 0,
          share_event_count: 0,
          recent_share_events: [],
          created_at: payload.created_at ?? new Date().toISOString(),
          completed_at: null,
          expected_messages: payload.expected_messages,
          thread: [],
        },
        ...curr,
      ]);
      setActiveSimulationId(payload.simulation_id);
      startPolling(payload.simulation_id);
      setNotice("Simulation queued.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start simulation");
    } finally {
      setIsRunningPlayground(false);
    }
  }

  /* ─── Share ─── */
  function handleShareConfirmed(simId: string, title: string, summary: string) {
    setSims((curr) =>
      curr.map((s) =>
        s.id === simId
          ? {
              ...s,
              public: true,
              title,
              summary,
              shared_at: new Date().toISOString(),
            }
          : s
      )
    );
  }

  const activeSimulation =
    (activeSimulationId ? sims.find((simulation) => simulation.id === activeSimulationId) : null) ?? null;
  const activeSimulationRunning =
    activeSimulation?.status === "queued" || activeSimulation?.status === "running";
  const activeMessages = activeSimulation?.thread ?? [];
  const activeProgressPct =
    activeSimulation?.status === "completed" || activeSimulation?.status === "failed"
      ? 100
      : activeSimulation?.progress_messages && activeSimulation.progress_messages > 0
        ? Math.min(72, 12 + Math.log10(activeSimulation.progress_messages + 1) * 30)
        : 8;

  useEffect(() => {
    if (!liveThreadRef.current) return;
    liveThreadRef.current.scrollTop = liveThreadRef.current.scrollHeight;
  }, [activeMessages.length, activeSimulationId]);

  return (
    <div className="mx-auto max-w-[720px] px-6 pt-16 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mono-label">PLAYGROUND</div>
          <h1
            className="mt-3"
            style={{
              fontSize: "clamp(24px, 5vw, 32px)",
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: "var(--text-primary)",
            }}
          >
            Simulate the reaction
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            {userEmail}
          </p>
        </div>
        <SignOutButton
          style={{ padding: "8px 14px", minHeight: "auto", fontSize: "13px" }}
        />
      </div>

      {/* Credits line */}
      <div
        className="mt-6 flex items-center gap-4"
        style={{ fontSize: 13, color: "var(--text-secondary)" }}
      >
        <span className="tabular-nums" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
          {runsRemainingToday}
        </span>
        <span>
          of {dailyRunsLimit} free simulation{dailyRunsLimit !== 1 ? "s" : ""} left today
        </span>
      </div>

      {activeSimulation ? (
        <div
          className="mt-6 rounded-xl p-5"
          style={{
            background: "var(--bg-element)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mono-label">LIVE_RUN</div>
              <h2
                className="mt-3"
                style={{
                  fontSize: "clamp(22px, 4vw, 28px)",
                  fontWeight: 500,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.05,
                  color: "var(--text-primary)",
                }}
              >
                {getSimulationHeadline(activeSimulation)}
              </h2>
              <div
                className="mt-3 flex flex-wrap items-center gap-2"
                style={{ fontSize: 12, color: "var(--text-tertiary)" }}
              >
                <span>{activeSimulation.platform}</span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span>{activeSimulation.audience_id.replace(/_/g, " ")}</span>
                {activeSimulation.persona_cap ? (
                  <>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span>{activeSimulation.persona_cap} agents</span>
                  </>
                ) : null}
                <span style={{ opacity: 0.4 }}>|</span>
                <span
                  style={{
                    color: STATUS_COLORS[activeSimulation.status] ?? "var(--text-tertiary)",
                  }}
                >
                  {activeSimulation.status}
                </span>
              </div>
            </div>

            {!activeSimulationRunning ? (
              <div className="flex items-center gap-2">
                <a
                  href={`/sim/${activeSimulation.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ padding: "8px 12px", minHeight: "auto", fontSize: 12 }}
                >
                  {activeSimulation.public ? "View" : "Preview"}
                </a>
                <button
                  type="button"
                  onClick={() => setActiveSimulationId(null)}
                  className="btn-primary"
                  style={{ padding: "8px 12px", minHeight: "auto", fontSize: 12 }}
                >
                  Run another
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: "rgba(24, 24, 27, 0.82)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${activeProgressPct}%`,
                  background: STATUS_COLORS[activeSimulation.status] ?? "var(--accent)",
                  transition: "width 500ms ease-out",
                }}
              />
            </div>
            <div
              className="mt-2 flex flex-wrap items-center gap-3 tabular-nums"
              style={{ fontSize: 12, color: "var(--text-tertiary)" }}
            >
              <span>
                {activeSimulation.progress_messages} message
                {activeSimulation.progress_messages !== 1 ? "s" : ""} so far
              </span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>
                {activeSimulationRunning
                  ? activeSimulation.progress_messages > 0
                    ? "Responses streaming in"
                    : "Waiting for the first responses"
                  : activeSimulation.status === "completed"
                    ? "Simulation complete"
                    : "Simulation failed"}
              </span>
            </div>
          </div>

          <div
            className="mt-5 rounded-xl"
            style={{
              border: "1px solid rgba(39,39,42,0.75)",
              background: "rgba(9,9,11,0.72)",
              overflow: "hidden",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(39,39,42,0.75)" }}
            >
              <span className="mono-label">LIVE_THREAD</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {activeMessages.length > 0
                  ? `Showing ${activeMessages.length} message${activeMessages.length !== 1 ? "s" : ""}`
                  : "No messages yet"}
              </span>
            </div>

            {activeMessages.length > 0 ? (
              <div ref={liveThreadRef} className="max-h-[420px] overflow-auto px-4 py-3">
                <div className="space-y-3">
                  {activeMessages.map((message, index) => (
                    <div
                      key={`${message.agent_id}:${message.round}:${index}`}
                      className="rounded-lg px-3 py-3"
                      style={{
                        background: "rgba(24,24,27,0.55)",
                        border: "1px solid rgba(39,39,42,0.7)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: SENTIMENT_COLORS[message.sentiment],
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {message.archetype}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          round {message.round}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>
                          {message.sentiment}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: 1.65,
                          color: "var(--text-secondary)",
                          marginTop: 8,
                        }}
                      >
                        {message.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-8" style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
                {activeSimulation.progress_messages > 0
                  ? "Messages are being generated. The live thread snapshot should appear on the next poll."
                  : "The worker has queued the simulation. Responses will appear here as soon as agents start posting."}
              </div>
            )}
          </div>

          {error ? (
            <p className="mt-4 text-[13px]" style={{ color: "#fca5a5" }}>
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="mt-4 text-[13px]" style={{ color: "var(--accent)" }}>
              {notice}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className="mt-6 rounded-xl p-5"
          style={{
            background: "var(--bg-element)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mono-label" htmlFor="audience">
                Audience
              </label>
              <div className="mt-2">
                <Dropdown
                  id="audience"
                  value={selectedAudience}
                  onChange={setSelectedAudience}
                  options={audiences.map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                  placeholder="Select audience"
                />
              </div>
            </div>

            <div>
              <label className="mono-label" htmlFor="platform">
                Environment
              </label>
              <div className="mt-2">
                <Dropdown
                  id="platform"
                  value={selectedPlatform}
                  onChange={(v) => setSelectedPlatform(v as "twitter" | "slack" | "reddit")}
                  options={[
                    { value: "twitter", label: "Twitter / fast short-form" },
                    { value: "reddit", label: "Reddit / long-form anonymous" },
                    { value: "slack", label: "Slack / internal corporate" },
                  ]}
                  placeholder="Select environment"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mono-label" htmlFor="playground-input">
              Scenario
            </label>
            <textarea
              id="playground-input"
              className="input mt-2"
              rows={5}
              value={playgroundInput}
              onChange={(e) => setPlaygroundInput(e.target.value)}
              maxLength={2000}
              placeholder="Paste the announcement, launch post, pricing update, or product change you want to test."
              style={{ minHeight: 140, resize: "vertical" }}
            />
          </div>

          {error ? (
            <p className="mt-4 text-[13px]" style={{ color: "#fca5a5" }}>
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="mt-4 text-[13px]" style={{ color: "var(--accent)" }}>
              {notice}
            </p>
          ) : null}

          <div className="mt-5">
            <button
              type="button"
              onClick={handleRunPlayground}
              disabled={isRunningPlayground || !playgroundInput.trim() || runsRemainingToday === 0}
              className="btn-primary"
            >
              {isRunningPlayground ? "Queueing\u2026" : "Run simulation"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Simulation history ─── */}
      {sims.length > 0 && (
        <div className="mt-10">
          <div className="mono-label mb-4">SIMULATIONS</div>
          <div className="space-y-3">
            {sims.slice(0, 20).map((sim) => {
              const isRunning = sim.status === "queued" || sim.status === "running";
              const isComplete = sim.status === "completed";
              const progressPct = sim.expected_messages
                ? Math.min(100, (sim.progress_messages / sim.expected_messages) * 100)
                : isComplete || sim.status === "failed"
                  ? 100
                  : 8;

              return (
                <div
                  key={sim.id}
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--bg-element)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Top row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{
                            background: STATUS_COLORS[sim.status] ?? "#71717a",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--text-primary)",
                          }}
                        >
                          {getSimulationHeadline(sim)}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 flex items-center gap-2 flex-wrap"
                        style={{ fontSize: 12, color: "var(--text-tertiary)" }}
                      >
                        <span>{sim.platform}</span>
                        <span style={{ opacity: 0.4 }}>|</span>
                        <span>{sim.audience_id.replace(/_/g, " ")}</span>
                        {sim.persona_cap ? (
                          <>
                            <span style={{ opacity: 0.4 }}>|</span>
                            <span>{sim.persona_cap} agents</span>
                          </>
                        ) : null}
                        {sim.aggression_score ? (
                          <>
                            <span style={{ opacity: 0.4 }}>|</span>
                            <span
                              style={{
                                color:
                                  AGGRESSION_COLORS[sim.aggression_score] ??
                                  "var(--text-tertiary)",
                              }}
                            >
                              {sim.aggression_score}
                            </span>
                          </>
                        ) : null}
                        <span style={{ opacity: 0.4 }}>|</span>
                        <span
                          suppressHydrationWarning
                          title={formatAbsoluteDate(sim.created_at)}
                        >
                          {isHydrated ? formatTimeAgo(sim.created_at) : formatAbsoluteDate(sim.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isComplete && sim.public ? (
                        <a
                          href={`/sim/${sim.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{
                            padding: "6px 10px",
                            minHeight: "auto",
                            fontSize: 12,
                          }}
                        >
                          View
                        </a>
                      ) : null}
                      {isComplete && !sim.public ? (
                        <>
                          <a
                            href={`/sim/${sim.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary"
                            style={{
                              padding: "6px 10px",
                              minHeight: "auto",
                              fontSize: 12,
                            }}
                          >
                            Preview
                          </a>
                          <button
                            type="button"
                            onClick={() => setShareModalSim(sim)}
                            className="btn-primary"
                            style={{
                              padding: "6px 12px",
                              minHeight: "auto",
                              fontSize: 12,
                            }}
                          >
                            Share
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Progress bar for running sims */}
                  {isRunning && (
                    <div className="mt-3">
                      <div
                        className="h-1.5 overflow-hidden rounded-full"
                        style={{ background: "rgba(24, 24, 27, 0.82)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${progressPct}%`,
                            background:
                              STATUS_COLORS[sim.status] ?? "var(--accent)",
                            transition: "width 500ms ease-out",
                          }}
                        />
                      </div>
                      <p
                        className="mt-1.5 tabular-nums text-[12px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {sim.progress_messages} message
                        {sim.progress_messages !== 1 ? "s" : ""} generated
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareModalSim ? (
        <ShareModal
          simulation={shareModalSim}
          onClose={() => setShareModalSim(null)}
          onShared={handleShareConfirmed}
        />
      ) : null}
    </div>
  );
}
