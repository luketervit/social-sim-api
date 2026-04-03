const ITEMS = [
  "42,000+ simulations run",
  "12,480 audience archetypes",
  "100+ agent simulations",
  "Multi-platform discourse",
  "Psychographic personas",
  "Real-time sentiment analysis",
];

export default function SocialProofStrip() {
  // Double items for seamless loop
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <section
      style={{
        padding: "20px 0",
        background: "var(--bg-subtle)",
        borderTop: "var(--border-hairline) solid var(--border)",
        borderBottom: "var(--border-hairline) solid var(--border)",
        overflow: "hidden",
      }}
    >
      <div className="marquee-track" style={{ width: "max-content" }}>
        {doubled.map((item, i) => (
          <span
            key={i}
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 48,
            }}
          >
            <span>{item}</span>
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--accent)",
                opacity: 0.4,
                flexShrink: 0,
              }}
            />
          </span>
        ))}
      </div>
    </section>
  );
}
