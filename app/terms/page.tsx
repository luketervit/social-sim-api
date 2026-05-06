import Link from "next/link";
import { CURRENT_CONSENT_VERSION } from "@/lib/operator-accounts";

export const metadata = {
  title: "Terms — Atharias",
  description: "Beta terms for Atharias.",
};

export default function TermsPage() {
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
        Beta terms
      </h1>

      <p
        className="mt-3 text-[14px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Version {CURRENT_CONSENT_VERSION}. These terms govern your use of the
        Atharias private beta.
      </p>

      <Section title="1. What Atharias is">
        <p>
          Atharias is a private-beta tool that turns the audience you upload
          into a set of anonymized agents you can run post drafts and content
          variations through, to predict how members of that audience are
          likely to react.
        </p>
        <p>
          You upload data you control: this may include your own LinkedIn
          export or other customer, prospect, community, or internal audience
          datasets that you have the right to use. We process that data into
          anonymized personas tied to your account and used to power the
          simulations you run.
        </p>
      </Section>

      <Section title="2. Your data, your responsibility">
        <p>
          By uploading data to Atharias you confirm that you have the right to
          do so. You may upload your own LinkedIn export and other datasets you
          lawfully control. Do not upload anyone else&rsquo;s export, scraped
          data, or data you obtained through means that violate the source
          platform&rsquo;s terms.
        </p>
        <p>
          If you suspect any data you uploaded was obtained improperly, email{" "}
          <a href="mailto:luke@atharias.dev">luke@atharias.dev</a> and we will
          delete it.
        </p>
      </Section>

      <Section title="3. How we treat your connections’ data">
        <p>
          Some uploads, including LinkedIn exports, may contain information
          about third parties such as connections, customers, teammates, or
          community members. Atharias processes that data to derive role-level
          archetypes — for example, &ldquo;Founder, vocal, leans skeptical of
          bold claims.&rdquo;{" "}
          <strong>
            We strip names, emails, company identifiers, and message bodies
            from non-uploader parties before anything is persisted as a
            persona.
          </strong>
        </p>
        <p>
          We never message your connections, never sell their identifiable
          data, and never attribute reactions back to a real named person
          inside the simulator.
        </p>
        <p>
          Aggregated, de-identified insights derived from many users&rsquo;
          uploads — for example, &ldquo;senior product marketers tend to
          object to claim X&rdquo; — may be used to improve the shared model
          and may be licensed in aggregated form to research partners.
        </p>
      </Section>

      <Section title="4. Beta status">
        <p>
          Atharias is in private beta. Things will break. Features will change.
          We may pause or rate-limit your account if usage threatens the
          platform.
        </p>
        <p>
          The beta is provided as-is, with no SLA, no uptime guarantee, and
          no warranty of fitness for any purpose. You use it at your own risk.
        </p>
      </Section>

      <Section title="5. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>upload anyone else&rsquo;s data without their consent;</li>
          <li>
            attempt to re-identify individuals from anonymized personas, or
            scrape personas out of the system;
          </li>
          <li>
            use Atharias to harass, target, or generate misleading content
            about specific individuals;
          </li>
          <li>
            resell, sublicense, or expose Atharias-generated outputs as a
            standalone product without written permission;
          </li>
          <li>
            run automated load against the platform beyond your assigned
            quota.
          </li>
        </ul>
      </Section>

      <Section title="6. Deletion and export">
        <p>
          You can request deletion of your account, your audiences, and your
          uploaded data at any time. See the{" "}
          <Link href="/privacy#delete">privacy policy</Link> for the request
          flow.
        </p>
        <p>
          Aggregated, de-identified statistics derived prior to your deletion
          request may persist in shared models — they are not traceable to you
          individually.
        </p>
      </Section>

      <Section title="7. Liability">
        <p>
          To the maximum extent permitted by law, Atharias and its founders
          are not liable for indirect, incidental, or consequential damages
          arising from beta use. Total liability is capped at the amount you
          have paid for the beta — which during private beta is zero.
        </p>
      </Section>

      <Section title="8. Changes">
        <p>
          We may update these terms. If we make a material change we will
          re-prompt for consent before further uploads. The current version is
          shown at the top of this page.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Questions about these terms or about how your data is handled go to{" "}
          <a href="mailto:luke@atharias.dev">luke@atharias.dev</a>.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
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
