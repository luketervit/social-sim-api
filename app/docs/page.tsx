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
        Use Atharias to upload an audience, run private simulations, and review
        the resulting reaction thread before you ship the real message.
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
          <Step number={1} title="Sign in and clear the beta gate">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              Atharias currently runs through an authenticated browser session,
              not a public API key flow. Join the waitlist, sign in once
              approved, and use the dashboard or your own internal tooling with
              that session cookie.
            </p>
          </Step>

          <Step number={2} title="Upload an audience">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              Upload CSV, JSON, NDJSON, or a LinkedIn export ZIP. Atharias
              creates a processing audience immediately, then synthesizes
              personas in the background.
            </p>
            <div className="code-block mt-3">
              <pre>
                <code>{`curl -X POST "${BASE_URL}/api/v1/audiences" \\
  -H "Cookie: your_session_cookie" \\
  -F "platform=twitter" \\
  -F "name=Beta Testers" \\
  -F "file=@./audience.csv"

→ {
  "audience_id": "uuid",
  "name": "Beta Testers",
  "platform": "twitter",
  "status": "processing",
  "row_count": 184,
  "total_rows_in_file": 184,
  "truncated": false,
  "text_column": "bio"
}`}</code>
              </pre>
            </div>
          </Step>

          <Step number={3} title="Queue a simulation">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              Simulations are queued immediately and processed asynchronously.
              This route uses your authenticated session and an audience that
              belongs to the signed-in user.
            </p>
            <div className="code-block mt-3">
              <pre>
                <code>{`curl -X POST "${BASE_URL}/api/v1/simulate" \\
  -H "Cookie: your_session_cookie" \\
  -H "Content-Type: application/json" \\
  -d '{
    "audienceId": "uuid-from-upload",
    "platform": "twitter",
    "input": "We are sunsetting the free tier next month.",
    "personaCap": 25
  }'

→ {
  "simulationId": "uuid",
  "status": "queued",
  "personaCap": 25,
  "reservedCredits": 250
}`}</code>
              </pre>
            </div>
          </Step>

          <Step number={4} title="Poll job status">
            <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
              Use the returned `simulationId` to track progress. Completed and
              failed jobs include the final thread.
            </p>
            <div className="code-block mt-3">
              <pre>
                <code>{`curl "${BASE_URL}/api/v1/simulate/uuid/status" \\
  -H "Cookie: your_session_cookie"

→ {
  "id": "uuid",
  "status": "running",
  "platform": "twitter",
  "input": "We are sunsetting the free tier next month.",
  "progressMessages": 123,
  "thread": [],
  "aggressionScore": null
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
            <div className="mono-label">1. Your Upload Becomes an Audience</div>
            <p className="mt-2 text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              The current product flow is user-owned audiences. Upload your own
              CSV, JSON, NDJSON, or LinkedIn export and Atharias stores it
              under your account before persona synthesis begins.
            </p>
          </div>

          <div className="panel p-4">
            <div className="mono-label">2. Real Data Becomes Many Agents</div>
            <p className="mt-2 text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              In production, the goal is not to upload one user and call that
              the audience. The goal is to take real customer or segment data
              and turn it into many synthetic agents with different
              psychographic traits, loyalties, conviction levels, and
              reaction styles.
            </p>
          </div>

          <div className="panel p-4">
            <div className="mono-label">3. Simulations Need Many Voices</div>
            <p className="mt-2 text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              The point of generating 100 or more agents is to model spread,
              diversity, momentum, and clustering. A single example user
              cannot tell you whether an idea gains traction, gets challenged,
              or evolves into a broader consensus.
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
            method="POST"
            path="/api/v1/audiences"
            detail="Upload a new audience with a multipart form and queue persona synthesis."
          />
          <EndpointCard
            method="GET"
            path="/api/v1/audiences"
            detail="List audiences belonging to the signed-in user."
          />
          <EndpointCard
            method="GET"
            path="/api/v1/audiences/[id]"
            detail="Fetch audience status, metadata, and preview personas for one audience."
          />
          <EndpointCard
            method="POST"
            path="/api/v1/simulate"
            detail="Queue a new simulation job using your authenticated browser session."
          />
          <EndpointCard
            method="GET"
            path="/api/v1/simulate/[id]/status"
            detail="Fetch status, progress, and final output for one queued simulation."
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
  "audienceId": "uuid-from-upload",
  "platform": "twitter",
  "input": "We are sunsetting the free tier next month.",
  "personaCap": 25
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
              <RefRow code="owner_user_id" label="Every audience is scoped to one signed-in user" />
              <RefRow code="status=processing" label="Upload accepted and persona synthesis is still running" />
              <RefRow code="status=ready" label="Audience is ready for simulations" />
              <RefRow code="status=failed" label="Upload or synthesis failed and includes an error message" />
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
              <RefRow code="twitter" label="Short-form, high-velocity discussion" />
              <RefRow code="slack" label="Workplace tone, internal team discussion" />
              <RefRow code="reddit" label="Longer-form anonymous discussion" />
              <RefRow code="linkedin" label="Professional reputation and network-sensitive discussion" />
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
              <RefRow code="failed" label="Stopped early and includes an error message when available" />
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
            detail="Your browser session is missing or expired."
          />
          <ErrorCard
            code="403 Forbidden"
            detail="Your account is still on the waitlist, lacks current consent, or is queued for deletion."
          />
          <ErrorCard
            code="404 Not Found"
            detail="The requested audience or simulation does not belong to the signed-in user."
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
          background: "var(--butter-deep)",
          color: "var(--ink)",
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
          style={{ background: "var(--ink)", color: "var(--butter-deep)" }}
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
          background: "var(--ink)",
          color: "var(--butter-deep)",
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
