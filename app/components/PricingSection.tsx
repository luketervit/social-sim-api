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
  accentColor: string;
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
    accentColor: "var(--accent)",
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
    accentColor: "var(--coral)",
  },
  {
    name: "Enterprise",
    price: "Contact",
    credits: "Custom volume",
    summary:
      "For teams embedding Atharias into their own product, serving end users, and needing higher-volume infrastructure.",
    cta: "Talk to sales",
    highlights: [
      "Customer-facing integration",
      "Dedicated worker capacity",
      "Custom limits, support, and SLA",
    ],
    accentColor: "var(--mint)",
  },
];

export default function PricingSection() {
  return (
    <section
      style={{
        padding: "96px 0 120px",
        background: "linear-gradient(180deg, transparent 0%, rgba(52, 211, 153, 0.02) 100%)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div style={{ marginBottom: 56, maxWidth: 560 }}>
          <span className="mono-label">Pricing</span>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              marginTop: 14,
            }}
          >
            Start free, scale with usage.
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 16,
              marginTop: 14,
              lineHeight: 1.7,
            }}
          >
            The playground is free. Paid pricing starts when you need API keys, larger simulations,
            and production-grade throughput.
          </p>
        </div>

        {/* Free tier callout */}
        <div
          className="panel"
          style={{
            padding: "32px 36px",
            marginBottom: 20,
            border: "1px solid var(--border)",
          }}
        >
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <h3
                  style={{
                    fontSize: 22,
                    fontFamily: "var(--font-display), Georgia, serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Free Playground
                </h3>
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--mint)",
                    background: "var(--mint-muted)",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontWeight: 600,
                  }}
                >
                  Free
                </span>
              </div>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 15,
                  lineHeight: 1.7,
                  marginTop: 10,
                  maxWidth: 600,
                }}
              >
                {PLAYGROUND_RUNS_INCLUDED} sandbox runs per day, up to {PLAYGROUND_PERSONA_CAP} agents
                across {SIMULATION_ROUNDS} rounds.
              </p>
            </div>
            <div>
              <a href="/login?mode=signup" className="btn-primary">
                Get started free
              </a>
            </div>
          </div>
        </div>

        {/* Paid tiers */}
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className="panel"
              style={{
                padding: "36px 32px",
                border: plan.featured ? `1px solid var(--accent)` : "1px solid var(--border)",
                background: plan.featured
                  ? "linear-gradient(180deg, rgba(124, 92, 252, 0.03), var(--surface) 20%)"
                  : "var(--surface)",
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
                <span className="mono-label" style={{ color: "var(--text-tertiary)" }}>
                  {plan.name}
                </span>

                {plan.featured ? (
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "white",
                      background: "var(--accent)",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontWeight: 600,
                    }}
                  >
                    Popular
                  </span>
                ) : null}
              </div>

              <div
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 36,
                  letterSpacing: "-0.03em",
                  color: "var(--text-primary)",
                  marginTop: 20,
                }}
              >
                {plan.price}
              </div>

              <div
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 13,
                  color: "var(--text-tertiary)",
                  marginTop: 6,
                  letterSpacing: "0.02em",
                }}
              >
                {plan.credits}
              </div>

              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border)",
                }}
              >
                {plan.summary}
              </p>

              <div
                style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {plan.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        color: plan.accentColor,
                        fontSize: 14,
                        lineHeight: "20px",
                        flexShrink: 0,
                      }}
                    >
                      +
                    </span>
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      {highlight}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 28 }}>
                <span
                  className={plan.featured ? "btn-primary" : "btn-secondary"}
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  {plan.cta}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
