"use client";

import { motion, type Variants } from "framer-motion";

const smoothEase = [0.22, 1, 0.36, 1] as const;

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
    codename: "ARCHETYPE::SILICON_VALLEY",
    traits: { reactivity: 0.72, sophistication: 0.81, virality: 0.65, loyalty: 0.34, hostility: 0.48 },
    description: "VC-adjacent optimists who will ratio you for questioning the narrative, then pivot to agreement when the wind shifts.",
  },
  {
    name: "Angry Gamers",
    codename: "ARCHETYPE::HOSTILE_GAMER",
    traits: { reactivity: 0.94, sophistication: 0.31, virality: 0.89, loyalty: 0.15, hostility: 0.92 },
    description: "Hair-trigger reactors with deep platform fluency. Will organize boycotts over font changes. Meme-first communication.",
  },
  {
    name: "Finance Twitter",
    codename: "ARCHETYPE::FINTWIT",
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

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Data points
  const points = TRAIT_LABELS.map((key, i) => {
    const value = traits[key];
    const x = center + radius * value * Math.cos(angles[i]);
    const y = center + radius * value * Math.sin(angles[i]);
    return { x, y };
  });

  const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={angles
            .map((a) => `${center + radius * r * Math.cos(a)},${center + radius * r * Math.sin(a)}`)
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
        />
      ))}
      {/* Axes */}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={center + radius * Math.cos(a)}
          y2={center + radius * Math.sin(a)}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={0.5}
        />
      ))}
      {/* Data shape */}
      <path d={pathData} fill="var(--accent-muted)" stroke="var(--accent)" strokeWidth={1.5} />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--accent)" />
      ))}
    </svg>
  );
}

const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: smoothEase,
      staggerChildren: 0.08,
    },
  },
};

const cardReveal: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: smoothEase,
    },
  },
};

export default function AudienceDNA() {
  return (
    <section style={{ padding: "96px 0" }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <motion.div
          className="section-shell"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionReveal}
        >
          <div style={{ marginBottom: 56 }}>
          <span className="mono-label">AUDIENCE_MATRIX :: 12,480 ARCHETYPES LOADED</span>
          <h2
            style={{
              fontSize: 36,
              color: "var(--text-primary)",
              marginTop: 12,
            }}
          >
            Audience DNA
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 15, marginTop: 12, maxWidth: 560, lineHeight: 1.75 }}>
            Every archetype is a psychographic fingerprint. Reactivity baselines, hostility thresholds, platform fluency scores.
          </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 28,
            }}
          >
          {AUDIENCES.map((audience, i) => (
            <motion.div
              key={audience.codename}
              variants={cardReveal}
              style={{
                padding: 40,
                borderRadius: 24,
                background:
                  "linear-gradient(180deg, rgba(39,39,42,0.26), rgba(24,24,27,0.08) 52%, transparent 100%)",
              }}
            >
              <span className="mono-label">
                {audience.codename}
              </span>
              <h3
                style={{
                  fontSize: 24,
                  color: "var(--text-primary)",
                  marginTop: 18,
                  marginBottom: 28,
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
                        color: audience.traits[trait] > 0.8 ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {audience.traits[trait].toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.8, marginTop: 28 }}>
                {audience.description}
              </p>
            </motion.div>
          ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
