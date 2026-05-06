import Link from "next/link";
import { CURRENT_CONSENT_VERSION } from "@/lib/operator-accounts";
import DeleteAccountButton from "./DeleteAccountButton";

export const metadata = {
  title: "Privacy — Atharias",
  description: "How Atharias handles your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[760px] pt-16 pb-24 px-6">
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          textDecoration: "none",
        }}
      >
        ← Atharias
      </Link>

      <h1
        className="mt-4 text-[32px]"
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          letterSpacing: "-0.035em",
          lineHeight: 1.05,
        }}
      >
        Privacy
      </h1>

      <p
        className="mt-3 text-[14px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Version {CURRENT_CONSENT_VERSION}. Plain-English explanation of how
        Atharias handles data during the private beta.
      </p>

      <Section title="What we collect">
        <p>
          <strong>From you (the operator):</strong> email address, password
          hash, account-level activity (sims you run, audiences you create,
          consents you accepted with timestamps).
        </p>
        <p>
          <strong>From your uploaded data:</strong> when you upload a LinkedIn
          export, we parse it on the server. We extract role/title information
          per row to derive an anonymized persona archetype. Role text is
          run through a strip step that removes the company name and any
          parenthetical identifiers before storage.
        </p>
        <p>
          <strong>From your connections (third parties):</strong> we read
          their role and title fields only. We do <strong>not</strong> persist
          their names, email addresses, or company identifiers on derived
          personas. We do <strong>not</strong> store the message content from
          messages they sent you. If your export includes a connection&rsquo;s
          URL we hash it with a per-application secret salt, store only the
          hash, and use it to deduplicate the same connection across multiple
          users&rsquo; uploads. The original URL is discarded.
        </p>
      </Section>

      <Section title="What we don’t collect or do">
        <ul>
          <li>We never message your connections.</li>
          <li>We never sell identifiable personal data.</li>
          <li>
            We never store the bodies of messages your connections sent. (Your
            own outgoing messages may be analyzed to infer your voice; this
            is opt-in and clearly labeled when offered.)
          </li>
          <li>
            We never attempt to re-identify a connection inside the simulator.
            All agents in your simulator are referred to by archetype, never
            by real name.
          </li>
        </ul>
      </Section>

      <Section title="How we use your data">
        <p>
          <strong>For your account:</strong> to power your simulations, your
          dashboard, and to send you product/transactional emails (e.g.
          &ldquo;your audience finished processing&rdquo;).
        </p>
        <p>
          <strong>For aggregate insights:</strong> de-identified, aggregated
          patterns across all users&rsquo; data may be used to improve the
          shared model and may be licensed to research partners. Aggregates
          are subject to a minimum group size threshold so individual users
          cannot be back-derived.
        </p>
        <p>
          We never use your data to train external general-purpose AI models
          without an additional explicit, separately-checked consent.
        </p>
      </Section>

      <Section title="Sub-processors">
        <ul>
          <li>
            <strong>Supabase</strong> — auth, application database, file
            storage.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting, function execution.
          </li>
          <li>
            <strong>OpenRouter / model providers</strong> — used to run the
            agent generation models. Inputs sent to providers are anonymized
            persona prompts; we never include your connections&rsquo; raw
            names, emails, or message content in any model call.
          </li>
        </ul>
      </Section>

      <Section title="Retention">
        <p>
          Your account, audiences, and personas persist for as long as your
          account is active. If you request deletion (below), we delete your
          account, your audiences, your personas, and your simulations within
          30 days, and propagate the deletion to backups within the next
          rolling backup cycle.
        </p>
        <p>
          Aggregated statistics derived prior to your deletion request may
          persist — they are not traceable to you individually.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You have the right to access the data we hold about you, correct it,
          export it, and delete it. In the EU/UK you also have the right to
          object to certain processing and to lodge a complaint with your
          local data protection authority.
        </p>
        <p>
          For any of these requests email{" "}
          <a href="mailto:luke@atharias.dev">luke@atharias.dev</a> and we will
          action it within 30 days.
        </p>
      </Section>

      <Section title="Delete my data" id="delete">
        <p>
          You can request deletion at any time. This will mark your account
          for deletion, immediately revoke access, and delete your audiences,
          personas, and simulations within 30 days.
        </p>
        <DeleteAccountButton />
      </Section>

      <Section title="Contact">
        <p>
          Privacy questions:{" "}
          <a href="mailto:luke@atharias.dev">luke@atharias.dev</a>.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10" id={id}>
      <h2
        className="text-[18px]"
        style={{
          fontWeight: "var(--font-weight-medium)" as unknown as number,
          letterSpacing: "-0.025em",
        }}
      >
        {title}
      </h2>
      <div
        className="mt-3 flex flex-col gap-4 text-[14px] leading-[1.65]"
        style={{ color: "var(--text-secondary)" }}
      >
        {children}
      </div>
    </section>
  );
}
