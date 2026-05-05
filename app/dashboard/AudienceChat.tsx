"use client";

import { useMemo } from "react";
import type { Persona } from "@/lib/schemas";
import type { AudienceSummary } from "./client";

interface AudienceChatProps {
  audience: AudienceSummary;
  personas: Persona[];
  email: string;
}

interface ArchetypeBucket {
  archetype: string;
  count: number;
  share: number;
  affinity: number;
  reactivity: number;
}

function summariseArchetypes(personas: Persona[]): ArchetypeBucket[] {
  if (personas.length === 0) return [];
  const map = new Map<string, { count: number; affinity: number; reactivity: number }>();
  for (const p of personas) {
    const key = p.archetype || "Unlabelled";
    const prev = map.get(key) ?? { count: 0, affinity: 0, reactivity: 0 };
    prev.count += 1;
    prev.affinity += p.brand_affinity;
    prev.reactivity += p.reactivity_baseline;
    map.set(key, prev);
  }
  const total = personas.length;
  return Array.from(map.entries())
    .map(([archetype, v]) => ({
      archetype,
      count: v.count,
      share: v.count / total,
      affinity: v.affinity / v.count,
      reactivity: v.reactivity / v.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function describeAffinity(affinity: number): { label: string; color: string } {
  if (affinity <= -0.4) return { label: "skeptical", color: "var(--coral)" };
  if (affinity <= -0.1) return { label: "cool", color: "#C8552B" };
  if (affinity < 0.15) return { label: "neutral", color: "var(--text-secondary)" };
  if (affinity < 0.45) return { label: "warm", color: "#1F8A55" };
  return { label: "supportive", color: "var(--mint)" };
}

function buildSummaryLines(
  audience: AudienceSummary,
  personas: Persona[],
  buckets: ArchetypeBucket[]
): string[] {
  if (personas.length === 0) {
    return [
      `I parsed ${audience.row_count ?? 0} rows from ${audience.name}, but I couldn't extract any personas yet. Try uploading more substantive text (≥ 8 characters per row).`,
    ];
  }

  const avgAffinity =
    personas.reduce((s, p) => s + p.brand_affinity, 0) / personas.length;
  const avgReactivity =
    personas.reduce((s, p) => s + p.reactivity_baseline, 0) / personas.length;

  const top = buckets[0];
  const second = buckets[1];

  const lines: string[] = [];
  lines.push(
    `I parsed ${personas.length} personas from ${audience.name}. The room skews ${describeAffinity(avgAffinity).label} on average, with reactivity around ${formatPercent(avgReactivity)} — that's how loud they get when something hits a nerve.`
  );

  if (top) {
    const tone = describeAffinity(top.affinity).label;
    lines.push(
      `The biggest cluster is ${top.archetype} (${top.count} of ${personas.length}, ${formatPercent(top.share)}). They read as ${tone}, with reactivity around ${formatPercent(top.reactivity)}.`
    );
  }

  if (second) {
    const tone = describeAffinity(second.affinity).label;
    lines.push(
      `Right behind them: ${second.archetype} (${second.count}). Tone is ${tone}.`
    );
  }

  lines.push(
    `Paste a post below and I'll run it through these personas across ${"10"} rounds. You'll see who reacts, what they say, and where the thread tilts.`
  );

  return lines;
}

export default function AudienceChat({
  audience,
  personas,
}: AudienceChatProps) {
  const buckets = useMemo(() => summariseArchetypes(personas), [personas]);
  const lines = useMemo(
    () => buildSummaryLines(audience, personas, buckets),
    [audience, personas, buckets]
  );

  const avgAffinity =
    personas.length > 0
      ? personas.reduce((s, p) => s + p.brand_affinity, 0) / personas.length
      : 0;
  const affinityVerdict = describeAffinity(avgAffinity);

  return (
    <section
      aria-label="Audience analysis"
      style={{
        padding: "clamp(28px, 3vw, 40px)",
        borderRadius: 20,
        background: "var(--surface)",
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.04), 0 14px 40px rgba(20,20,19,0.04)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          paddingBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <span className="mono-label">Audience</span>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(1.6rem, 3vw, 2.1rem)",
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              marginTop: 8,
            }}
          >
            {audience.name}
          </h2>
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            alignItems: "center",
          }}
          className="tabular-nums"
        >
          <span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {personas.length}
            </span>{" "}
            personas
          </span>
          <span style={{ color: affinityVerdict.color, fontWeight: 600 }}>
            {affinityVerdict.label}
          </span>
        </div>
      </header>

      {/* Persona summary chips */}
      {buckets.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 22,
          }}
        >
          {buckets.map((b) => {
            const tone = describeAffinity(b.affinity);
            return (
              <span
                key={b.archetype}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: tone.color,
                  }}
                />
                {b.archetype}
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: "var(--font-data), monospace",
                    color: "var(--text-tertiary)",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                  }}
                >
                  ×{b.count}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Chat-style summary */}
      <div
        style={{
          marginTop: 26,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {lines.map((line, i) => (
          <ChatBubble key={i} delayMs={i * 90}>
            {line}
          </ChatBubble>
        ))}
      </div>

      <style jsx>{`
        @keyframes fade-up {
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

function ChatBubble({
  children,
  delayMs,
}: {
  children: React.ReactNode;
  delayMs: number;
}) {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "min(640px, 92%)",
        padding: "14px 18px",
        borderRadius: 16,
        borderTopLeftRadius: 4,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        fontSize: 15,
        lineHeight: 1.55,
        animation: `fade-up 360ms cubic-bezier(0.215, 0.61, 0.355, 1) ${delayMs}ms both`,
        willChange: "opacity, transform",
      }}
    >
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
      {children}
      <style jsx>{`
        @keyframes fade-up {
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
    </div>
  );
}
