import { readFileSync } from "fs";
import { join } from "path";
import ReactMarkdown from "react-markdown";

export default function DocsPage() {
  const agentsMd = readFileSync(join(process.cwd(), "AGENTS.md"), "utf-8");

  return (
    <div className="mx-auto max-w-[640px] pt-16 pb-24">
      <h1
        className="text-[28px]"
        style={{
          fontWeight: "var(--font-weight-bold)" as unknown as number,
          letterSpacing: "-0.03em",
        }}
      >
        Documentation
      </h1>
      <p
        className="mt-2 text-[14px] leading-[1.6]"
        style={{ color: "var(--text-secondary)" }}
      >
        Everything you need to integrate Atharias into your workflow.
      </p>

      {/* Quick start */}
      <section className="mt-12">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-semibold)" as unknown as number,
            letterSpacing: "-0.02em",
          }}
        >
          Quick Start
        </h2>

        <div className="mt-5 flex flex-col gap-6">
          <Step number={1} title="Get an API key">
            <div className="code-block">
              <pre>
                <code>{`POST /api/v1/keys
Content-Type: application/json

{ "email": "you@company.com" }

→ { "key": "ssim_...", "credits": 100 }`}</code>
              </pre>
            </div>
          </Step>

          <Step number={2} title="Run a simulation">
            <div className="code-block">
              <pre>
                <code>{`curl -N -X POST http://localhost:3000/api/v1/simulate \\
  -H "x-api-key: ssim_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "audience_id": "toxic_gamers",
    "platform": "twitter",
    "input": "We are proud to announce NFTs in our next game!"
  }'`}</code>
              </pre>
            </div>
          </Step>

          <Step number={3} title="Process the stream">
            <p
              className="text-[13px] leading-[1.6]"
              style={{ color: "var(--text-secondary)" }}
            >
              The response is streamed as NDJSON. Each line is a JSON object
              representing one agent&rsquo;s response. The final line contains an
              aggression score summary.
            </p>
          </Step>
        </div>
      </section>

      {/* Reference tables */}
      <section className="mt-14">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-semibold)" as unknown as number,
            letterSpacing: "-0.02em",
          }}
        >
          Reference
        </h2>

        <div className="mt-5 flex flex-col gap-6">
          <div className="panel overflow-hidden">
            <div
              className="px-4 py-2.5 text-[12px]"
              style={{
                fontWeight: "var(--font-weight-medium)" as unknown as number,
                color: "var(--text-tertiary)",
                borderBottom: "var(--border-hairline) solid var(--border)",
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
              }}
            >
              Audiences
            </div>
            <div className="flex flex-col">
              <RefRow code="toxic_gamers" label="Hardcore gaming community" />
              <RefRow code="genz" label="Gen Z social media users" />
              <RefRow code="engineers" label="Software engineering community" />
              <RefRow code="small_town" label="Small town community" />
              <RefRow code="company_internal" label="Corporate internal comms" />
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div
              className="px-4 py-2.5 text-[12px]"
              style={{
                fontWeight: "var(--font-weight-medium)" as unknown as number,
                color: "var(--text-tertiary)",
                borderBottom: "var(--border-hairline) solid var(--border)",
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
              }}
            >
              Platforms
            </div>
            <div className="flex flex-col">
              <RefRow code="twitter" label="Short-form, hostile, 280 char limit" />
              <RefRow code="slack" label="Corporate, passive-aggressive" />
              <RefRow code="reddit" label="Long-form, anonymous" />
            </div>
          </div>
        </div>
      </section>

      {/* AGENTS.md */}
      <section className="mt-14">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-semibold)" as unknown as number,
            letterSpacing: "-0.02em",
          }}
        >
          Architecture
        </h2>
        <div
          className="docs-prose mt-5 text-[14px] leading-[1.7]"
          style={{ color: "var(--text-secondary)" }}
        >
          <ReactMarkdown>{agentsMd}</ReactMarkdown>
        </div>
      </section>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] tabular-nums"
        style={{
          background: "var(--accent-muted)",
          color: "var(--accent-hover)",
          fontWeight: "var(--font-weight-semibold)" as unknown as number,
          marginTop: 2,
        }}
      >
        {number}
      </div>
      <div className="flex-1">
        <h3
          className="text-[14px]"
          style={{
            fontWeight: "var(--font-weight-medium)" as unknown as number,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function RefRow({ code, label }: { code: string; label: string }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{
        borderBottom: "var(--border-hairline) solid var(--border)",
      }}
    >
      <code
        className="rounded px-2 py-0.5 text-[12px]"
        style={{
          background: "var(--bg-element)",
          color: "var(--accent-hover)",
        }}
      >
        {code}
      </code>
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}
