type Sentiment = "hostile" | "positive" | "noise";
type Reaction = { body: string; handle: string; sentiment: Sentiment };

const ROW_A: Reaction[] = [
  { body: "ratio + L + cope", handle: "@dril_lite", sentiment: "hostile" },
  { body: "actually shipping this is wild", handle: "@buildlogs", sentiment: "positive" },
  { body: "this didn't need to be a tweet", handle: "@editor", sentiment: "hostile" },
  { body: "ok but the copy slaps", handle: "@swipefile", sentiment: "positive" },
  { body: "deleting my account", handle: "@bigfeels", sentiment: "hostile" },
  { body: "based", handle: "@power_user", sentiment: "positive" },
  { body: "who asked", handle: "@reply_guy", sentiment: "hostile" },
  { body: "interesting", handle: "@noopinion", sentiment: "noise" },
  { body: "founder mode", handle: "@vc_anon", sentiment: "noise" },
  { body: "bro deleted his linkedin for this", handle: "@hr_panic", sentiment: "hostile" },
];

const ROW_B: Reaction[] = [
  { body: "this is so out of touch", handle: "@notgenz", sentiment: "hostile" },
  { body: "screenshotting for the group chat", handle: "@receipts", sentiment: "hostile" },
  { body: "finally", handle: "@quietquit", sentiment: "positive" },
  { body: "lol", handle: "@anon", sentiment: "noise" },
  { body: "ok PM", handle: "@designsense", sentiment: "hostile" },
  { body: "i'd subscribe to this", handle: "@churn_curve", sentiment: "positive" },
  { body: "huh", handle: "@noopinion", sentiment: "noise" },
  { body: "another rugpull tbh", handle: "@too_online", sentiment: "hostile" },
  { body: "shipping > posting", handle: "@founder", sentiment: "positive" },
  { body: "wen refund", handle: "@chargeback", sentiment: "hostile" },
];

function dotColor(s: Sentiment) {
  if (s === "hostile") return "var(--coral)";
  if (s === "positive") return "var(--mint)";
  return "var(--text-tertiary)";
}

function Chip({ r }: { r: Reaction }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        whiteSpace: "nowrap",
        fontSize: 13,
        color: "var(--text-primary)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: dotColor(r.sentiment),
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.04em",
          color: "var(--text-tertiary)",
        }}
      >
        {r.handle}
      </span>
      <span>{r.body}</span>
    </span>
  );
}

export default function SocialProofStrip() {
  const a = [...ROW_A, ...ROW_A];
  const b = [...ROW_B, ...ROW_B];
  return (
    <section
      aria-label="Sample reactions from simulated audiences"
      style={{
        padding: "28px 0",
        background: "var(--bg-subtle)",
        borderTop: "var(--border-hairline) solid var(--border)",
        borderBottom: "var(--border-hairline) solid var(--border)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div className="marquee-track" style={{ width: "max-content" }}>
        {a.map((r, i) => (
          <Chip key={`a-${i}`} r={r} />
        ))}
      </div>
      <div
        className="marquee-track marquee-track--reverse marquee-track--fast"
        style={{ width: "max-content" }}
      >
        {b.map((r, i) => (
          <Chip key={`b-${i}`} r={r} />
        ))}
      </div>
    </section>
  );
}
