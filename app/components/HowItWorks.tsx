type Step = {
  number: string;
  kicker: string;
  title: React.ReactNode;
  description: string;
  background: string;
  numberColor: string;
  align: "left" | "right";
  mock: React.ReactNode;
};

function MockMessage() {
  return (
    <div
      className="panel"
      style={{
        padding: "20px 22px",
        maxWidth: 360,
        transform: "rotate(-1.4deg)",
      }}
    >
      <span
        className="mono-label"
        style={{ fontSize: 10, color: "var(--text-tertiary)" }}
      >
        Draft
      </span>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 15,
          lineHeight: 1.5,
          color: "var(--text-primary)",
        }}
      >
        we&apos;re sunsetting the free tier next month — paid plans start at
        $19/mo.
      </p>
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px dashed var(--border)",
          display: "flex",
          gap: 10,
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        <span>140 chars</span>
        <span>·</span>
        <span>x.com</span>
      </div>
    </div>
  );
}

function MockAudience() {
  const rows = [
    { name: "Toxic Gamers", count: "1,200 agents" },
    { name: "Gen Z", count: "800 agents" },
    { name: "Engineers", count: "500 agents" },
    { name: "Finance Twitter", count: "320 agents" },
  ];
  return (
    <div
      className="panel"
      style={{
        padding: "16px 18px",
        maxWidth: 320,
        transform: "rotate(1.2deg)",
      }}
    >
      <span
        className="mono-label"
        style={{ fontSize: 10, color: "var(--text-tertiary)" }}
      >
        Audience
      </span>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => (
          <div
            key={r.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: 10,
              background: i === 0 ? "var(--accent-muted)" : "transparent",
              border: i === 0 ? "1px solid var(--accent)" : "1px solid var(--border)",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "var(--text-primary)",
                fontWeight: i === 0 ? 500 : 400,
              }}
            >
              {r.name}
            </span>
            <span
              style={{
                fontFamily: "var(--font-data), monospace",
                fontSize: 10,
                color: "var(--text-tertiary)",
                letterSpacing: "0.04em",
              }}
            >
              {r.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockReactions() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 340,
        transform: "rotate(-0.8deg)",
      }}
    >
      {[
        { who: "@reply_guy", text: "ratio incoming", color: "var(--coral)" },
        { who: "@power_user", text: "honestly fair", color: "var(--mint)" },
        { who: "@too_online", text: "and the support tickets begin", color: "var(--coral)" },
      ].map((c, i) => (
        <div
          key={i}
          className="panel"
          style={{
            padding: "10px 14px",
            transform: `rotate(${i % 2 ? 1 : -1}deg)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: c.color,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-data), monospace",
                fontSize: 10,
                color: "var(--text-tertiary)",
                letterSpacing: "0.04em",
              }}
            >
              {c.who}
            </span>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.text}</span>
        </div>
      ))}
    </div>
  );
}

const STEPS: Step[] = [
  {
    number: "01",
    kicker: "Step one",
    title: <>Drop in the post.</>,
    description:
      "Paste the launch tweet, the all-hands memo, the price-bump email — anything you'd normally throw into the void and hope.",
    background: "transparent",
    numberColor: "var(--accent)",
    align: "left",
    mock: <MockMessage />,
  },
  {
    number: "02",
    kicker: "Step two",
    title: <>Pick the room.</>,
    description:
      "Choose from seeded audiences (Toxic Gamers, Gen Z, Engineers, Finance Twitter, your own internal Slack) or upload customer data and we'll synthesize the agents.",
    background: "var(--butter)",
    numberColor: "var(--tomato)",
    align: "right",
    mock: <MockAudience />,
  },
  {
    number: "03",
    kicker: "Step three",
    title: <>Read the room before it reads you.</>,
    description:
      "Watch the simulated thread unfold: sentiment, aggression, virality, the whole receipts. Edit the post until the room actually wants what you're shipping.",
    background: "transparent",
    numberColor: "var(--mint)",
    align: "left",
    mock: <MockReactions />,
  },
];

export default function HowItWorks() {
  return (
    <div>
      <div className="mx-auto max-w-[1200px] px-6" style={{ paddingTop: 96, paddingBottom: 24 }}>
        <span className="mono-label">How it works</span>
        <h2
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            marginTop: 14,
            maxWidth: 14 + "ch",
          }}
        >
          Three steps. <span style={{ fontStyle: "italic", color: "var(--accent)" }}>No surprises.</span>
        </h2>
      </div>

      {STEPS.map((step) => {
        const isRight = step.align === "right";
        const isBanded = step.background !== "transparent";
        return (
          <section
            key={step.number}
            className={isBanded ? "color-band" : undefined}
            style={{
              background: step.background,
              padding: "clamp(72px, 10vh, 120px) 0",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="mx-auto max-w-[1200px] px-6" style={{ position: "relative" }}>
              {/* Oversized number bleeding off edge */}
              <span
                aria-hidden="true"
                className="editorial-number"
                style={{
                  position: "absolute",
                  top: "-12%",
                  [isRight ? "right" : "left"]: "-2%",
                  color: step.numberColor,
                  opacity: 0.12,
                }}
              >
                {step.number}
              </span>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  gap: 56,
                  alignItems: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    order: isRight ? 2 : 1,
                    maxWidth: 460,
                  }}
                >
                  <span
                    className="mono-label"
                    style={{ color: step.numberColor }}
                  >
                    {step.kicker} · {step.number}
                  </span>
                  <h3
                    style={{
                      fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
                      marginTop: 14,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.05,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      marginTop: 18,
                      fontSize: 17,
                      lineHeight: 1.65,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {step.description}
                  </p>
                </div>
                <div
                  style={{
                    order: isRight ? 1 : 2,
                    display: "flex",
                    justifyContent: isRight ? "flex-start" : "flex-end",
                  }}
                >
                  {step.mock}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
