import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

export default async function StatsPage() {
  const counts = await loadCounts();

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
