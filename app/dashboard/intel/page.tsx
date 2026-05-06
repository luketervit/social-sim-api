import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ensureOperatorAccount } from "@/lib/operator-accounts";
import {
  canAccessOperatorPersonaInsights,
  loadOperatorPersonaInsights,
} from "@/lib/operator-persona-insights";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Persona Intelligence — Atharias",
  description: "Operator-only view over aggregated uploaded persona data.",
};

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSigned(value: number) {
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

export default async function DashboardIntelPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login?next=%2Fdashboard%2Fintel");
  }

  await ensureOperatorAccount(user.id, user.email);

  if (!canAccessOperatorPersonaInsights(user.email)) {
    notFound();
  }

  const insights = await loadOperatorPersonaInsights();

  return (
    <div
      className="mx-auto max-w-[1320px] px-6"
      style={{ padding: "36px 24px 84px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <span className="mono-label">Operator-only persona intelligence</span>
          <h1
            style={{
              marginTop: 14,
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(2.4rem, 5vw, 4.2rem)",
              letterSpacing: "-0.045em",
              lineHeight: 0.96,
              color: "var(--text-primary)",
            }}
          >
            Show the market what this audience data can do.
          </h1>
          <p
            style={{
              marginTop: 18,
              maxWidth: 680,
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--text-secondary)",
            }}
          >
            This view aggregates every uploaded persona into role families,
            seniority strata, value tags, and behavioral distributions. It is
            designed for demos with AI labs, consultants, and strategy buyers
            who need to see that the dataset is segmentable, legible, and
            commercially useful.
          </p>
        </div>

        <div
          className="panel"
          style={{
            minWidth: 260,
            padding: "18px 20px",
            alignSelf: "stretch",
          }}
        >
          <div className="mono-label">Session</div>
          <div
            style={{
              marginTop: 12,
              fontSize: 14,
              color: "var(--text-primary)",
              fontWeight: 500,
            }}
          >
            {user.email}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--text-tertiary)",
            }}
          >
            Refreshed from live uploaded audience data only.
          </div>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              marginTop: 18,
              textDecoration: "none",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            ← Back to workspace
          </Link>
        </div>
      </div>

      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <StatCard label="Uploaded audiences" value={insights.totals.audiences.toLocaleString()} />
        <StatCard label="Synthetic personas" value={insights.totals.personas.toLocaleString()} />
        <StatCard label="Distinct archetypes" value={insights.totals.archetypes.toLocaleString()} />
        <StatCard label="Distinct value tags" value={insights.totals.valueTags.toLocaleString()} />
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-data), monospace",
          letterSpacing: "0.04em",
        }}
      >
        Generated {new Date(insights.generatedAt).toLocaleString("en-US")}
      </div>

      <section style={{ marginTop: 34 }}>
        <SectionTitle
          title="Commercial Readouts"
          copy="These are the slices that make the data legible to buyers. They show that the personas are not just a blob of prompts, but a structured market map."
        />
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          <InsightCard
            title="Workforce segmentation"
            body="Role families and seniority tiers show who is actually in the corpus: operators, engineers, founders, GTM, research, and more."
          />
          <InsightCard
            title="Behavioral scoring"
            body="Reactivity, sophistication, and affinity distributions let you prove this is decision-grade audience structure, not generic CRM enrichment."
          />
          <InsightCard
            title="Value extraction"
            body="Core value tags expose what these people care about, which is exactly the layer consultants and AI labs need for targeting, messaging, and policy analysis."
          />
        </div>
      </section>

      <section style={{ marginTop: 42 }}>
        <SectionTitle
          title="Role Families"
          copy="Top-down segmentation by inferred function. This is the fastest way to show that the uploaded corpus can be cut into commercially meaningful buyer or stakeholder groups."
        />
        <div
          className="panel"
          style={{ marginTop: 16, overflow: "hidden", padding: 0 }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <HeaderCell>Family</HeaderCell>
                <HeaderCell>Share</HeaderCell>
                <HeaderCell>Count</HeaderCell>
                <HeaderCell>Avg reactivity</HeaderCell>
                <HeaderCell>Avg sophistication</HeaderCell>
                <HeaderCell>Avg affinity</HeaderCell>
                <HeaderCell>Top values</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {insights.families.map((family) => (
                <tr key={family.label}>
                  <BodyCell strong>{family.label}</BodyCell>
                  <BodyCell>{formatPct(family.share)}</BodyCell>
                  <BodyCell>{family.count.toLocaleString()}</BodyCell>
                  <BodyCell>{family.avgReactivity.toFixed(2)}</BodyCell>
                  <BodyCell>{family.avgSophistication.toFixed(2)}</BodyCell>
                  <BodyCell>{formatSigned(family.avgAffinity)}</BodyCell>
                  <BodyCell>{family.topValues.join(", ") || "—"}</BodyCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={{
          marginTop: 42,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18,
        }}
      >
        <div>
          <SectionTitle
            title="Seniority Mix"
            copy="This shows whether the corpus skews toward operators with purchase authority, ICs with technical influence, or junior talent with weak public voice."
          />
          <div className="panel" style={{ marginTop: 16, padding: "18px 18px 14px" }}>
            {insights.seniority.map((entry) => (
              <BarRow
                key={entry.label}
                label={entry.label}
                value={entry.count}
                share={entry.share}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionTitle
            title="High-Leverage Segments"
            copy="These are the most commercially useful combined segments once you factor in population size, sophistication, and skeptical posture."
          />
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {insights.segments.map((segment) => (
              <div
                key={segment.label}
                className="panel"
                style={{ padding: "16px 16px 14px" }}
              >
                <div className="mono-label">{segment.family}</div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 18,
                    lineHeight: 1.15,
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {segment.seniority}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  {segment.count.toLocaleString()} personas · {formatPct(segment.share)}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  <MetricMini label="React" value={segment.avgReactivity.toFixed(2)} />
                  <MetricMini label="Soph" value={segment.avgSophistication.toFixed(2)} />
                  <MetricMini label="Affinity" value={formatSigned(segment.avgAffinity)} />
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    lineHeight: 1.5,
                  }}
                >
                  Archetypes: {segment.topArchetypes.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 42 }}>
        <SectionTitle
          title="Disposition Distribution"
          copy="A buyer should be able to immediately understand whether this dataset trends quiet or loud, elite or plainspoken, skeptical or receptive."
        />
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          <BucketCard title="Reactivity" rows={insights.reactivityBuckets} />
          <BucketCard title="Sophistication" rows={insights.sophisticationBuckets} />
          <BucketCard title="Brand affinity" rows={insights.affinityBuckets} />
        </div>
      </section>

      <section
        style={{
          marginTop: 42,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
          gap: 18,
        }}
      >
        <div>
          <SectionTitle
            title="Dominant Archetypes"
            copy="The most common persona labels in the current corpus."
          />
          <div
            className="panel"
            style={{
              marginTop: 16,
              padding: "18px",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {insights.topArchetypes.map((entry) => (
              <Pill
                key={entry.label}
                label={`${entry.label} · ${entry.count}`}
                muted={formatPct(entry.share)}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionTitle
            title="Value Tags"
            copy="Repeated semantic anchors inferred from uploaded audience rows."
          />
          <div
            className="panel"
            style={{
              marginTop: 16,
              padding: "18px",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {insights.topValues.map((entry) => (
              <Pill
                key={entry.label}
                label={entry.label}
                muted={`${entry.count} · ${formatPct(entry.share)}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 42 }}>
        <SectionTitle
          title="Audience Sources"
          copy="Per-upload breakdown. Useful when you want to show that distinct corpora resolve into different market shapes."
        />
        <div
          className="panel"
          style={{ marginTop: 16, overflow: "hidden", padding: 0 }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <HeaderCell>Audience</HeaderCell>
                <HeaderCell>Platform</HeaderCell>
                <HeaderCell>Count</HeaderCell>
                <HeaderCell>Top family</HeaderCell>
                <HeaderCell>Avg reactivity</HeaderCell>
                <HeaderCell>Avg sophistication</HeaderCell>
                <HeaderCell>Avg affinity</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {insights.audiences.map((audience) => (
                <tr key={audience.id}>
                  <BodyCell strong>{audience.name}</BodyCell>
                  <BodyCell>{audience.platform}</BodyCell>
                  <BodyCell>{audience.count.toLocaleString()}</BodyCell>
                  <BodyCell>{audience.topFamily}</BodyCell>
                  <BodyCell>{audience.avgReactivity.toFixed(2)}</BodyCell>
                  <BodyCell>{audience.avgSophistication.toFixed(2)}</BodyCell>
                  <BodyCell>{formatSigned(audience.avgAffinity)}</BodyCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, copy }: { title: string; copy: string }) {
  return (
    <div>
      <h2
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 28,
          lineHeight: 1.04,
          letterSpacing: "-0.03em",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          marginTop: 10,
          maxWidth: 760,
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--text-secondary)",
        }}
      >
        {copy}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel" style={{ padding: "18px 18px 16px" }}>
      <div className="mono-label">{label}</div>
      <div
        style={{
          marginTop: 12,
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 42,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel" style={{ padding: "18px 18px 16px" }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </div>
      <p
        style={{
          marginTop: 10,
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--text-secondary)",
        }}
      >
        {body}
      </p>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--font-data), monospace",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}

function BodyCell({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        fontSize: 14,
        color: strong ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: strong ? 600 : 400,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

function BarRow({
  label,
  value,
  share,
}: {
  label: string;
  value: number;
  share: number;
}) {
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>
          {value.toLocaleString()} · {formatPct(share)}
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "var(--bg-subtle)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(4, share * 100)}%`,
            height: "100%",
            borderRadius: 999,
            background:
              "linear-gradient(90deg, var(--ink) 0%, var(--butter-deep) 100%)",
          }}
        />
      </div>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 8px 6px",
        borderRadius: 10,
        background: "var(--bg-subtle)",
      }}
    >
      <div className="mono-label" style={{ fontSize: 9 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BucketCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number; share: number }>;
}) {
  return (
    <div className="panel" style={{ padding: "18px 18px 14px" }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 16 }}>
        {rows.map((row) => (
          <BarRow
            key={row.label}
            label={row.label}
            value={row.count}
            share={row.share}
          />
        ))}
      </div>
    </div>
  );
}

function Pill({ label, muted }: { label: string; muted: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 999,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        fontSize: 13,
        lineHeight: 1.2,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {muted}
      </span>
    </div>
  );
}
