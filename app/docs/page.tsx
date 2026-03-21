const BASE_URL = "https://social-sim-api.vercel.app";

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-[760px] pt-16 pb-24">
      <h1
        className="text-[28px]"
        style={{
          fontWeight: "var(--font-weight-medium)" as unknown as number,
          letterSpacing: "-0.03em",
        }}
      >
        Atharias API Docs
      </h1>
      <p
        className="mt-2 text-[14px] leading-[1.6]"
        style={{ color: "var(--text-secondary)" }}
      >
        Use Atharias to run audience simulations, monitor queued jobs, and
        integrate backlash forecasting into internal workflows or product
        features.
      </p>

      <section className="mt-12">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-medium)" as unknown as number,
            letterSpacing: "-0.03em",
          }}
        >
          Quick Start
        </h2>

        <div className="mt-5 flex flex-col gap-6">
          <Step number={1} title="Create an account and get approved">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              Sign in, or request access from the waitlist if your account has not
              been approved yet. Once approved, open the dashboard to create your
              first API key.
            </p>
          </Step>

          <Step number={2} title="Create or list API keys">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              API key management uses your authenticated browser session. These
              routes are for the dashboard or your own internal tools.
            </p>
            <div className="code-block mt-3">
              <pre>
                <code>{`curl -X GET "${BASE_URL}/api/v1/keys" \\
  -H "Cookie: your_session_cookie"

→ {
  "keys": [
    {
      "key": "ssim_...",
      "email": "you@company.com",
      "credits": 7500,
      "total_tokens_used": 0,
      "created_at": "..."
    }
  ]
}`}</code>
              </pre>
            </div>
          </Step>

          <Step number={3} title="Queue a simulation">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              Simulations are queued immediately and processed asynchronously.
              Send your API key in `x-api-key`.
            </p>
            <div className="code-block mt-3">
              <pre>
                <code>{`curl -X POST "${BASE_URL}/api/v1/simulate" \\
  -H "x-api-key: ssim_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "audience_id": "toxic_gamers",
    "platform": "twitter",
    "input": "We are proud to announce NFTs in our next game."
  }'

→ {
  "simulation_id": "uuid",
  "status": "queued",
  "expected_messages": 1000,
  "simulation_rounds": 10,
  "reserved_credits": 1000,
  "progress_messages": 0,
  "poll_url": "/api/v1/simulate?id=uuid"
}`}</code>
              </pre>
            </div>
          </Step>

          <Step number={4} title="Poll job status">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              Use the returned `simulation_id` to track progress. Completed and
              failed jobs include the final thread.
            </p>
            <div className="code-block mt-3">
              <pre>
                <code>{`curl "${BASE_URL}/api/v1/simulate?id=uuid" \\
  -H "x-api-key: ssim_your_key_here"

→ {
  "simulation_id": "uuid",
  "status": "running",
  "progress_messages": 123,
  "expected_messages": 1000,
  "simulation_rounds": 10
}`}</code>
              </pre>
            </div>
          </Step>
        </div>
      </section>

      <section className="mt-14">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-medium)" as unknown as number,
            letterSpacing: "-0.03em",
          }}
        >
          How Atharias Works
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          <div className="panel p-4">
            <div className="mono-label">1. Seeded Developer Audiences</div>
            <p className="mt-2 text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              In developer mode, Atharias includes prebuilt test audiences such
              as `toxic_gamers`, `genz`, and `engineers`. These are seeded
              benchmark audiences so you can test the API immediately without
              uploading your own data.
            </p>
          </div>

          <div className="panel p-4">
            <div className="mono-label">2. Real Data Becomes Many Agents</div>
            <p className="mt-2 text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              In production, the goal is not to upload one user and call that
              the audience. The goal is to take real customer or segment data
              and turn it into many synthetic agents with different
              psychographic traits, loyalties, hostility thresholds, and
              reaction styles.
            </p>
          </div>

          <div className="panel p-4">
            <div className="mono-label">3. Simulations Need Many Voices</div>
            <p className="mt-2 text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              The point of generating 100 or more agents is to model spread,
              disagreement, escalation, and clustering. A single example user
              cannot tell you whether a reaction stays isolated, gets corrected,
              or turns into a broader backlash.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-medium)" as unknown as number,
            letterSpacing: "-0.03em",
          }}
        >
          Endpoints
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          <EndpointCard
            method="GET"
            path="/api/v1/keys"
            detail="List API keys for the signed-in user. Requires a valid browser session."
          />
          <EndpointCard
            method="POST"
            path="/api/v1/keys"
            detail="Create a new API key for the signed-in user. Requires approval and a valid browser session."
          />
          <EndpointCard
            method="DELETE"
            path="/api/v1/keys"
            detail="Delete one API key belonging to the signed-in user."
          />
          <EndpointCard
            method="POST"
            path="/api/v1/simulate"
            detail="Queue a new simulation job using `x-api-key`."
          />
          <EndpointCard
            method="GET"
            path="/api/v1/simulate?id=..."
            detail="Fetch status, progress, and final output for a queued job using `x-api-key`."
          />
        </div>
      </section>

      <section className="mt-14">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-medium)" as unknown as number,
            letterSpacing: "-0.03em",
          }}
        >
          Request Format
        </h2>

        <div className="panel mt-5 overflow-hidden">
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
            POST /api/v1/simulate
          </div>
          <div className="code-block rounded-none border-0">
            <pre>
              <code>{`{
  "audience_id": "toxic_gamers",
  "platform": "twitter",
  "input": "We are proud to announce NFTs in our next game."
}`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-medium)" as unknown as number,
            letterSpacing: "-0.03em",
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
              <RefRow code="genz" label="Gen Z social users" />
              <RefRow code="engineers" label="Software engineering community" />
              <RefRow code="small_town" label="Small-town community sentiment" />
              <RefRow code="company_internal" label="Internal workplace discussion" />
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
              <RefRow code="twitter" label="Short-form, hostile, high-velocity discussion" />
              <RefRow code="slack" label="Workplace tone, passive-aggressive discussion" />
              <RefRow code="reddit" label="Longer-form anonymous discussion" />
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
              Job statuses
            </div>
            <div className="flex flex-col">
              <RefRow code="queued" label="Accepted and waiting for worker capacity" />
              <RefRow code="running" label="Currently generating simulation messages" />
              <RefRow code="completed" label="Finished successfully with a final thread" />
              <RefRow code="failed" label="Stopped early and may include refunded credits" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <h2
          className="text-[18px]"
          style={{
            fontWeight: "var(--font-weight-medium)" as unknown as number,
            letterSpacing: "-0.03em",
          }}
        >
          Common Errors
        </h2>

        <div className="mt-5 flex flex-col gap-4">
          <ErrorCard
            code="401 Unauthorized"
            detail="Your browser session is missing for `/api/v1/keys`, or your `x-api-key` header is missing for `/api/v1/simulate`."
          />
          <ErrorCard
            code="403 Closed beta access is still pending approval"
            detail="Your account exists, but it is still on the waitlist."
          />
          <ErrorCard
            code="404 Audience not found"
            detail="The provided `audience_id` does not match one of the seeded audiences."
          />
          <ErrorCard
            code="400 Validation failed"
            detail="The request body is missing required fields or includes invalid values."
          />
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

function EndpointCard({ method, path, detail }: { method: string; path: string; detail: string }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-3">
        <code
          className="rounded px-2 py-0.5 text-[12px]"
          style={{ background: "var(--bg-element)", color: "var(--accent-hover)" }}
        >
          {method}
        </code>
        <code className="text-[13px]" style={{ color: "var(--text-primary)" }}>
          {path}
        </code>
      </div>
      <p className="mt-2 text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
    </div>
  );
}

function ErrorCard({ code, detail }: { code: string; detail: string }) {
  return (
    <div className="panel p-4">
      <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
        {code}
      </div>
      <p className="mt-2 text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
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
