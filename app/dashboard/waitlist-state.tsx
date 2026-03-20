import SignOutButton from "@/app/components/SignOutButton";

function formatJoinedDate(joinedAt: string | null) {
  if (!joinedAt) {
    return "Recently";
  }

  return new Date(joinedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WaitlistState({
  email,
  joinedAt,
}: {
  email: string;
  joinedAt: string | null;
}) {
  return (
    <div className="mx-auto max-w-[640px] pt-16 pb-24 px-6">
      <div className="panel" style={{ padding: 32 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="mono-label">CLOSED_BETA</div>
            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 3rem)",
                marginTop: 16,
                color: "var(--text-primary)",
              }}
            >
              Access pending
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: 15,
                lineHeight: 1.75,
                marginTop: 16,
                maxWidth: 520,
              }}
            >
              Atharias is currently running as a closed beta. Your account has
              been created, but dashboard access stays locked until your access
              request is approved.
            </p>
          </div>
          <SignOutButton style={{ padding: "10px 16px", minHeight: "auto" }} />
        </div>

        <div
          className="section-shell"
          style={{
            marginTop: 28,
            padding: 24,
            background:
              "linear-gradient(180deg, rgba(39, 39, 42, 0.22), rgba(24, 24, 27, 0.08) 48%, transparent 100%)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div>
              <div className="mono-label">Email</div>
              <div style={{ color: "var(--text-primary)", marginTop: 10 }}>
                {email}
              </div>
            </div>
            <div>
              <div className="mono-label">Requested access</div>
              <div
                className="tabular-nums"
                style={{ color: "var(--text-primary)", marginTop: 10 }}
              >
                {formatJoinedDate(joinedAt)}
              </div>
            </div>
            <div>
              <div className="mono-label">Status</div>
              <div style={{ color: "var(--text-primary)", marginTop: 10 }}>
                Pending approval
              </div>
            </div>
          </div>
        </div>

        <p
          style={{
            color: "var(--text-tertiary)",
            fontSize: 13,
            lineHeight: 1.7,
            marginTop: 18,
          }}
        >
          Once your access is approved, sign back in with the same email and
          password. Your dashboard and API key will unlock automatically.
        </p>
      </div>
    </div>
  );
}
