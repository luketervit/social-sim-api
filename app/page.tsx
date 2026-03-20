import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="flex flex-col items-center pt-24 pb-20 text-center">
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px]"
          style={{
            color: "var(--accent-hover)",
            background: "var(--accent-muted)",
            fontWeight: "var(--font-weight-medium)" as unknown as number,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
          Now in private beta
        </div>

        <h1
          className="text-[48px] leading-[1.08] sm:text-[56px]"
          style={{
            fontWeight: "var(--font-weight-bold)" as unknown as number,
            letterSpacing: "-0.035em",
            color: "var(--text-primary)",
          }}
        >
          Simulations,
          <br />
          simplified.
        </h1>

        <p
          className="mt-5 max-w-[460px] text-[16px] leading-[1.6]"
          style={{ color: "var(--text-secondary)" }}
        >
          Predict social backlash before launch. Multi-agent discourse
          simulations powered by psychographic personas across every
          major platform.
        </p>

        <div className="mt-8 flex gap-3">
          <Link href="/login" className="btn-primary">
            Get Started
          </Link>
          <Link href="/docs" className="btn-secondary">
            Documentation
          </Link>
        </div>
      </section>

      {/* Terminal mock */}
      <section className="w-full max-w-[720px] pb-20">
        <div className="panel overflow-hidden">
          <div
            className="flex items-center gap-2 px-5 py-3"
            style={{
              borderBottom: "var(--border-hairline) solid var(--border)",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#ef4444",
                opacity: 0.8,
              }}
            />
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#eab308",
                opacity: 0.8,
              }}
            />
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#22c55e",
                opacity: 0.8,
              }}
            />
            <span
              className="ml-2 text-[12px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Terminal
            </span>
          </div>
          <div className="code-block" style={{ borderRadius: 0, padding: "20px 24px" }}>
            <pre className="whitespace-pre-wrap">
              <code>
                <span style={{ color: "var(--text-tertiary)" }}>$</span>{" "}
                <span style={{ color: "var(--gray-11)" }}>
                  curl -N -X POST http://localhost:3000/api/v1/simulate \
                </span>
                {"\n"}
                <span style={{ color: "var(--gray-11)" }}>
                  {"  "}-H &quot;x-api-key: ssim_your_key&quot; \
                </span>
                {"\n"}
                <span style={{ color: "var(--gray-11)" }}>
                  {"  "}-H &quot;Content-Type: application/json&quot; \
                </span>
                {"\n"}
                <span style={{ color: "var(--gray-11)" }}>
                  {"  "}-d {`'{"audience_id":"toxic_gamers","platform":"twitter",'`}
                </span>
                {"\n"}
                <span style={{ color: "var(--gray-11)" }}>
                  {"      "}{`'"input":"We are proud to announce NFTs!"}'`}
                </span>
                {"\n\n"}
                <span style={{ color: "var(--accent-hover)" }}>
                  {`{"round":1,"archetype":"The Chaos Troll"`}
                </span>
                {"\n"}
                <span style={{ color: "var(--accent-hover)" }}>
                  {` "message":"L + ratio + nobody asked for NFTs"`}
                </span>
                {"\n"}
                <span style={{ color: "var(--accent-hover)" }}>
                  {` "sentiment":"hostile"}`}
                </span>
                {"\n"}
                <span style={{ color: "var(--accent-hover)" }}>
                  {`{"round":2,"archetype":"The Hardcore Traditionalist"`}
                </span>
                {"\n"}
                <span style={{ color: "var(--accent-hover)" }}>
                  {` "message":"Another studio selling out..."`}
                </span>
                {"\n"}
                <span style={{ color: "var(--accent-hover)" }}>
                  {` "sentiment":"negative"}`}
                </span>
                {"\n"}
                <span style={{ color: "var(--text-tertiary)" }}>...</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="w-full max-w-[720px] pb-28">
        <div className="grid grid-cols-1 gap-px sm:grid-cols-3" style={{ background: "var(--border)" }}>
          <FeatureCard
            title="Agent DNA"
            description="150+ psychographic personas with reactivity baselines, brand affinity scores, and core value systems."
          />
          <FeatureCard
            title="Platform-aware"
            description="Twitter hostility, Slack passive-aggression, Reddit long-form takes. Each platform shapes the discourse."
          />
          <FeatureCard
            title="Streaming"
            description="NDJSON streaming delivers agent responses as they generate. Watch discourse unfold in real time."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6" style={{ background: "var(--bg-subtle)" }}>
      <h3
        className="text-[14px]"
        style={{
          fontWeight: "var(--font-weight-semibold)" as unknown as number,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-[13px] leading-[1.6]"
        style={{ color: "var(--text-secondary)" }}
      >
        {description}
      </p>
    </div>
  );
}
