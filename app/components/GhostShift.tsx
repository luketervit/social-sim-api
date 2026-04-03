"use client";

import { motion, type Variants } from "framer-motion";

const smoothEase = [0.22, 1, 0.36, 1] as const;

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

const blockReveal: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: smoothEase,
    },
  },
};

// Sentiment divergence data — two series over 10 rounds
const PUBLIC_SENTIMENT = [0.1, -0.12, -0.28, -0.41, -0.55, -0.62, -0.71, -0.78, -0.81, -0.79];
const BRAND_EXPECTATION = [0.6, 0.55, 0.48, 0.42, 0.35, 0.28, 0.15, 0.05, -0.1, -0.22];

function buildAngularPath(data: number[], width: number, height: number, padding: number): string {
  const xStep = (width - padding * 2) / (data.length - 1);
  const yMin = -1;
  const yMax = 1;
  const yScale = (height - padding * 2) / (yMax - yMin);

  return data
    .map((value, i) => {
      const x = padding + i * xStep;
      const y = padding + (yMax - value) * yScale;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildAreaPath(data: number[], width: number, height: number, padding: number): string {
  const linePath = buildAngularPath(data, width, height, padding);
  const xStep = (width - padding * 2) / (data.length - 1);
  const lastX = padding + (data.length - 1) * xStep;
  const firstX = padding;
  const yMax = 1;
  const yScale = (height - padding * 2) / (yMax - (-1));
  const baseline = padding + (yMax - (-1)) * yScale;

  return `${linePath} L ${lastX.toFixed(1)} ${baseline.toFixed(1)} L ${firstX.toFixed(1)} ${baseline.toFixed(1)} Z`;
}

export default function GhostShift() {
  const svgWidth = 880;
  const svgHeight = 320;
  const padding = 48;

  const publicPath = buildAngularPath(PUBLIC_SENTIMENT, svgWidth, svgHeight, padding);
  const brandPath = buildAngularPath(BRAND_EXPECTATION, svgWidth, svgHeight, padding);
  const publicArea = buildAreaPath(PUBLIC_SENTIMENT, svgWidth, svgHeight, padding);

  const xStep = (svgWidth - padding * 2) / (PUBLIC_SENTIMENT.length - 1);
  const yScale = (svgHeight - padding * 2) / 2;

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
        <motion.div variants={blockReveal} style={{ marginBottom: 56 }}>
          <span className="mono-label">GHOST_SHIFT :: SENTIMENT_DIVERGENCE_ANALYSIS</span>
          <h2
            style={{
              fontSize: 36,
              color: "var(--text-primary)",
              marginTop: 12,
            }}
          >
            The Ghost Shift
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 15, marginTop: 12, maxWidth: 620, lineHeight: 1.75 }}>
            The gap between what brands expect and what the crowd actually feels.
            We call this divergence the Ghost Shift — and closing it is how teams make decisions that land.
          </p>
        </motion.div>

        <motion.div
          variants={blockReveal}
          style={{
            padding: 0,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 8px 26px",
            }}
          >
            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 16, height: 2, background: "var(--accent)" }} />
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                  Public Sentiment
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 16, height: 2, background: "var(--text-tertiary)" }} />
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                  Brand Expectation
                </span>
              </div>
            </div>
            <span
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                color: "var(--text-primary)",
                letterSpacing: "0.05em",
                textTransform: "uppercase" as const,
              }}
            >
              DIVERGENCE: 0.57
            </span>
          </div>

          <div
            style={{
              padding: 32,
              borderRadius: 24,
              background:
                "linear-gradient(180deg, rgba(39,39,42,0.28), rgba(24,24,27,0.08) 56%, transparent 100%)",
            }}
          >
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              <line
                x1={padding}
                y1={padding + yScale}
                x2={svgWidth - padding}
                y2={padding + yScale}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={0.5}
                strokeDasharray="4 4"
              />

              {[-0.5, 0.5].map((val) => (
                <line
                  key={val}
                  x1={padding}
                  y1={padding + (1 - val) * yScale}
                  x2={svgWidth - padding}
                  y2={padding + (1 - val) * yScale}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={0.5}
                />
              ))}

              {[-1, -0.5, 0, 0.5, 1].map((val) => (
                <text
                  key={val}
                  x={padding - 12}
                  y={padding + (1 - val) * yScale + 3}
                  fill="var(--text-tertiary)"
                  fontSize={9}
                  fontFamily="var(--font-data)"
                  textAnchor="end"
                >
                  {val.toFixed(1)}
                </text>
              ))}

              {PUBLIC_SENTIMENT.map((_, i) => (
                <text
                  key={i}
                  x={padding + i * xStep}
                  y={svgHeight - 16}
                  fill="var(--text-tertiary)"
                  fontSize={9}
                  fontFamily="var(--font-data)"
                  textAnchor="middle"
                >
                  R{i + 1}
                </text>
              ))}

              {PUBLIC_SENTIMENT.map((_, i) => (
                <line
                  key={i}
                  x1={padding + i * xStep}
                  y1={padding}
                  x2={padding + i * xStep}
                  y2={svgHeight - padding}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth={0.5}
                />
              ))}

              <path d={publicArea} fill="var(--champagne-glow)" />

              <path
                d={brandPath}
                fill="none"
                stroke="var(--text-tertiary)"
                strokeWidth={1.5}
                className="angular-line"
              />

              <path
                d={publicPath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                className="angular-line"
              />

              {PUBLIC_SENTIMENT.map((val, i) => (
                <rect
                  key={`p-${i}`}
                  x={padding + i * xStep - 2.5}
                  y={padding + (1 - val) * yScale - 2.5}
                  width={5}
                  height={5}
                  fill="var(--accent)"
                />
              ))}

              {BRAND_EXPECTATION.map((val, i) => (
                <rect
                  key={`b-${i}`}
                  x={padding + i * xStep - 2}
                  y={padding + (1 - val) * yScale - 2}
                  width={4}
                  height={4}
                  fill="var(--text-tertiary)"
                />
              ))}
            </svg>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 20,
              marginTop: 28,
            }}
          >
            {[
              { label: "Peak Divergence", value: "0.83", round: "R7" },
              { label: "Audience Alignment", value: "LOW", round: null },
              { label: "Opportunity Window", value: "R3–R5", round: null },
              { label: "Recommended Action", value: "REFINE", round: null },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  padding: "24px 0 0",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    color: "var(--text-tertiary)",
                    display: "block",
                  }}
                >
                  {stat.label}
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 16,
                    color: stat.value === "REFINE" || stat.value === "LOW" ? "var(--text-primary)" : "var(--text-secondary)",
                    marginTop: 8,
                    display: "block",
                  }}
                >
                  {stat.value}
                  {stat.round && (
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 6 }}>
                      @ {stat.round}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
