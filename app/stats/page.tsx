import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeLinkedInGlobalEval } from "@/lib/evals/linkedinGlobal";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export const metadata = {
  title: "Stats — Atharias",
  description: "Live aggregate stats from the Atharias private beta.",
};

interface Counts {
  audiences: number;
  agents: number;
  simulations: number;
  reasoningTraces: number;
}

interface LinkedInGlobalStats {
  accountCount: number;
  postCount: number;
  weightedSpearman: number | null;
  weightedTopQuartile: number | null;
  winners: Array<{ label: string; correlation: number }>;
  losers: Array<{ label: string; correlation: number }>;
}

async function loadCounts(): Promise<Counts> {
  const db = supabaseAdmin();
  const [audiencesRes, simsRes] = await Promise.all([
    db
      .from("audiences")
      .select("row_count, status", { count: "exact" })
      .eq("status", "ready"),
    db
      .from("simulations")
      .select("progress_messages", { count: "exact" }),
  ]);

  const audiences = audiencesRes.count ?? 0;
  const simulations = simsRes.count ?? 0;
  const agents =
    audiencesRes.data?.reduce((sum, a) => {
      const n = (a as { row_count?: number | null }).row_count ?? 0;
      return sum + (typeof n === "number" ? n : 0);
    }, 0) ?? 0;
  const reasoningTraces =
    simsRes.data?.reduce((sum, s) => {
      const n =
        (s as { progress_messages?: number | null }).progress_messages ?? 0;
      return sum + (typeof n === "number" ? n : 0);
    }, 0) ?? 0;

  return { audiences, agents, simulations, reasoningTraces };
}

async function loadLinkedInGlobalStats(): Promise<LinkedInGlobalStats | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .select("owner_user_id, metadata")
    .eq("platform", "linkedin")
    .eq("status", "ready");

  if (error) {
    console.error("Failed to load LinkedIn global stats:", error);
    return null;
  }

  const summary = computeLinkedInGlobalEval(data ?? []);
  if (!summary) return null;

  return {
    accountCount: summary.account_count,
    postCount: summary.post_count,
    weightedSpearman: summary.weighted_mean_spearman_rank_correlation,
    weightedTopQuartile: summary.weighted_mean_top_quartile_overlap,
    winners: summary.strongest_positive_signals.map((item) => ({
      label: item.interpretation,
      correlation: item.correlation,
    })),
    losers: summary.strongest_negative_signals.map((item) => ({
      label: item.interpretation,
      correlation: item.correlation,
    })),
  };
}

export default async function StatsPage() {
  const [counts, linkedIn] = await Promise.all([
    loadCounts(),
    loadLinkedInGlobalStats(),
  ]);

  return (
    <div className="mx-auto max-w-[760px] pt-20 pb-24 px-6">
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
        className="mt-4 text-[36px]"
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          letterSpacing: "-0.035em",
          lineHeight: 1.05,
        }}
      >
        Live stats
      </h1>

      <p
        className="mt-3 text-[14px] leading-[1.6]"
        style={{ color: "var(--text-secondary)" }}
      >
        Aggregate volume from the Atharias private beta. Updates every 30
        seconds. All numbers are de-identified counts — no individual person,
        company, or message is exposed.
      </p>

      <div
        style={{
          marginTop: 36,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <Stat label="Audiences uploaded" value={counts.audiences} />
        <Stat label="Agents generated" value={counts.agents} />
        <Stat label="Simulations run" value={counts.simulations} />
        <Stat
          label="Reasoning traces captured"
          value={counts.reasoningTraces}
        />
      </div>

      {linkedIn ? (
        <div
          style={{
            marginTop: 40,
            padding: "24px 26px",
            borderRadius: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
            }}
          >
            LinkedIn global benchmark
          </div>
          <h2
            style={{
              marginTop: 10,
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 30,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Cross-account evals for tuning the pipeline
          </h2>
          <p
            style={{
              marginTop: 12,
              color: "var(--text-secondary)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            These are de-identified aggregate signals computed from private
            LinkedIn exports across the beta. Individual accounts keep their own
            evals, and this layer shows what tends to work generally.
          </p>

          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 14,
            }}
          >
            <StatCard
              label="Accounts in benchmark"
              value={linkedIn.accountCount.toLocaleString()}
            />
            <StatCard
              label="Posts in benchmark"
              value={linkedIn.postCount.toLocaleString()}
            />
            <StatCard
              label="Weighted rank fit"
              value={
                linkedIn.weightedSpearman !== null
                  ? linkedIn.weightedSpearman.toFixed(2)
                  : "n/a"
              }
            />
            <StatCard
              label="Top quartile hit rate"
              value={
                linkedIn.weightedTopQuartile !== null
                  ? `${Math.round(linkedIn.weightedTopQuartile * 100)}%`
                  : "n/a"
              }
            />
          </div>

          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <PatternList
              title="What tends to work"
              items={linkedIn.winners}
            />
            <PatternList
              title="What tends to underperform"
              items={linkedIn.losers}
            />
          </div>
        </div>
      ) : null}

      <p
        className="mt-12 text-[12px] leading-[1.6]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Read how this data is handled in the{" "}
        <Link href="/privacy" style={{ color: "var(--text-secondary)" }}>
          privacy policy
        </Link>
        . Aggregates only — never identifiable data.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 36,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: "var(--text-primary)",
        }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "18px 18px 16px",
        borderRadius: 14,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 30,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PatternList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; correlation: number }>;
}) {
  return (
    <div
      style={{
        padding: "18px 18px 16px",
        borderRadius: 14,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 14,
              lineHeight: 1.45,
              color: "var(--text-primary)",
            }}
          >
            <span>{item.label}</span>
            <span
              style={{
                fontFamily: "var(--font-data), monospace",
                color: "var(--text-secondary)",
              }}
            >
              {item.correlation.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
