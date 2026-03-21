import {
  PLAYGROUND_PERSONA_CAP,
  PLAYGROUND_RUNS_INCLUDED,
  SIMULATION_ROUNDS,
} from "@/lib/credits";

type PlanName = "Developer" | "Growth" | "Enterprise";

type Plan = {
  name: PlanName;
  price: string;
  credits: string;
  summary: string;
  featured?: boolean;
  cta: string;
  highlights: string[];
};

type ComparisonRow = {
  label: string;
  values: Record<PlanName, string | boolean>;
};

const PLAYGROUND_LAYER = {
  name: "Free Playground",
  price: "Free",
  summary:
    "A separate evaluation layer for testing seeded audiences before you move into paid API usage.",
  highlights: [
    `${PLAYGROUND_RUNS_INCLUDED} free sandbox runs per day`,
    `Up to ${PLAYGROUND_PERSONA_CAP} agents across ${SIMULATION_ROUNDS} rounds`,
    "Good for demos, validation, and early prompt testing",
  ],
  note: "Paid plans begin when you need API keys, larger workloads, top-ups, or product integration.",
};

const PLANS: Plan[] = [
  {
    name: "Developer",
    price: "$19/mo",
    credits: "50,000 included",
    summary:
      "For developers moving beyond the free playground and starting to integrate Atharias through the API.",
    cta: "Build with the API",
    highlights: [
      "First paid API tier",
      "~50 standard runs included",
      "100 max agents per simulation",
    ],
  },
  {
    name: "Growth",
    price: "$99/mo",
    credits: "500,000 included",
    summary:
      "For companies using Atharias internally across product, research, communications, or strategy workflows.",
    featured: true,
    cta: "Scale API usage",
    highlights: [
      "~500 standard runs included",
      "500 max agents per simulation",
      "Priority queue + credit top-ups",
    ],
  },
  {
    name: "Enterprise",
    price: "Contact",
    credits: "Custom volume",
    summary:
      "For teams embedding Atharias into their own product, serving end users, and needing higher-volume contractual infrastructure.",
    cta: "Talk to sales",
    highlights: [
      "Customer-facing product integration",
      "Dedicated worker capacity",
      "Custom limits, support, and SLA",
    ],
  },
];

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Included monthly credits",
    values: {
      Developer: "50,000",
      Growth: "500,000",
      Enterprise: "Custom",
    },
  },
  {
    label: "Credit top-ups",
    values: {
      Developer: "Add 25k for $15",
      Growth: "Add 100k for $50",
      Enterprise: "Volume pricing",
    },
  },
  {
    label: "Model access",
    values: {
      Developer: "Core access",
      Growth: "Broader access",
      Enterprise: "Full access",
    },
  },
  {
    label: "Advanced model options",
    values: {
      Developer: false,
      Growth: true,
      Enterprise: true,
    },
  },
  {
    label: "Direct customer data sync",
    values: {
      Developer: false,
      Growth: true,
      Enterprise: true,
    },
  },
  {
    label: "Queue priority",
    values: {
      Developer: "Standard",
      Growth: "Priority",
      Enterprise: "Dedicated",
    },
  },
  {
    label: "Max agents per simulation",
    values: {
      Developer: "100",
      Growth: "500",
      Enterprise: "Higher custom limits",
    },
  },
  {
    label: "Max rounds per simulation",
    values: {
      Developer: "10",
      Growth: "10",
      Enterprise: "Higher custom limits",
    },
  },
  {
    label: "Support",
    values: {
      Developer: "Standard",
      Growth: "Priority",
      Enterprise: "Dedicated + SLA",
    },
  },
];

function FeatureStatus({ included }: { included: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 20,
        height: 20,
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${
          included ? "rgba(228,228,231,0.22)" : "rgba(113,113,122,0.18)"
        }`,
        background: included ? "rgba(228,228,231,0.08)" : "rgba(24,24,27,0.72)",
        color: included ? "var(--text-primary)" : "var(--text-tertiary)",
        flexShrink: 0,
      }}
    >
      {included ? "✓" : "×"}
    </span>
  );
}

function renderCell(value: string | boolean) {
  if (typeof value === "boolean") {
    return <FeatureStatus included={value} />;
  }

  return (
    <span
      style={{
        color: "var(--text-secondary)",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {value}
    </span>
  );
}

export default function PricingSection() {
  return (
    <section style={{ padding: "96px 0 72px" }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div style={{ marginBottom: 56, maxWidth: 760 }}>
          <span className="mono-label">ACCESS_LAYERS :: FREE_PLAYGROUND_PLUS_API_ACCESS</span>
          <h2
            style={{
              fontSize: 36,
              color: "var(--text-primary)",
              marginTop: 12,
            }}
          >
            API Access
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 15,
              marginTop: 12,
              lineHeight: 1.75,
            }}
          >
            The playground is the free evaluation layer. Paid pricing starts
            when you need API keys, larger simulations, and production-grade
            throughput. Credits are tied to generated messages, and a full
            100-agent, 10-round simulation uses up to 1,000 credits, so the
            paid plans scale with usage instead of seats.
          </p>
        </div>

        <div
          style={{
            marginBottom: 32,
            borderRadius: 28,
            border: "1px solid rgba(39,39,42,0.8)",
            background:
              "linear-gradient(180deg, rgba(236,253,245,0.06), rgba(24,24,27,0.32) 40%, rgba(9,9,11,0.96) 100%)",
            overflow: "hidden",
          }}
        >
          <div
            className="grid gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
            style={{ alignItems: "stretch" }}
          >
            <article style={{ padding: 28 }}>
              <span className="mono-label">FREE_LAYER :: PLAYGROUND</span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                <h3
                  style={{
                    fontSize: 30,
                    color: "var(--text-primary)",
                  }}
                >
                  {PLAYGROUND_LAYER.name}
                </h3>
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 20,
                    color: "var(--accent)",
                    letterSpacing: "-0.04em",
                  }}
                >
                  {PLAYGROUND_LAYER.price}
                </span>
              </div>

              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.75,
                  marginTop: 14,
                  maxWidth: 560,
                }}
              >
                {PLAYGROUND_LAYER.summary}
              </p>

              <div className="grid gap-3 sm:grid-cols-3" style={{ marginTop: 20 }}>
                {PLAYGROUND_LAYER.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: "1px solid rgba(63,63,70,0.65)",
                      background: "rgba(9,9,11,0.35)",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: 13,
                        lineHeight: 1.65,
                      }}
                    >
                      {highlight}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <aside
              style={{
                padding: 28,
                borderTop: "1px solid rgba(39,39,42,0.8)",
                borderColor: "rgba(39,39,42,0.8)",
              }}
              className="md:border-t-0 md:border-l"
            >
              <span className="mono-label">WHEN_PAID_STARTS</span>
              <p
                style={{
                  color: "var(--text-primary)",
                  fontSize: 18,
                  lineHeight: 1.5,
                  marginTop: 18,
                  maxWidth: 300,
                }}
              >
                {PLAYGROUND_LAYER.note}
              </p>
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(63,63,70,0.6)",
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.65 }}>
                  API keys for backend or product workflows
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.65 }}>
                  Larger agent counts and more monthly simulation volume
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.65 }}>
                  Priority queueing, top-ups, and commercial support
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div style={{ marginBottom: 24, maxWidth: 620 }}>
          <span className="mono-label">PAID_LAYER :: API_ACCESS</span>
          <h3
            style={{
              fontSize: 24,
              color: "var(--text-primary)",
              marginTop: 12,
            }}
          >
            Paid API Access
          </h3>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              lineHeight: 1.75,
              marginTop: 10,
            }}
          >
            Developer, Growth, and Enterprise are usage-based API tiers for
            teams embedding simulations into internal tooling, workflows, or
            customer-facing products.
          </p>
        </div>

        <div className="grid gap-6 md:hidden">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              style={{
                padding: 28,
                borderRadius: 24,
                border: plan.featured
                  ? "1px solid rgba(228,228,231,0.18)"
                  : "1px solid rgba(39,39,42,0.7)",
                background: plan.featured
                  ? "linear-gradient(180deg, rgba(228,228,231,0.08), rgba(24,24,27,0.88) 24%, rgba(9,9,11,0.95) 100%)"
                  : "linear-gradient(180deg, rgba(39,39,42,0.28), rgba(24,24,27,0.12) 58%, rgba(9,9,11,0.94) 100%)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <span className="mono-label">PLAN :: {plan.name.toUpperCase()}</span>
                  <h3
                    style={{
                      fontSize: 28,
                      color: "var(--text-primary)",
                      marginTop: 18,
                    }}
                  >
                    {plan.name}
                  </h3>
                </div>

                {plan.featured ? (
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#09090b",
                      background: "var(--accent)",
                      borderRadius: 999,
                      padding: "7px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Most used
                  </span>
                ) : null}
              </div>

              <div
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 34,
                  letterSpacing: "-0.04em",
                  color: "var(--text-primary)",
                  marginTop: 28,
                }}
              >
                {plan.price}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  marginTop: 18,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(63,63,70,0.6)",
                }}
              >
                <div>
                  <span className="mono-label">Included credits</span>
                  <div
                    className="tabular-nums"
                    style={{
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-data)",
                      fontSize: 15,
                      marginTop: 6,
                    }}
                  >
                    {plan.credits}
                  </div>
                </div>
              </div>

              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.75,
                  marginTop: 18,
                }}
              >
                {plan.summary}
              </p>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(63,63,70,0.6)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {plan.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "20px 1fr",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <FeatureStatus included={true} />
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: 13,
                        lineHeight: 1.65,
                      }}
                    >
                      {highlight}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(63,63,70,0.6)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    minHeight: 48,
                    padding: "14px 18px",
                    borderRadius: 999,
                    border: plan.featured
                      ? "1px solid rgba(228,228,231,0.2)"
                      : "1px solid rgba(63,63,70,0.9)",
                    background: plan.featured ? "var(--accent)" : "transparent",
                    color: plan.featured ? "#09090b" : "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {plan.cta}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div
          className="hidden md:block"
          style={{
            borderRadius: 28,
            overflow: "hidden",
            border: "1px solid rgba(39,39,42,0.8)",
            background:
              "linear-gradient(180deg, rgba(39,39,42,0.24), rgba(24,24,27,0.12) 38%, rgba(9,9,11,0.96) 100%)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr repeat(3, minmax(0, 1fr))",
              borderBottom: "1px solid rgba(39,39,42,0.8)",
            }}
          >
            <div style={{ padding: "28px 24px" }}>
              <span className="mono-label">Paid access matrix</span>
              <p
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                  lineHeight: 1.7,
                  marginTop: 12,
                  maxWidth: 220,
                }}
              >
                Compare paid API access tiers by credits, model access, and
                simulation capacity.
              </p>
            </div>

            {PLANS.map((plan) => (
              <div
                key={plan.name}
                style={{
                  padding: "28px 24px",
                  borderLeft: "1px solid rgba(39,39,42,0.8)",
                  background: plan.featured
                    ? "linear-gradient(180deg, rgba(228,228,231,0.08), rgba(24,24,27,0.5) 52%, transparent 100%)"
                    : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <span className="mono-label">Plan</span>
                    <h3
                      style={{
                        fontSize: 26,
                        color: "var(--text-primary)",
                        marginTop: 14,
                      }}
                    >
                      {plan.name}
                    </h3>
                  </div>

                  {plan.featured ? (
                    <span
                      style={{
                        fontFamily: "var(--font-data)",
                        fontSize: 10,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#09090b",
                        background: "var(--accent)",
                        borderRadius: 999,
                        padding: "7px 10px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Most used
                    </span>
                  ) : null}
                </div>

                <div
                  className="tabular-nums"
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 32,
                    letterSpacing: "-0.04em",
                    color: "var(--text-primary)",
                    marginTop: 22,
                  }}
                >
                  {plan.price}
                </div>

                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.7,
                    marginTop: 12,
                  }}
                >
                  {plan.summary}
                </p>
              </div>
            ))}
          </div>

          {COMPARISON_ROWS.map((row, index) => (
            <div
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr repeat(3, minmax(0, 1fr))",
                borderTop: index === 0 ? "none" : "1px solid rgba(39,39,42,0.72)",
              }}
            >
              <div
                style={{
                  padding: "18px 24px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: 12,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  {row.label}
                </span>
              </div>

              {PLANS.map((plan) => (
                <div
                  key={`${row.label}-${plan.name}`}
                  style={{
                    padding: "18px 24px",
                    borderLeft: "1px solid rgba(39,39,42,0.72)",
                    display: "flex",
                    alignItems: "center",
                    minHeight: 68,
                    background:
                      plan.featured && typeof row.values[plan.name] !== "boolean"
                        ? "rgba(228,228,231,0.02)"
                        : "transparent",
                  }}
                >
                  {renderCell(row.values[plan.name])}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
