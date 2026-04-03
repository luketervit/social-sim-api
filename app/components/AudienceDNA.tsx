"use client";

interface AudienceProfile {
  name: string;
  codename: string;
  traits: {
    reactivity: number;
    sophistication: number;
    virality: number;
    loyalty: number;
    hostility: number;
  };
  description: string;
}

const AUDIENCES: AudienceProfile[] = [
  {
    name: "Tech Bros",
    codename: "Silicon Valley",
    traits: { reactivity: 0.72, sophistication: 0.81, virality: 0.65, loyalty: 0.34, hostility: 0.48 },
    description: "VC-adjacent optimists who will ratio you for questioning the narrative, then pivot to agreement when the wind shifts.",
  },
  {
    name: "Angry Gamers",
    codename: "Hostile Gamer",
    traits: { reactivity: 0.94, sophistication: 0.31, virality: 0.89, loyalty: 0.15, hostility: 0.92 },
    description: "Hair-trigger reactors with deep platform fluency. Will organize boycotts over font changes. Meme-first communication.",
  },
  {
    name: "Finance Twitter",
    codename: "FinTwit",
    traits: { reactivity: 0.58, sophistication: 0.88, virality: 0.71, loyalty: 0.42, hostility: 0.39 },
    description: "Data-driven contrarians. Will dissect your quarterly report before the ink dries. Thread-maximizers.",
  },
];

const TRAIT_LABELS = ["reactivity", "sophistication", "virality", "loyalty", "hostility"] as const;

function RadarChart({ traits }: { traits: AudienceProfile["traits"] }) {
  const size = 140;
  const center = size / 2;
  const radius = 52;
  const angles = TRAIT_LABELS.map((_, i) => (i * 2 * Math.PI) / TRAIT_LABELS.length - Math.PI / 2);

  const rings = [0.25, 0.5, 0.75, 1.0];

  const points = TRAIT_LABELS.map((key, i) => {
    const value = traits[key];
    const x = center + radius * value * Math.cos(angles[i]);
    const y = center + radius * value * Math.sin(angles[i]);
    return { x, y };
  });

  const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r) => (
        <polygon
          key={r}
          points={angles
            .map((a) => `${center + radius * r * Math.cos(a)},${center + radius * r * Math.sin(a)}`)
            .join(" ")}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={0.5}
        />
      ))}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={center + radius * Math.cos(a)}
          y2={center + radius * Math.sin(a)}
          stroke="rgba(0,0,0,0.04)"
          strokeWidth={0.5}
        />
      ))}
      <path d={pathData} fill="var(--accent-muted)" stroke="var(--accent)" strokeWidth={1.5} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--accent)" />
      ))}
    </svg>
  );
}

export default function AudienceDNA() {
  return (
    <section style={{ padding: "96px 0" }}>
      <div className="mx-auto max-w-[1200px] px-6">
        <div style={{ marginBottom: 56, maxWidth: 560 }}>
          <span className="mono-label">Audience Archetypes</span>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              marginTop: 14,
            }}
          >
            Audience DNA
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 16, marginTop: 14, lineHeight: 1.7 }}>
            Ship with seeded benchmark audiences or map your own customer data
            into synthetic agents with distinct reactivity, loyalty, and platform behavior.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {AUDIENCES.map((audience) => (
            <article
              key={audience.codename}
              className="panel"
              style={{ padding: "36px 32px" }}
            >
              <span className="mono-label" style={{ color: "var(--text-tertiary)" }}>
                {audience.codename}
              </span>
              <h3
                style={{
                  fontSize: 24,
                  marginTop: 14,
                  marginBottom: 28,
                  fontFamily: "var(--font-display), Georgia, serif",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {audience.name}
              </h3>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <RadarChart traits={audience.traits} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {TRAIT_LABELS.map((trait) => (
                  <div
                    key={trait}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontFamily: "var(--font-data), monospace",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {trait}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        color: audience.traits[trait] > 0.8 ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: audience.traits[trait] > 0.8 ? 600 : 400,
                      }}
                    >
                      {audience.traits[trait].toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.75, marginTop: 24 }}>
                {audience.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
