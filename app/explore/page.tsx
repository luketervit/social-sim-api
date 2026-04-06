import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import ExploreClient from "./client";

export const metadata = {
  title: "Explore Simulations - Atharias",
  description: "Browse public Atharias audience simulations shared by other teams.",
};

export default async function ExplorePage() {
  const db = supabaseAdmin();
  const { data: publicSimulations } = await db
    .from("simulations")
    .select(
      "id, audience_id, persona_cap, platform, input, aggression_score, title, summary, shared_at, progress_messages, created_at, public_clicks, upvotes, downvotes"
    )
    .eq("public", true)
    .order("shared_at", { ascending: false })
    .limit(60);

  const simulations = publicSimulations ?? [];

  // Get current user's votes if signed in
  let userVotes: Record<string, number> = {};
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const simIds = simulations.map((s) => s.id);
      if (simIds.length > 0) {
        const { data: votes } = await db
          .from("simulation_votes")
          .select("simulation_id, vote")
          .eq("user_id", user.id)
          .in("simulation_id", simIds);

        for (const v of votes ?? []) {
          userVotes[v.simulation_id] = v.vote;
        }
      }
    }
  } catch {
    // Not signed in, no votes
  }

  return (
    <ExploreClient
      simulations={simulations}
      userVotes={userVotes}
    />
  );
}
