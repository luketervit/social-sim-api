import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata = {
  title: "Explore Simulations - Atharias",
  description: "Browse public Atharias audience simulations shared by other teams.",
};

function formatRelativeDate(date: string | null) {
  if (!date) {
    return "Recently shared";
  }

  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const AGGRESSION_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export default async function ExplorePage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const db = supabaseAdmin();
  const { data: publicSimulations } = await db
    .from("simulations")
    .select(
      "id, api_key, audience_id, persona_cap, platform, input, aggression_score, title, summary, shared_at, progress_messages, created_at"
    )
    .eq("public", true)
    .order("shared_at", { ascending: false })
    .limit(36);

  let hiddenKeys = new Set<string>();

  if (user) {
    const { data: ownKeys } = await db
      .from("api_keys")
      .select("key")
      .eq("user_id", user.id);

    hiddenKeys = new Set((ownKeys ?? []).map((row) => row.key));
  }

  const simulations = (publicSimulations ?? []).filter((simulation) => !hiddenKeys.has(simulation.api_key));

  return (
    <div className="mx-auto max-w-[1180px] px-6 pt-14 pb-24">
      <div style={{ maxWidth: 760 }}>
        <span className="mono-label">EXPLORE :: PUBLIC_SIMULATION_FEED</span>
        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            marginTop: 14,
            color: "var(--text-primary)",
          }}
        >
          Browse live audience simulations from other teams.
        </h1>
        <p
          style={{
            marginTop: 16,
            color: "var(--text-secondary)",
            fontSize: 15,
            lineHeight: 1.72,
            maxWidth: 640,
          }}
        >
          These are publicly shared runs from the Atharias network. Open any report to inspect
          the full thread, sentiment breakdown, and the original prompt behind it.
        </p>
      </div>

      {simulations.length > 0 ? (
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {simulations.map((simulation) => (
            <article
              key={simulation.id}
              className="panel"
              style={{
                padding: 24,
                background:
                  "linear-gradient(180deg, rgba(39,39,42,0.3), rgba(24,24,27,0.14) 48%, rgba(9,9,11,0.28) 100%)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mono-label">SHARED_SIM</div>
                  <h2
                    style={{
                      marginTop: 10,
                      fontSize: 24,
                      lineHeight: 1.08,
                      color: "var(--text-primary)",
                    }}
                  >
                    {simulation.title ?? simulation.input.slice(0, 80)}
                  </h2>
                </div>
                {simulation.aggression_score ? (
                  <span
                    className="rounded-full px-3 py-1"
                    style={{
                      border: "1px solid rgba(39,39,42,0.75)",
                      background: "rgba(9,9,11,0.46)",
                      fontSize: 12,
                      color:
                        AGGRESSION_COLORS[simulation.aggression_score] ?? "var(--text-secondary)",
                    }}
                  >
                    {simulation.aggression_score}
                  </span>
                ) : null}
              </div>

              <p
                style={{
                  marginTop: 14,
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.68,
                  minHeight: 72,
                }}
              >
                {simulation.summary ??
                  `A public ${simulation.platform} simulation against ${simulation.audience_id.replace(/_/g, " ")}.`}
              </p>

              <div
                className="mt-5 flex flex-wrap gap-2"
                style={{ fontSize: 12, color: "var(--text-tertiary)" }}
              >
                <span
                  className="rounded-full px-3 py-1"
                  style={{ border: "1px solid var(--border)", background: "rgba(9,9,11,0.38)" }}
                >
                  {simulation.platform}
                </span>
                <span
                  className="rounded-full px-3 py-1"
                  style={{ border: "1px solid var(--border)", background: "rgba(9,9,11,0.38)" }}
                >
                  {simulation.audience_id.replace(/_/g, " ")}
                </span>
                {simulation.persona_cap ? (
                  <span
                    className="rounded-full px-3 py-1"
                    style={{ border: "1px solid var(--border)", background: "rgba(9,9,11,0.38)" }}
                  >
                    {simulation.persona_cap}-agent sample
                  </span>
                ) : null}
                <span
                  className="rounded-full px-3 py-1"
                  style={{ border: "1px solid var(--border)", background: "rgba(9,9,11,0.38)" }}
                >
                  {simulation.progress_messages} messages
                </span>
              </div>

              <div
                className="mt-6 flex items-center justify-between gap-4"
                style={{ color: "var(--text-tertiary)", fontSize: 12 }}
              >
                <span>{formatRelativeDate(simulation.shared_at ?? simulation.created_at)}</span>
                <Link href={`/sim/${simulation.id}`} className="btn-secondary" style={{ minHeight: "auto", padding: "9px 14px", fontSize: 12 }}>
                  Open report
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel mt-10 p-8">
          <p style={{ color: "var(--text-primary)", fontSize: 18 }}>No public simulations yet.</p>
          <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Share a completed run from the dashboard and it will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
