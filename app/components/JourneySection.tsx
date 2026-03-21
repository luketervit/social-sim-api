import Link from "next/link";

const STEPS = [
  {
    id: "01",
    title: "Landing",
    body: "Lead with the free playground instead of forcing visitors into an API approval flow.",
  },
  {
    id: "02",
    title: "Sign Up",
    body: "Create the account instantly and unlock the daily playground quota behind the scenes.",
  },
  {
    id: "03",
    title: "Playground",
    body: "Run a simulation first, then learn the product from the output instead of from docs.",
  },
  {
    id: "04",
    title: "Share",
    body: "Publish the best run as a public report and let the link become the acquisition loop.",
  },
];

export default function JourneySection() {
  return (
    <section style={{ padding: "0 0 88px" }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div style={{ marginBottom: 28, maxWidth: 720 }}>
          <span className="mono-label">USER_JOURNEY :: SIGN_UP_TO_VIRAL_LOOP</span>
          <h2
            style={{
              fontSize: 36,
              color: "var(--text-primary)",
              marginTop: 12,
            }}
          >
            Product-Led Flow
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 15,
              lineHeight: 1.75,
              marginTop: 12,
            }}
          >
            Free users should not meet an approval queue before they understand the product. The
            API queue still exists, but it starts after the first successful simulation, not before.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {STEPS.map((step) => (
            <article key={step.id} className="panel" style={{ padding: 24 }}>
              <div className="mono-label">{step.id}</div>
              <h3
                style={{
                  marginTop: 16,
                  fontSize: 24,
                  color: "var(--text-primary)",
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  marginTop: 12,
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.7,
                }}
              >
                {step.body}
              </p>
            </article>
          ))}
        </div>

        <div className="panel mt-4 p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="mono-label">VIRAL_LOOP</div>
              <h3
                style={{
                  marginTop: 12,
                  fontSize: 28,
                  color: "var(--text-primary)",
                }}
              >
                The share page is the acquisition surface
              </h3>
              <p
                style={{
                  marginTop: 12,
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.75,
                  maxWidth: 720,
                }}
              >
                A good simulation should not die inside the dashboard. Public result pages turn each
                interesting run into distribution, proof, and the next user’s landing page.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/login?mode=signup" className="btn-primary">
                Start Free
              </Link>
              <Link href="/waitlist" className="btn-secondary">
                API Waitlist
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
