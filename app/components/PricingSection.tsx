import {
  PLAYGROUND_PERSONA_CAP,
  PLAYGROUND_RUNS_INCLUDED,
  SIMULATION_ROUNDS,
} from "@/lib/credits";

type Plan = {
  name: string;
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
    name: "Hobby",
    price: "$19/mo",
    credits: "50,000 credits",
    summary:
      "For the indie dev wiring Atharias into a side project. ~50 standard runs, capped at 100 agents per simulation.",
    cta: "Build with the API",
    highlights: [
      "First paid API tier",
      "~50 standard runs / month",
      "100 max agents per simulation",
    ],
    accentColor: "var(--accent)",
  },
  {
    name: "Studio",
    price: "$99/mo",
    credits: "500,000 credits",
    summary:
      "For product, research, comms, and strategy teams running this every week. Bigger rooms, faster queue, top-ups when you blow through.",
    featured: true,
    cta: "Start a Studio plan",
    highlights: [
      "~500 standard runs / month",
      "500 max agents per simulation",
      "Priority queue + credit top-ups",
    ],
    accentColor: "var(--tomato)",
  },
  {
    name: "Volume",
    price: "Talk to us",
    credits: "Custom volume",
    summary:
      "For teams putting Atharias inside their own product. Dedicated workers, custom limits, real SLA, a contract a procurement team will sign.",
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
        padding: "clamp(96px, 13vh, 160px) 0 clamp(96px, 13vh, 160px)",
        background:
          "linear-gradient(180deg, transparent 0%, rgba(52, 211, 153, 0.025) 100%)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div style={{ marginBottom: 56, maxWidth: 600 }}>
          <span className="mono-label">Pricing</span>
          <h2
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              marginTop: 14,
              maxWidth: 18 + "ch",
            }}
          >
            Free until you&apos;re{" "}
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
              actually using it.
            </span>
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 17,
              marginTop: 16,
              lineHeight: 1.65,
              maxWidth: 560,
            }}
          >
            The playground is on the house. Pay when you need API keys, bigger
            rooms, or production throughput — not before.
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
                    fontSize: 24,
                    fontFamily: "var(--font-display), Georgia, serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Playground
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
                  Free forever
                </span>
              </div>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 15,
                  lineHeight: 1.65,
                  marginTop: 10,
                  maxWidth: 600,
                }}
              >
                {PLAYGROUND_RUNS_INCLUDED} runs a day, up to{" "}
                {PLAYGROUND_PERSONA_CAP} agents across {SIMULATION_ROUNDS}{" "}
                rounds. No card, no API key. Open the playground and post
                something dangerous.
              </p>
            </div>
            <div>
              <a href="/login?mode=signup" className="btn-primary">
                Open the playground
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
                border: plan.featured
                  ? `1px solid var(--tomato)`
                  : "1px solid var(--border)",
                background: plan.featured
                  ? "linear-gradient(180deg, rgba(232, 93, 78, 0.05), var(--surface) 25%)"
                  : "var(--surface)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {plan.featured ? (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: "var(--tomato)",
                  }}
                />
              ) : null}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <span
                  className="mono-label"
                  style={{
                    color: plan.featured ? "var(--tomato)" : "var(--text-tertiary)",
                  }}
                >
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
                      background: "var(--tomato)",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontWeight: 600,
                    }}
                  >
                    Most teams
                  </span>
                ) : null}
              </div>

              <div
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 40,
                  letterSpacing: "-0.03em",
                  color: "var(--text-primary)",
                  marginTop: 18,
                  lineHeight: 1.05,
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
                  lineHeight: 1.65,
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
                    background: plan.featured ? "var(--tomato)" : undefined,
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
