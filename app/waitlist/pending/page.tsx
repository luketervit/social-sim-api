import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  ensureOperatorAccount,
  getOperatorAccountByUserId,
} from "@/lib/operator-accounts";

export const dynamic = "force-dynamic";

export default async function WaitlistPendingPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login?next=%2Fdashboard");
  }

  const account =
    (await getOperatorAccountByUserId(user.id)) ??
    (await ensureOperatorAccount(user.id, user.email));

  if (!account.waitlist) {
    redirect("/dashboard");
  }

  return (
    <section
      style={{
        background: "var(--bg)",
        padding: "clamp(64px, 9vh, 96px) 0 clamp(96px, 13vh, 160px)",
      }}
    >
      <div className="mx-auto px-6" style={{ maxWidth: 560 }}>
        <span className="mono-label">You&apos;re on the list</span>
        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            marginTop: 14,
          }}
        >
          We&apos;ll let you in{" "}
          <span style={{ fontStyle: "italic" }}>shortly.</span>
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: 16,
            lineHeight: 1.6,
            marginTop: 18,
          }}
        >
          <span
            style={{
              color: "var(--text-primary)",
              fontWeight: 500,
            }}
          >
            {user.email}
          </span>{" "}
          is on the list for early access. When your seat is ready, we&apos;ll
          email you a link to set a password — then you can upload any CSV of
          your audience and run simulations on it.
        </p>

        <div
          style={{
            marginTop: 28,
            padding: "20px 22px",
            background: "var(--bg-subtle)",
            borderRadius: 14,
            border: "1px solid var(--border)",
          }}
        >
          <span className="mono-label">In the meantime</span>
          <ul
            style={{
              marginTop: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 0,
              listStyle: "none",
            }}
          >
            {[
              "Try the public playground on the homepage",
              "Read how the simulation engine works in the docs",
              "Email luke@atharias.dev with the audience you want to simulate first",
            ].map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    marginTop: 7,
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "var(--butter-deep)",
                    flexShrink: 0,
                  }}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
