import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { simulation_id: string; vote: 1 | -1 | 0 };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { simulation_id, vote } = body;
  if (!simulation_id || ![1, -1, 0].includes(vote)) {
    return Response.json({ error: "Invalid vote" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Check simulation is public
  const { data: sim } = await db
    .from("simulations")
    .select("id")
    .eq("id", simulation_id)
    .eq("public", true)
    .maybeSingle();

  if (!sim) {
    return Response.json({ error: "Simulation not found" }, { status: 404 });
  }

  if (vote === 0) {
    // Remove vote
    const { data: existing } = await db
      .from("simulation_votes")
      .select("vote")
      .eq("simulation_id", simulation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await db
        .from("simulation_votes")
        .delete()
        .eq("simulation_id", simulation_id)
        .eq("user_id", user.id);

      // Update aggregate
      const col = existing.vote === 1 ? "upvotes" : "downvotes";
      await db.rpc("adjust_simulation_vote_count", {
        p_simulation_id: simulation_id,
        p_column: col,
        p_delta: -1,
      });
    }
  } else {
    // Get existing vote if any
    const { data: existing } = await db
      .from("simulation_votes")
      .select("vote")
      .eq("simulation_id", simulation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    // Upsert
    await db
      .from("simulation_votes")
      .upsert(
        { simulation_id, user_id: user.id, vote },
        { onConflict: "simulation_id,user_id" }
      );

    // Update aggregates
    if (existing && existing.vote !== vote) {
      // Switched vote direction
      const oldCol = existing.vote === 1 ? "upvotes" : "downvotes";
      const newCol = vote === 1 ? "upvotes" : "downvotes";
      await Promise.all([
        db.rpc("adjust_simulation_vote_count", { p_simulation_id: simulation_id, p_column: oldCol, p_delta: -1 }),
        db.rpc("adjust_simulation_vote_count", { p_simulation_id: simulation_id, p_column: newCol, p_delta: 1 }),
      ]);
    } else if (!existing) {
      const col = vote === 1 ? "upvotes" : "downvotes";
      await db.rpc("adjust_simulation_vote_count", {
        p_simulation_id: simulation_id,
        p_column: col,
        p_delta: 1,
      });
    }
  }

  // Return fresh counts
  const { data: updated } = await db
    .from("simulations")
    .select("upvotes, downvotes")
    .eq("id", simulation_id)
    .single();

  return Response.json({
    upvotes: updated?.upvotes ?? 0,
    downvotes: updated?.downvotes ?? 0,
    user_vote: vote === 0 ? null : vote,
  });
}
