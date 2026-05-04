type Trait = { label: string; value: number };

type Audience = {
  name: string;
  tagline: string;
  badge: string;
  meanQuote: string;
  niceQuote: string;
  traits: Trait[];
  gradient: string;
  accent: string;
  rotate: number;
};

const AUDIENCES: Audience[] = [
  {
    name: "Toxic Gamers",
    tagline: "Will ratio you for breakfast",
    badge: "Hostile · High volume",
    meanQuote: "you're cooked. uninstalling.",
    niceQuote: "ok actually that's a W patch",
    traits: [
      { label: "Hostility", value: 0.92 },
      { label: "Reactivity", value: 0.88 },
      { label: "Virality", value: 0.74 },
    ],
    gradient: "linear-gradient(135deg, #F97066 0%, #7C5CFC 100%)",
    accent: "var(--coral)",
    rotate: -1.4,
  },
  {
    name: "Gen Z",
    tagline: "Irony-poisoned. Brand-allergic.",
    badge: "Sarcastic · Trend-aware",
    meanQuote: "this is so corporate. delete.",
    niceQuote: "ok this is actually slay",
    traits: [
      { label: "Irony", value: 0.89 },
      { label: "Trend-aware", value: 0.85 },
      { label: "Loyalty", value: 0.32 },
    ],
    gradient: "linear-gradient(135deg, #34D399 0%, #F5E6B8 100%)",
    accent: "var(--mint)",
    rotate: 1.1,
  },
  {
    name: "Engineers",
    tagline: "Reads the docs. Files bug reports.",
    badge: "Skeptical · Detail-oriented",
    meanQuote: "is this just a wrapper around openai",
    niceQuote: "the API ergonomics are clean tho",
    traits: [
      { label: "Skepticism", value: 0.83 },
      { label: "Sophistication", value: 0.91 },
      { label: "Loyalty", value: 0.66 },
    ],
    gradient: "linear-gradient(135deg, #7C5CFC 0%, #34D399 100%)",
    accent: "var(--accent)",
    rotate: -0.6,
  },
  {
    name: "Finance Twitter",
    tagline: "Number goes up or it's cope.",
    badge: "Mercenary · Status-driven",
    meanQuote: "bear case writes itself",
    niceQuote: "valuation makes sense at this ARR",
    traits: [
      { label: "Status", value: 0.87 },
      { label: "Reactivity", value: 0.75 },
      { label: "Hostility", value: 0.68 },
    ],
    gradient: "linear-gradient(135deg, #E85D4E 0%, #F5E6B8 100%)",
    accent: "var(--tomato)",
    rotate: 1.6,
  },
  {
    name: "Company Internal",
    tagline: "Reads between the lines for layoffs.",
    badge: "Anxious · Slack-fluent",
    meanQuote: "is this a soft layoff announcement",
    niceQuote: "appreciate the transparency",
    traits: [
      { label: "Anxiety", value: 0.78 },
      { label: "Loyalty", value: 0.71 },
      { label: "Reactivity", value: 0.62 },
    ],
    gradient: "linear-gradient(135deg, #6B6B6B 0%, #7C5CFC 100%)",
    accent: "var(--text-secondary)",
    rotate: -1.2,
  },
];

function TraitBar({ t, accent }: { t: Trait; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        <span>{t.label}</span>
        <span className="tabular-nums">{Math.round(t.value * 100)}</span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: "var(--bg-subtle)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${t.value * 100}%`,
            height: "100%",
            background: accent,
          }}
        />
      </div>
    </div>
  );
}

function Card({ a }: { a: Audience }) {
  return (
    <article
      className="panel"
      style={{
        flex: "0 0 auto",
        width: 300,
        padding: "0 0 22px",
        display: "flex",
        flexDirection: "column",
        transform: `rotate(${a.rotate}deg)`,
        scrollSnapAlign: "center",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          height: 110,
          background: a.gradient,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 16,
            bottom: 12,
            fontFamily: "var(--font-data), monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "white",
            opacity: 0.85,
          }}
        >
          {a.badge}
        </span>
      </div>

      <div style={{ padding: "20px 22px 0" }}>
        <h3
          style={{
            fontSize: 24,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          {a.name}
        </h3>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {a.tagline}
        </p>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--coral-muted)",
              borderLeft: "3px solid var(--coral)",
              fontSize: 13,
              color: "var(--text-primary)",
              lineHeight: 1.4,
            }}
          >
            &ldquo;{a.meanQuote}&rdquo;
          </div>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--mint-muted)",
              borderLeft: "3px solid var(--mint)",
              fontSize: 13,
              color: "var(--text-primary)",
              lineHeight: 1.4,
            }}
          >
            &ldquo;{a.niceQuote}&rdquo;
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {a.traits.map((t) => (
            <TraitBar key={t.label} t={t} accent={a.accent} />
          ))}
        </div>
      </div>
    </article>
  );
}

export default function Audiences() {
  return (
    <section
      style={{
        padding: "clamp(96px, 13vh, 160px) 0 clamp(72px, 10vh, 120px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6" style={{ marginBottom: 48 }}>
        <span className="mono-label">The cast</span>
        <h2
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            marginTop: 14,
            maxWidth: 18 + "ch",
          }}
        >
          Five audiences who&apos;ll
          <br />
          tell you the truth{" "}
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>before launch.</span>
        </h2>
        <p
          style={{
            marginTop: 16,
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            maxWidth: 540,
          }}
        >
          Each audience is a population of synthetic agents with their own
          psychographic DNA — argumentative, anxious, terminally online, or all
          three. Bring your own data to clone a real community.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          padding: "16px 24px 40px",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ flex: "0 0 max(0px, calc((100vw - 1200px) / 2))" }} />
        {AUDIENCES.map((a) => (
          <Card key={a.name} a={a} />
        ))}
        <div style={{ flex: "0 0 max(24px, calc((100vw - 1200px) / 2))" }} />
      </div>
    </section>
  );
}
