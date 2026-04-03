const STEPS = [
  {
    number: "01",
    title: "Input your message",
    description:
      "Paste your announcement, launch post, or internal message you want to pressure test with a real audience.",
    accentColor: "var(--accent)",
  },
  {
    number: "02",
    title: "Upload your audience",
    description:
      "Upload your customer data to create synthetic agents, or start with seeded archetypes like Tech Twitter or Angry Gamers.",
    accentColor: "var(--coral)",
  },
  {
    number: "03",
    title: "Watch them react",
    description:
      "See sentiment, aggression, virality, and the full discourse thread. Understand how your content lands before it ships.",
    accentColor: "var(--mint)",
  },
];

export default function HowItWorks() {
  return (
    <section style={{ padding: "96px 0" }}>
      <div className="mx-auto max-w-[1200px] px-6">
        <div style={{ marginBottom: 56, maxWidth: 520 }}>
          <span className="mono-label">How it works</span>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              marginTop: 14,
            }}
          >
            Three steps to real signal.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.number}
              className="panel"
              style={{
                padding: "36px 32px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data), monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: step.accentColor,
                  letterSpacing: "0.04em",
                }}
              >
                {step.number}
              </span>

              <h3
                style={{
                  fontSize: 22,
                  marginTop: 16,
                  fontFamily: "var(--font-display), Georgia, serif",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {step.title}
              </h3>

              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 15,
                  lineHeight: 1.7,
                  marginTop: 14,
                }}
              >
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
