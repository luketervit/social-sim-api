"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Persona } from "@/lib/schemas";
import type { AgentMessage } from "@/lib/simulation/types";

export interface AudienceSummary {
  id: string;
  name: string;
  platform: string | null;
  status: string;
  row_count: number | null;
  created_at: string;
}

interface DashboardClientProps {
  email: string;
  audiences: AudienceSummary[];
  selected: AudienceSummary | null;
  personas: Persona[];
  selectedPlatform: string | null;
}

type Platform = "twitter" | "reddit" | "slack";

const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  reddit: "Reddit",
  slack: "Slack",
};

const PLATFORM_HANDLE: Record<Platform, string> = {
  twitter: "@",
  reddit: "u/",
  slack: "",
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

const ACCEPTED_EXTENSIONS = [".csv", ".json", ".ndjson"];
const POLL_INTERVAL_MS = 2000;
const SIM_POLL_INTERVAL_MS = 1500;
const SIMULATION_ROUNDS = 10;
const DEFAULT_PERSONA_CAP = 25;

interface ConvoMessage {
  id: string;
  role: "atharias" | "user" | "system";
  body?: ReactNode;
  /** When supplied, takes the place of body — full-bleed (no bubble). */
  raw?: ReactNode;
}

function inferPlatformFromFilename(name: string): Platform {
  const lower = name.toLowerCase();
  if (lower.includes("linkedin")) return "twitter";
  if (lower.includes("discord") || lower.includes("slack")) return "slack";
  if (lower.includes("reddit")) return "reddit";
  return "twitter";
}

function summariseArchetypes(personas: Persona[]) {
  if (personas.length === 0) return [] as Array<{ archetype: string; count: number }>;
  const map = new Map<string, number>();
  for (const p of personas) {
    const key = (p.archetype || "Unlabelled").trim();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([archetype, count]) => ({ archetype, count }))
    .sort((a, b) => b.count - a.count);
}

function avgAffinity(personas: Persona[]): number {
  if (personas.length === 0) return 0;
  return personas.reduce((s, p) => s + p.brand_affinity, 0) / personas.length;
}

function describeAffinity(affinity: number): string {
  if (affinity <= -0.4) return "skeptical";
  if (affinity <= -0.1) return "cool";
  if (affinity < 0.15) return "neutral";
  if (affinity < 0.45) return "warm";
  return "supportive";
}

function formatHandle(platform: Platform, archetype: string): string {
  const cleaned = archetype.replace(/[·\s]+/g, platform === "reddit" ? "_" : "");
  return `${PLATFORM_HANDLE[platform]}${cleaned.slice(0, 24)}`;
}

export default function DashboardClient({
  email,
  audiences: initialAudiences,
  selected,
  personas,
  selectedPlatform,
}: DashboardClientProps) {
  const router = useRouter();
  const [audiences, setAudiences] = useState<AudienceSummary[]>(initialAudiences);

  // Upload state.
  const [uploading, setUploading] = useState(false);
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Conversation state for the selected audience.
  const [platform, setPlatform] = useState<Platform | null>(
    (selectedPlatform as Platform | null) ?? null
  );
  const [post, setPost] = useState("");
  const [personaCap, setPersonaCap] = useState<number>(
    Math.min(DEFAULT_PERSONA_CAP, selected?.row_count ?? DEFAULT_PERSONA_CAP)
  );
  const [simStatus, setSimStatus] = useState<
    "idle" | "queued" | "running" | "completed" | "failed"
  >("idle");
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [thread, setThread] = useState<AgentMessage[]>([]);
  const [aggression, setAggression] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reset conversation state when audience switches.
  useEffect(() => {
    setPlatform((selectedPlatform as Platform | null) ?? null);
    setPost("");
    setSimStatus("idle");
    setSimulationId(null);
    setThread([]);
    setAggression(null);
    setSimError(null);
  }, [selected?.id, selectedPlatform]);

  // Poll for audience status while any are processing.
  useEffect(() => {
    const hasProcessing = audiences.some((a) => a.status === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/v1/audiences");
        if (!res.ok) return;
        const data = (await res.json()) as { audiences?: AudienceSummary[] };
        if (!Array.isArray(data.audiences)) return;
        setAudiences(data.audiences);
        // When the most recent upload finishes, navigate into it.
        const justFinished = data.audiences.find(
          (a) => a.status === "ready" && !audiences.find((b) => b.id === a.id && b.status === "ready")
        );
        if (justFinished && !selected) {
          router.replace(`/dashboard?audience=${justFinished.id}`);
        } else if (justFinished) {
          router.refresh();
        }
      } catch {
        /* ignore */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [audiences, selected, router]);

  // Auto-scroll the conversation as new messages arrive.
  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadError(null);
      const lower = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        setUploadError("Needs to be a .csv, .json, or .ndjson file.");
        return;
      }

      const guess = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Audience";
      const inferredPlatform = inferPlatformFromFilename(file.name);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", guess);
      fd.append("platform", inferredPlatform);

      setUploading(true);
      setUploadingFilename(file.name);
      try {
        const res = await fetch("/api/v1/audiences", { method: "POST", body: fd });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Upload failed.");
        }
        // Refresh list so the new audience shows up in processing state.
        const listRes = await fetch("/api/v1/audiences");
        if (listRes.ok) {
          const data = (await listRes.json()) as { audiences?: AudienceSummary[] };
          if (Array.isArray(data.audiences)) setAudiences(data.audiences);
        }
        // Navigate to the new audience so the page enters processing chat mode.
        if (payload?.audience_id) {
          router.replace(`/dashboard?audience=${payload.audience_id}`);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        setUploadingFilename(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [router]
  );

  // -------------------- Build the conversation --------------------

  const messages: ConvoMessage[] = [];

  if (!selected && !uploading) {
    messages.push({
      id: "intro",
      role: "atharias",
      body: (
        <>
          Drop a CSV and I&apos;ll build your audience. LinkedIn connections,
          customer messages, support tickets — anything text-based works. We&apos;ll
          pick the useful columns automatically.
        </>
      ),
    });
    messages.push({
      id: "drop",
      role: "system",
      raw: (
        <UploadDropzone
          dragActive={dragActive}
          onDragActive={setDragActive}
          onUpload={handleUpload}
          fileInputRef={fileInputRef}
          uploading={false}
        />
      ),
    });
    if (uploadError) {
      messages.push({
        id: "upload-error",
        role: "atharias",
        body: <span style={{ color: "var(--coral)" }}>{uploadError}</span>,
      });
    }
  }

  if (uploading) {
    messages.push({
      id: "uploading",
      role: "atharias",
      body: (
        <>
          Got it. Reading{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {uploadingFilename}
          </strong>
          …
        </>
      ),
    });
  }

  if (selected) {
    messages.push({
      id: "got-file",
      role: "user",
      body: <>Uploaded {selected.name}.</>,
    });

    if (selected.status === "processing") {
      messages.push({
        id: "processing-1",
        role: "atharias",
        body: (
          <>
            Reading{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {selected.row_count ?? "your"} rows
            </strong>
            . Claude is picking the columns that carry signal — names, roles,
            companies — and dropping noise like URLs and timestamps.
          </>
        ),
      });
      messages.push({
        id: "processing-2",
        role: "atharias",
        body: (
          <>
            Then I&apos;ll classify tone and reactivity per row and build a persona
            for each one. Usually 30–90 seconds.
          </>
        ),
      });
      messages.push({
        id: "processing-spinner",
        role: "system",
        raw: <ProcessingPulse />,
      });
    }

    if (selected.status === "failed") {
      messages.push({
        id: "failed",
        role: "atharias",
        body: (
          <span style={{ color: "var(--coral)" }}>
            Processing failed. Try uploading again or pick a CSV with more text.
          </span>
        ),
      });
    }

    if (selected.status === "ready") {
      const archetypes = summariseArchetypes(personas);
      const top = archetypes.slice(0, 3);
      const affinity = avgAffinity(personas);

      messages.push({
        id: "ready-summary",
        role: "atharias",
        body: (
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              {personas.length} personas ready.
            </strong>{" "}
            The room skews{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {describeAffinity(affinity)}
            </strong>{" "}
            on average. Biggest clusters:
          </>
        ),
      });
      messages.push({
        id: "ready-chips",
        role: "system",
        raw: <ArchetypeChips archetypes={archetypes.slice(0, 8)} />,
      });

      if (!platform) {
        const suggested = inferPlatformFromFilename(selected.name);
        messages.push({
          id: "ask-platform",
          role: "atharias",
          body: (
            <>
              Where do you want to test this? I picked{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {PLATFORM_LABELS[suggested]}
              </strong>{" "}
              based on the filename — change it if you want.
            </>
          ),
        });
        messages.push({
          id: "platform-chips",
          role: "system",
          raw: (
            <PlatformChips
              suggested={suggested}
              onPick={(p) => {
                setPlatform(p);
                window.requestAnimationFrame(scrollToBottom);
              }}
            />
          ),
        });
      } else {
        messages.push({
          id: "platform-chosen",
          role: "user",
          body: <>{PLATFORM_LABELS[platform]}.</>,
        });

        if (simStatus === "idle") {
          messages.push({
            id: "ask-post",
            role: "atharias",
            body: (
              <>
                Paste the draft you want to test. I&apos;ll run it through{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {Math.min(personaCap, personas.length)} personas
                </strong>{" "}
                across {SIMULATION_ROUNDS} rounds.
              </>
            ),
          });
          messages.push({
            id: "post-composer",
            role: "system",
            raw: (
              <PostComposer
                post={post}
                onPostChange={setPost}
                personaCap={personaCap}
                onPersonaCapChange={setPersonaCap}
                maxPersonas={Math.max(5, personas.length)}
                onRun={handleRunSim}
                onChangePlatform={() => setPlatform(null)}
                platformLabel={PLATFORM_LABELS[platform]}
                error={simError}
              />
            ),
          });
        }

        if (simStatus !== "idle") {
          messages.push({
            id: "user-post",
            role: "user",
            body: (
              <span
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 17,
                  lineHeight: 1.45,
                }}
              >
                {post}
              </span>
            ),
          });
          messages.push({
            id: "running-msg",
            role: "atharias",
            body:
              simStatus === "queued"
                ? "Spinning up the room…"
                : simStatus === "running"
                  ? `Streaming. ${thread.length} replies so far.`
                  : simStatus === "completed"
                    ? "Done. Verdict below."
                    : "Simulation failed.",
          });
          if (thread.length > 0) {
            messages.push({
              id: "thread",
              role: "system",
              raw: (
                <ThreadStream
                  thread={thread}
                  platform={platform}
                />
              ),
            });
          }
          if (simStatus === "completed") {
            messages.push({
              id: "verdict",
              role: "system",
              raw: (
                <Verdict
                  thread={thread}
                  aggression={aggression}
                  simulationId={simulationId}
                  onRunAgain={() => {
                    setSimStatus("idle");
                    setSimulationId(null);
                    setThread([]);
                    setAggression(null);
                    setPost("");
                  }}
                />
              ),
            });
          }
          if (simStatus === "failed" && simError) {
            messages.push({
              id: "sim-error",
              role: "atharias",
              body: <span style={{ color: "var(--coral)" }}>{simError}</span>,
            });
          }
        }
      }
    }
  }

  // -------------------- Sim run + polling --------------------

  async function handleRunSim() {
    if (!selected || !platform) return;
    if (post.trim().length === 0) {
      setSimError("Paste a post first.");
      return;
    }
    setSimError(null);
    setThread([]);
    setAggression(null);
    setSimulationId(null);
    setSimStatus("queued");

    try {
      const res = await fetch("/api/v1/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceId: selected.id,
          platform,
          input: post.trim(),
          personaCap: Math.min(personaCap, personas.length),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Could not start simulation.");
      }
      setSimulationId(payload.simulationId as string);
    } catch (err) {
      setSimStatus("failed");
      setSimError(err instanceof Error ? err.message : "Failed to start.");
    }
  }

  useEffect(() => {
    if (!simulationId) return;
    if (simStatus !== "queued" && simStatus !== "running") return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/simulate/${simulationId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.thread)) setThread(data.thread as AgentMessage[]);
        if (data.aggressionScore) setAggression(data.aggressionScore as string);
        if (data.status === "running") setSimStatus("running");
        else if (data.status === "completed") setSimStatus("completed");
        else if (data.status === "failed") {
          setSimStatus("failed");
          setSimError(
            typeof data.errorMessage === "string"
              ? data.errorMessage
              : "Simulation failed."
          );
        }
      } catch {
        /* ignore */
      }
    }, SIM_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [simulationId, simStatus]);

  // Auto-scroll on new messages.
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, thread.length, simStatus, scrollToBottom]);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div
        className="mx-auto px-6"
        style={{
          maxWidth: 880,
          padding: "clamp(28px, 4vh, 48px) 24px clamp(72px, 10vh, 120px)",
        }}
      >
        {/* Top quiet meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 14,
            marginBottom: 18,
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            color: "var(--text-tertiary)",
            letterSpacing: "0.04em",
          }}
        >
          <span>{email}</span>
          {audiences.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href="/audiences"
                style={{
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                }}
              >
                Audiences
              </Link>
            </>
          ) : null}
        </div>

        {/* Audience switcher (small chip row, only when 2+) */}
        {audiences.length >= 2 ? (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
            role="tablist"
            aria-label="Switch audience"
          >
            {audiences.map((a) => {
              const active = selected?.id === a.id;
              const ready = a.status === "ready" || a.status === "processing";
              return (
                <Link
                  key={a.id}
                  href={ready ? `/dashboard?audience=${a.id}` : "#"}
                  aria-disabled={!ready}
                  role="tab"
                  aria-selected={active}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 500,
                    color: active
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                    background: active ? "var(--surface)" : "transparent",
                    border: `1px solid ${active ? "var(--border-hover)" : "var(--border)"}`,
                    textDecoration: "none",
                    opacity: ready ? 1 : 0.55,
                    pointerEvents: ready ? "auto" : "none",
                  }}
                >
                  {a.name}
                </Link>
              );
            })}
          </div>
        ) : null}

        {/* Conversation */}
        <div
          ref={scrollRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messages.map((m, i) => (
            <ConversationItem key={m.id} message={m} delayMs={Math.min(i * 40, 280)} />
          ))}
        </div>
      </div>
      <style jsx global>{`
        @keyframes convo-fade-up {
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
          [data-convo-bubble] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ConversationItem({
  message,
  delayMs,
}: {
  message: ConvoMessage;
  delayMs: number;
}) {
  if (message.raw) {
    return (
      <div
        data-convo-bubble
        style={{
          animation: `convo-fade-up 320ms cubic-bezier(0.215, 0.61, 0.355, 1) ${delayMs}ms both`,
          willChange: "opacity, transform",
        }}
      >
        {message.raw}
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div
      data-convo-bubble
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        animation: `convo-fade-up 320ms cubic-bezier(0.215, 0.61, 0.355, 1) ${delayMs}ms both`,
        willChange: "opacity, transform",
      }}
    >
      <div
        style={{
          maxWidth: "min(640px, 92%)",
          padding: "14px 18px",
          borderRadius: 18,
          borderTopLeftRadius: isUser ? 18 : 4,
          borderTopRightRadius: isUser ? 4 : 18,
          background: isUser ? "var(--ink)" : "var(--bg-subtle)",
          color: isUser ? "rgba(245, 244, 242, 0.95)" : "var(--text-primary)",
          border: isUser ? "none" : "1px solid var(--border)",
          fontSize: 15,
          lineHeight: 1.55,
        }}
      >
        {!isUser ? (
          <div
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              marginBottom: 6,
            }}
          >
            Atharias
          </div>
        ) : null}
        {message.body}
      </div>
    </div>
  );
}

function UploadDropzone({
  dragActive,
  onDragActive,
  onUpload,
  fileInputRef,
  uploading,
}: {
  dragActive: boolean;
  onDragActive: (active: boolean) => void;
  onUpload: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragActive(true);
      }}
      onDragLeave={() => onDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      aria-label="Upload a CSV file"
      style={{
        marginTop: 4,
        padding: "28px 24px",
        borderRadius: 16,
        background: dragActive ? "var(--accent-subtle)" : "var(--surface)",
        border: `1.5px dashed ${dragActive ? "var(--accent)" : "var(--border)"}`,
        textAlign: "center",
        cursor: uploading ? "progress" : "pointer",
        transition: "border-color 150ms ease, background 150ms ease",
        opacity: uploading ? 0.7 : 1,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 20,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        {dragActive ? "Drop to upload" : "Drop a .csv or click to browse"}
      </div>
      <div
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 11,
          color: "var(--text-tertiary)",
          marginTop: 8,
          letterSpacing: "0.04em",
        }}
      >
        Up to 10 MB · 2,000 rows · any CSV — we pick the useful columns
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,.ndjson,text/csv,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />
    </div>
  );
}

function ProcessingPulse() {
  return (
    <div
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: 999,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        fontFamily: "var(--font-data), monospace",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--accent)",
          animation: "pulse-soft 1.4s ease-in-out infinite",
        }}
      />
      Processing…
    </div>
  );
}

function ArchetypeChips({
  archetypes,
}: {
  archetypes: Array<{ archetype: string; count: number }>;
}) {
  if (archetypes.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {archetypes.map((a) => (
        <span
          key={a.archetype}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-primary)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {a.archetype}
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-data), monospace",
              color: "var(--text-tertiary)",
              fontSize: 11,
              letterSpacing: "0.04em",
            }}
          >
            ×{a.count}
          </span>
        </span>
      ))}
    </div>
  );
}

function PlatformChips({
  suggested,
  onPick,
}: {
  suggested: Platform;
  onPick: (p: Platform) => void;
}) {
  const opts: Platform[] = ["twitter", "reddit", "slack"];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {opts.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            background: p === suggested ? "var(--ink)" : "var(--surface)",
            color:
              p === suggested ? "var(--butter-deep)" : "var(--text-primary)",
            border:
              p === suggested ? "none" : "1px solid var(--border)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 40,
            transition: "background 150ms ease, border-color 150ms ease",
          }}
        >
          {PLATFORM_LABELS[p]}
          {p === suggested ? (
            <span
              style={{
                fontFamily: "var(--font-data), monospace",
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(245, 244, 242, 0.7)",
              }}
            >
              suggested
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function PostComposer({
  post,
  onPostChange,
  personaCap,
  onPersonaCapChange,
  maxPersonas,
  onRun,
  onChangePlatform,
  platformLabel,
  error,
}: {
  post: string;
  onPostChange: (v: string) => void;
  personaCap: number;
  onPersonaCapChange: (n: number) => void;
  maxPersonas: number;
  onRun: () => void;
  onChangePlatform: () => void;
  platformLabel: string;
  error: string | null;
}) {
  const cap = Math.max(5, Math.min(personaCap, maxPersonas));
  const estCredits = cap * SIMULATION_ROUNDS;
  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.03)",
      }}
    >
      <textarea
        value={post}
        onChange={(e) => onPostChange(e.target.value)}
        placeholder="Drop a draft tweet, post, or memo. Up to 2,000 characters."
        maxLength={2000}
        rows={4}
        aria-label="Post draft"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onRun();
          }
        }}
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
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onChangePlatform}
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "5px 10px 5px 12px",
            fontSize: 12,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {platformLabel}
          <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.6 }}>×</span>
        </button>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-data), monospace",
            letterSpacing: "0.04em",
          }}
        >
          PERSONAS
          <input
            type="number"
            min={5}
            max={Math.max(5, maxPersonas)}
            step={5}
            value={cap}
            onChange={(e) =>
              onPersonaCapChange(Number.parseInt(e.target.value, 10) || 5)
            }
            className="tabular-nums"
            style={{
              padding: "6px 10px",
              fontSize: 13,
              width: 76,
              minHeight: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              outline: "none",
            }}
            aria-label="Persona cap"
          />
        </label>

        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
            marginLeft: "auto",
          }}
        >
          ~{estCredits.toLocaleString()} credits
        </span>

        <button
          type="button"
          onClick={onRun}
          disabled={post.trim().length === 0}
          style={{
            background: "var(--ink)",
            color: "var(--butter-deep)",
            border: "none",
            borderRadius: 999,
            padding: "10px 22px",
            fontSize: 14,
            fontWeight: 500,
            minHeight: 40,
            cursor: post.trim().length === 0 ? "not-allowed" : "pointer",
            opacity: post.trim().length === 0 ? 0.55 : 1,
            transition: "background 150ms ease",
          }}
        >
          Run simulation →
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "var(--coral)",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ThreadStream({
  thread,
  platform,
}: {
  thread: AgentMessage[];
  platform: Platform;
}) {
  const breakdown = useMemo(() => ({
    hostile: thread.filter((m) => m.sentiment === "hostile").length,
    negative: thread.filter((m) => m.sentiment === "negative").length,
    neutral: thread.filter((m) => m.sentiment === "neutral").length,
    positive: thread.filter((m) => m.sentiment === "positive").length,
  }), [thread]);

  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          className="mono-label"
          style={{ color: "var(--text-tertiary)" }}
        >
          LIVE THREAD
        </span>
        <div
          className="tabular-nums"
          style={{
            display: "inline-flex",
            gap: 14,
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            color: "var(--text-tertiary)",
          }}
        >
          <Stat count={breakdown.positive} label="positive" color={SENTIMENT_COLORS.positive} />
          <Stat count={breakdown.neutral} label="neutral" color={SENTIMENT_COLORS.neutral} />
          <Stat count={breakdown.negative} label="negative" color={SENTIMENT_COLORS.negative} />
          <Stat count={breakdown.hostile} label="hostile" color={SENTIMENT_COLORS.hostile} />
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 480,
          overflowY: "auto",
          paddingRight: 6,
        }}
      >
        {thread.map((msg, i) => (
          <div
            key={msg.id ?? `${msg.agent_id}-${msg.round}-${i}`}
            style={{
              padding: "10px 12px",
              background: "var(--bg-subtle)",
              borderRadius: 10,
              borderLeft: `3px solid ${SENTIMENT_COLORS[msg.sentiment]}`,
              animation:
                "convo-fade-up 200ms cubic-bezier(0.215, 0.61, 0.355, 1) both",
            }}
            data-convo-bubble
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
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {formatHandle(platform, msg.archetype)}
              </span>
              <span className="tabular-nums" style={{ color: "var(--text-tertiary)" }}>
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
                marginTop: 5,
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
    </div>
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
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ color, fontWeight: 600 }}>{count}</span>
      <span>{label}</span>
    </span>
  );
}

function Verdict({
  thread,
  aggression,
  simulationId,
  onRunAgain,
}: {
  thread: AgentMessage[];
  aggression: string | null;
  simulationId: string | null;
  onRunAgain: () => void;
}) {
  const breakdown = {
    hostile: thread.filter((m) => m.sentiment === "hostile").length,
    negative: thread.filter((m) => m.sentiment === "negative").length,
    neutral: thread.filter((m) => m.sentiment === "neutral").length,
    positive: thread.filter((m) => m.sentiment === "positive").length,
  };
  const wouldRatio =
    breakdown.hostile + breakdown.negative > breakdown.positive;

  return (
    <div
      style={{
        padding: "22px 24px",
        background: "var(--ink)",
        color: "rgba(245, 244, 242, 0.95)",
        borderRadius: 18,
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
        <span className="mono-label" style={{ color: "var(--butter-deep)" }}>
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
          {aggression ? `${aggression} aggression · ` : ""}
          {thread.length} replies
        </span>
      </div>

      <p
        style={{
          marginTop: 12,
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          fontSize: "clamp(18px, 2.2vw, 22px)",
          lineHeight: 1.35,
          color: "rgba(245, 244, 242, 0.9)",
        }}
      >
        {wouldRatio
          ? "This would have ratio'd you. Rewrite before shipping."
          : "This room would let you ship it. Negative voices stay in the minority."}
      </p>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {simulationId ? (
          <Link
            href={`/sim/${simulationId}`}
            target="_blank"
            style={{
              display: "inline-flex",
              alignItems: "center",
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
        ) : null}
        <button
          type="button"
          onClick={onRunAgain}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "10px 18px",
            borderRadius: 999,
            background: "transparent",
            color: "rgba(245, 244, 242, 0.85)",
            fontWeight: 500,
            fontSize: 14,
            border: "1px solid rgba(245, 244, 242, 0.18)",
            cursor: "pointer",
          }}
        >
          Try another draft
        </button>
      </div>
    </div>
  );
}
