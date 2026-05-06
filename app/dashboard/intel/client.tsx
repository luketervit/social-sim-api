"use client";

import { useMemo, useState } from "react";
import type { OperatorPersonaInsights } from "@/lib/operator-persona-insights";

interface Props {
  insights: OperatorPersonaInsights;
  userEmail: string;
}

type PersonaRecord = OperatorPersonaInsights["personas"][number];

const AFFINITY_COLORS = {
  skeptical: "#C8552B",
  neutral: "#8D877C",
  warm: "#1F8A55",
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSigned(value: number) {
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function toneFromAffinity(value: number) {
  if (value < -0.1) return "skeptical";
  if (value > 0.15) return "warm";
  return "neutral";
}

function groupCounts<T extends string>(items: T[]) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export default function DashboardIntelClient({ insights, userEmail }: Props) {
  const [selectedAudience, setSelectedAudience] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedFamily, setSelectedFamily] = useState("all");
  const [selectedSeniority, setSelectedSeniority] = useState("all");
  const [selectedValue, setSelectedValue] = useState("all");
  const [search, setSearch] = useState("");
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const filteredPersonas = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return insights.personas.filter((persona) => {
      if (selectedAudience !== "all" && persona.audienceId !== selectedAudience) {
        return false;
      }
      if (selectedPlatform !== "all" && persona.platform !== selectedPlatform) {
        return false;
      }
      if (selectedFamily !== "all" && persona.family !== selectedFamily) {
        return false;
      }
      if (selectedSeniority !== "all" && persona.seniority !== selectedSeniority) {
        return false;
      }
      if (selectedValue !== "all" && !persona.coreValues.includes(selectedValue)) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        persona.archetype,
        persona.family,
        persona.seniority,
        persona.audienceName,
        persona.platform,
        ...persona.coreValues,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [
    insights.personas,
    search,
    selectedAudience,
    selectedFamily,
    selectedPlatform,
    selectedSeniority,
    selectedValue,
  ]);

  const summary = useMemo(() => {
    const total = filteredPersonas.length;
    const archetypes = new Set(filteredPersonas.map((persona) => persona.archetype)).size;
    const values = new Set(filteredPersonas.flatMap((persona) => persona.coreValues)).size;
    return {
      personas: total,
      audiences: new Set(filteredPersonas.map((persona) => persona.audienceId)).size,
      avgReactivity: average(filteredPersonas.map((persona) => persona.reactivity)),
      avgSophistication: average(filteredPersonas.map((persona) => persona.sophistication)),
      avgAffinity: average(filteredPersonas.map((persona) => persona.affinity)),
      archetypes,
      values,
    };
  }, [filteredPersonas]);

  const topFamilies = useMemo(() => {
    const total = filteredPersonas.length || 1;
    return groupCounts(filteredPersonas.map((persona) => persona.family))
      .slice(0, 8)
      .map(([label, count]) => ({
        label,
        count,
        share: count / total,
      }));
  }, [filteredPersonas]);

  const topValues = useMemo(() => {
    const total = filteredPersonas.length || 1;
    return groupCounts(filteredPersonas.flatMap((persona) => persona.coreValues))
      .slice(0, 18)
      .map(([label, count]) => ({
        label,
        count,
        share: count / total,
      }));
  }, [filteredPersonas]);

  const audienceMix = useMemo(() => {
    const grouped = new Map<
      string,
      {
        label: string;
        count: number;
        reactivity: number[];
        sophistication: number[];
        affinity: number[];
      }
    >();
    for (const persona of filteredPersonas) {
      if (!grouped.has(persona.audienceId)) {
        grouped.set(persona.audienceId, {
          label: persona.audienceName,
          count: 0,
          reactivity: [],
          sophistication: [],
          affinity: [],
        });
      }
      const entry = grouped.get(persona.audienceId)!;
      entry.count += 1;
      entry.reactivity.push(persona.reactivity);
      entry.sophistication.push(persona.sophistication);
      entry.affinity.push(persona.affinity);
    }
    return Array.from(grouped.entries())
      .map(([id, entry]) => ({
        id,
        label: entry.label,
        count: entry.count,
        avgReactivity: average(entry.reactivity),
        avgSophistication: average(entry.sophistication),
        avgAffinity: average(entry.affinity),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredPersonas]);

  const segmentBubbles = useMemo(() => {
    const grouped = new Map<
      string,
      {
        label: string;
        family: string;
        seniority: string;
        count: number;
        reactivity: number[];
        sophistication: number[];
        affinity: number[];
        archetypes: Map<string, number>;
      }
    >();

    for (const persona of filteredPersonas) {
      const label = `${persona.family} · ${persona.seniority}`;
      if (!grouped.has(label)) {
        grouped.set(label, {
          label,
          family: persona.family,
          seniority: persona.seniority,
          count: 0,
          reactivity: [],
          sophistication: [],
          affinity: [],
          archetypes: new Map<string, number>(),
        });
      }
      const entry = grouped.get(label)!;
      entry.count += 1;
      entry.reactivity.push(persona.reactivity);
      entry.sophistication.push(persona.sophistication);
      entry.affinity.push(persona.affinity);
      entry.archetypes.set(
        persona.archetype,
        (entry.archetypes.get(persona.archetype) ?? 0) + 1
      );
    }

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        avgReactivity: average(entry.reactivity),
        avgSophistication: average(entry.sophistication),
        avgAffinity: average(entry.affinity),
        topArchetypes: Array.from(entry.archetypes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([label]) => label),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [filteredPersonas]);

  const spotlight = useMemo(() => {
    return [...filteredPersonas]
      .sort((a, b) => b.sophistication + b.reactivity - (a.sophistication + a.reactivity))
      .slice(0, 12);
  }, [filteredPersonas]);

  const resetFilters = () => {
    setSelectedAudience("all");
    setSelectedPlatform("all");
    setSelectedFamily("all");
    setSelectedSeniority("all");
    setSelectedValue("all");
    setSearch("");
  };

  return (
    <div className="mx-auto max-w-[1380px] px-6" style={{ padding: "36px 24px 84px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <span className="mono-label">Operator-only persona intelligence</span>
          <h1
            style={{
              marginTop: 14,
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(2.6rem, 5vw, 4.3rem)",
              lineHeight: 0.94,
              letterSpacing: "-0.045em",
              color: "var(--text-primary)",
            }}
          >
            Explore the corpus like a market map.
          </h1>
          <p
            style={{
              marginTop: 18,
              maxWidth: 700,
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--text-secondary)",
            }}
          >
            Filter the live persona set by audience, platform, role family, seniority,
            and value tags. This is built to demo segmentation quality, stakeholder
            structure, and commercial research utility at a glance.
          </p>
        </div>
        <div className="panel" style={{ minWidth: 260, padding: "18px 20px" }}>
          <div className="mono-label">Session</div>
          <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
            {userEmail}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: "var(--text-tertiary)" }}>
            {filteredPersonas.length.toLocaleString()} personas in the current slice.
          </div>
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: "var(--text-tertiary)" }}>
            Updated {new Date(insights.generatedAt).toLocaleString("en-US")}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24, padding: "18px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <FilterSelect
            label="Audience"
            value={selectedAudience}
            onChange={setSelectedAudience}
            options={[
              { value: "all", label: "All audiences" },
              ...insights.filterOptions.audiences.map((audience) => ({
                value: audience.id,
                label: `${audience.name} (${audience.count})`,
              })),
            ]}
          />
          <FilterSelect
            label="Platform"
            value={selectedPlatform}
            onChange={setSelectedPlatform}
            options={[
              { value: "all", label: "All platforms" },
              ...insights.filterOptions.platforms.map((platform) => ({
                value: platform,
                label: platform,
              })),
            ]}
          />
          <FilterSelect
            label="Family"
            value={selectedFamily}
            onChange={setSelectedFamily}
            options={[
              { value: "all", label: "All families" },
              ...insights.filterOptions.families.map((family) => ({
                value: family,
                label: family,
              })),
            ]}
          />
          <FilterSelect
            label="Seniority"
            value={selectedSeniority}
            onChange={setSelectedSeniority}
            options={[
              { value: "all", label: "All seniority" },
              ...insights.filterOptions.seniority.map((entry) => ({
                value: entry,
                label: entry,
              })),
            ]}
          />
          <FilterSelect
            label="Value tag"
            value={selectedValue}
            onChange={setSelectedValue}
            options={[
              { value: "all", label: "All values" },
              ...insights.filterOptions.values.map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="mono-label">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="archetype, value, audience..."
              className="input"
            />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip label={`${summary.personas.toLocaleString()} personas`} />
            <Chip label={`${summary.audiences.toLocaleString()} audiences`} />
            <Chip label={`${summary.archetypes.toLocaleString()} archetypes`} />
            <Chip label={`${summary.values.toLocaleString()} values`} />
          </div>
          <button type="button" className="btn-secondary" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <StatCard label="Avg reactivity" value={summary.avgReactivity.toFixed(2)} />
        <StatCard label="Avg sophistication" value={summary.avgSophistication.toFixed(2)} />
        <StatCard label="Avg affinity" value={formatSigned(summary.avgAffinity)} />
        <StatCard
          label="Skeptical share"
          value={formatPct(
            filteredPersonas.filter((persona) => persona.affinity < -0.1).length /
              Math.max(filteredPersonas.length, 1)
          )}
        />
      </div>

      <section
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div className="panel" style={{ padding: "18px 18px 14px" }}>
          <SectionHeader
            title="Segment map"
            copy="Each circle is a family × seniority segment. X-axis is sophistication, Y-axis is reactivity, size is population, color is affinity."
          />
          <ScatterPlot
            items={segmentBubbles}
            hovered={hoveredSegment}
            onHover={setHoveredSegment}
          />
        </div>

        <div className="panel" style={{ padding: "18px 18px 14px" }}>
          <SectionHeader
            title="Segment detail"
            copy="Hover a circle to inspect the cluster. This is the sales-demo layer."
          />
          {hoveredSegment ? (
            <SegmentDetail
              segment={segmentBubbles.find((segment) => segment.label === hoveredSegment) ?? null}
            />
          ) : (
            <div
              style={{
                marginTop: 18,
                minHeight: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 14,
                lineHeight: 1.6,
                background: "var(--bg-subtle)",
                borderRadius: 18,
              }}
            >
              Hover any bubble to inspect the segment.
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
          gap: 16,
        }}
      >
        <div className="panel" style={{ padding: "18px 18px 14px" }}>
          <SectionHeader
            title="Role-family mix"
            copy="Which commercial clusters dominate the current slice."
          />
          <div style={{ marginTop: 16 }}>
            {topFamilies.map((entry) => (
              <BarRow
                key={entry.label}
                label={entry.label}
                value={entry.count}
                share={entry.share}
              />
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: "18px 18px 14px" }}>
          <SectionHeader
            title="Top value tags"
            copy="Semantic anchors repeated across the current slice."
          />
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {topValues.map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() =>
                  setSelectedValue((current) =>
                    current === entry.label ? "all" : entry.label
                  )
                }
                style={{
                  border: selectedValue === entry.label ? "1px solid var(--ink)" : "1px solid var(--border)",
                  background: selectedValue === entry.label ? "var(--ink)" : "var(--bg-subtle)",
                  color: selectedValue === entry.label ? "var(--butter-deep)" : "var(--text-primary)",
                  borderRadius: 999,
                  padding: "10px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {entry.label} · {entry.count}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
          gap: 16,
        }}
      >
        <div className="panel" style={{ padding: "18px 18px 14px" }}>
          <SectionHeader
            title="Audience comparison"
            copy="Distinct uploads should resolve into visibly different behavioral profiles."
          />
          <div style={{ marginTop: 16 }}>
            {audienceMix.map((audience) => (
              <AudienceRow key={audience.id} audience={audience} />
            ))}
          </div>
        </div>

        <div className="panel" style={{ padding: "18px 18px 14px" }}>
          <SectionHeader
            title="Persona spotlight"
            copy="High-signal personas from the current slice, ranked by sophistication + reactivity."
          />
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {spotlight.map((persona) => (
              <div
                key={persona.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "14px 14px 12px",
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 600 }}>
                      {persona.archetype}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-tertiary)" }}>
                      {persona.family} · {persona.seniority} · {persona.audienceName}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-data), monospace",
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {persona.platform}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {persona.coreValues.slice(0, 4).map((value) => (
                    <Chip key={value} label={value} compact />
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  <MetricCard label="React" value={persona.reactivity.toFixed(2)} />
                  <MetricCard label="Soph" value={persona.sophistication.toFixed(2)} />
                  <MetricCard label="Affinity" value={formatSigned(persona.affinity)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="mono-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionHeader({ title, copy }: { title: string; copy: string }) {
  return (
    <>
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 28,
          letterSpacing: "-0.03em",
          lineHeight: 1.02,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.65, color: "var(--text-secondary)" }}>
        {copy}
      </p>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel" style={{ padding: "18px 18px 16px" }}>
      <div className="mono-label">{label}</div>
      <div
        style={{
          marginTop: 12,
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 38,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Chip({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: compact ? "6px 9px" : "8px 10px",
        borderRadius: 999,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        fontSize: compact ? 12 : 13,
        lineHeight: 1.1,
      }}
    >
      {label}
    </span>
  );
}

function BarRow({ label, value, share }: { label: string; value: number; share: number }) {
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--text-tertiary)" }}>
          {value.toLocaleString()} · {formatPct(share)}
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "var(--bg-subtle)", overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(4, share * 100)}%`,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--ink) 0%, var(--butter-deep) 100%)",
          }}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 8px 6px", borderRadius: 10, background: "var(--bg-subtle)" }}>
      <div className="mono-label" style={{ fontSize: 9 }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function AudienceRow({
  audience,
}: {
  audience: {
    id: string;
    label: string;
    count: number;
    avgReactivity: number;
    avgSophistication: number;
    avgAffinity: number;
  };
}) {
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {audience.label}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-tertiary)" }}>
            {audience.count.toLocaleString()} personas
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, minWidth: 210 }}>
          <MetricCard label="React" value={audience.avgReactivity.toFixed(2)} />
          <MetricCard label="Soph" value={audience.avgSophistication.toFixed(2)} />
          <MetricCard label="Affinity" value={formatSigned(audience.avgAffinity)} />
        </div>
      </div>
    </div>
  );
}

function ScatterPlot({
  items,
  hovered,
  onHover,
}: {
  items: Array<{
    label: string;
    family: string;
    seniority: string;
    count: number;
    avgReactivity: number;
    avgSophistication: number;
    avgAffinity: number;
    topArchetypes: string[];
  }>;
  hovered: string | null;
  onHover: (label: string | null) => void;
}) {
  const width = 760;
  const height = 420;
  const padding = 42;
  const maxCount = Math.max(...items.map((item) => item.count), 1);
  return (
    <div style={{ marginTop: 18 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <rect x={0} y={0} width={width} height={height} rx={18} fill="var(--bg-subtle)" />
        {[0.25, 0.5, 0.75].map((tick) => {
          const x = padding + tick * (width - padding * 2);
          const y = height - padding - tick * (height - padding * 2);
          return (
            <g key={tick}>
              <line x1={x} y1={padding} x2={x} y2={height - padding} stroke="rgba(141,135,124,0.18)" />
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(141,135,124,0.18)" />
            </g>
          );
        })}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(141,135,124,0.45)" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(141,135,124,0.45)" />
        <text x={width / 2} y={height - 10} textAnchor="middle" fontSize="12" fill="var(--text-tertiary)">
          sophistication →
        </text>
        <text
          x={14}
          y={height / 2}
          textAnchor="middle"
          fontSize="12"
          fill="var(--text-tertiary)"
          transform={`rotate(-90 14 ${height / 2})`}
        >
          reactivity →
        </text>
        {items.map((item) => {
          const x = padding + item.avgSophistication * (width - padding * 2);
          const y = height - padding - item.avgReactivity * (height - padding * 2);
          const radius = 10 + (item.count / maxCount) * 28;
          const tone = toneFromAffinity(item.avgAffinity);
          const fill = AFFINITY_COLORS[tone];
          const active = hovered === item.label;
          return (
            <g
              key={item.label}
              onMouseEnter={() => onHover(item.label)}
              onMouseLeave={() => onHover(null)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={fill}
                fillOpacity={active ? 0.95 : 0.72}
                stroke={active ? "var(--ink)" : "rgba(26,26,26,0.16)"}
                strokeWidth={active ? 2.5 : 1}
              />
              {active ? (
                <text x={x} y={y - radius - 10} textAnchor="middle" fontSize="11" fill="var(--text-primary)">
                  {item.family}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
        <LegendSwatch color={AFFINITY_COLORS.skeptical} label="skeptical" />
        <LegendSwatch color={AFFINITY_COLORS.neutral} label="neutral" />
        <LegendSwatch color={AFFINITY_COLORS.warm} label="warm" />
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
      {label}
    </span>
  );
}

function SegmentDetail({
  segment,
}: {
  segment:
    | {
        label: string;
        family: string;
        seniority: string;
        count: number;
        avgReactivity: number;
        avgSophistication: number;
        avgAffinity: number;
        topArchetypes: string[];
      }
    | null;
}) {
  if (!segment) return null;
  return (
    <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
      <div>
        <div className="mono-label">{segment.family}</div>
        <div
          style={{
            marginTop: 10,
            fontSize: 26,
            lineHeight: 1.02,
            color: "var(--text-primary)",
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.03em",
          }}
        >
          {segment.seniority}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
          {segment.count.toLocaleString()} personas in this cluster
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <MetricCard label="React" value={segment.avgReactivity.toFixed(2)} />
        <MetricCard label="Soph" value={segment.avgSophistication.toFixed(2)} />
        <MetricCard label="Affinity" value={formatSigned(segment.avgAffinity)} />
      </div>
      <div style={{ padding: "14px", borderRadius: 14, background: "var(--bg-subtle)", fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
        Top archetypes: {segment.topArchetypes.join(", ") || "—"}
      </div>
      <div style={{ padding: "14px", borderRadius: 14, background: "var(--bg-subtle)", fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
        Buyer framing: this cohort is {toneFromAffinity(segment.avgAffinity)} in baseline posture,
        averages {segment.avgSophistication.toFixed(2)} sophistication, and sits at {segment.avgReactivity.toFixed(2)} reactivity.
      </div>
    </div>
  );
}
