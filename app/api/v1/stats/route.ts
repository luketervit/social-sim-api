import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 30;
// Public endpoint — no auth required. Used by the marketing footer + the
// /stats page to surface live aggregate volume for the demo.
export const dynamic = "force-dynamic";

interface StatsPayload {
  audiences: number;
  agents: number;
  simulations: number;
  reasoning_traces: number;
  generated_at: string;
}

export async function GET(_request: NextRequest) {
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

  if (audiencesRes.error) {
    console.error("stats audiences query failed:", audiencesRes.error);
  }
  if (simsRes.error) {
    console.error("stats simulations query failed:", simsRes.error);
  }

  const audienceCount = audiencesRes.count ?? 0;
  const simulationCount = simsRes.count ?? 0;

  const agentCount =
    audiencesRes.data?.reduce((sum, a) => {
      const n = (a as { row_count?: number | null }).row_count ?? 0;
      return sum + (typeof n === "number" ? n : 0);
    }, 0) ?? 0;

  const reasoningTraces =
    simsRes.data?.reduce((sum, s) => {
      const n = (s as { progress_messages?: number | null }).progress_messages ?? 0;
      return sum + (typeof n === "number" ? n : 0);
    }, 0) ?? 0;

  const payload: StatsPayload = {
    audiences: audienceCount,
    agents: agentCount,
    simulations: simulationCount,
    reasoning_traces: reasoningTraces,
    generated_at: new Date().toISOString(),
  };

  return Response.json(payload, {
    headers: {
      // Short edge cache so the counter doesn't hammer the DB during a
      // demo. Refreshes every 30s, which is plenty live-feeling.
      "Cache-Control": "public, max-age=30, s-maxage=30",
    },
  });
}
