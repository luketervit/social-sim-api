import { NextRequest } from "next/server";
import { getSimulationForUser } from "@/lib/playground";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { generateSimulationSummary } from "@/lib/simulation/summarize";
import type { AgentMessage } from "@/lib/simulation/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getOwnedSimulation(request: NextRequest, id: string) {
  const apiKey = request.headers.get("x-api-key");
  const db = supabaseAdmin();

  if (apiKey) {
    const { data, error } = await db
      .from("simulations")
      .select(
        "id, api_key, audience_id, platform, input, thread, aggression_score, status, public, title, summary, shared_at"
      )
      .eq("id", id)
      .eq("api_key", apiKey)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getSimulationForUser(user.id, id);
}

/**
 * POST /api/v1/simulate/[id]/share
 * Generate a title + summary draft via DeepSeek. Does not publish yet.
 * Accepts either x-api-key or an authenticated browser session.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const sim = await getOwnedSimulation(request, id);

  if (!sim) {
    return Response.json({ error: "Unauthorized or simulation not found" }, { status: 401 });
  }

  if (sim.status !== "completed") {
    return Response.json({ error: "Simulation must be completed before sharing" }, { status: 400 });
  }

  // Reuse any existing draft so this endpoint cannot trigger repeated LLM calls.
  if (sim.title && sim.summary) {
    return Response.json({
      simulation_id: sim.id,
      title: sim.title,
      summary: sim.summary,
      already_shared: sim.public,
    });
  }

  const thread = (sim.thread ?? []) as AgentMessage[];

  try {
    const { title, summary } = await generateSimulationSummary(
      sim.input,
      sim.platform,
      sim.audience_id,
      sim.aggression_score,
      thread
    );

    const { error: updateError } = await supabaseAdmin()
      .from("simulations")
      .update({
        title,
        summary,
      })
      .eq("id", sim.id)
      .eq("api_key", sim.api_key);

    if (updateError) {
      return Response.json({ error: "Failed to save summary draft" }, { status: 500 });
    }

    return Response.json({
      simulation_id: sim.id,
      title,
      summary,
      already_shared: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate summary";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/v1/simulate/[id]/share
 * Confirm sharing with (optionally edited) title and summary.
 * Sets the simulation as public.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, summary } = body as { title?: string; summary?: string };
  if (!title || !summary) {
    return Response.json({ error: "Title and summary are required" }, { status: 400 });
  }

  const { id } = await context.params;
  const db = supabaseAdmin();
  const sim = await getOwnedSimulation(request, id);

  if (!sim) {
    return Response.json({ error: "Unauthorized or simulation not found" }, { status: 401 });
  }

  if (sim.status !== "completed") {
    return Response.json({ error: "Simulation must be completed before sharing" }, { status: 400 });
  }

  const { error: updateError } = await db
    .from("simulations")
    .update({
      public: true,
      title: String(title).slice(0, 120),
      summary: String(summary).slice(0, 500),
      shared_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("api_key", sim.api_key);

  if (updateError) {
    return Response.json({ error: "Failed to publish simulation" }, { status: 500 });
  }

  const { error: shareEventError } = await db.from("simulation_share_events").insert({
    simulation_id: id,
    channel: "published",
    share_text: String(summary).slice(0, 500),
    destination: `/sim/${id}`,
  });

  if (shareEventError) {
    console.error("Failed to record publish share event:", {
      simulationId: id,
      message: shareEventError.message,
      code: shareEventError.code,
    });
  }

  return Response.json({
    simulation_id: id,
    public: true,
    title,
    summary,
    share_url: `/sim/${id}`,
  });
}

/**
 * DELETE /api/v1/simulate/[id]/share
 * Unpublish a shared simulation.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const db = supabaseAdmin();
  const sim = await getOwnedSimulation(request, id);

  if (!sim) {
    return Response.json({ error: "Unauthorized or simulation not found" }, { status: 401 });
  }

  const { error } = await db
    .from("simulations")
    .update({
      public: false,
      shared_at: null,
    })
    .eq("id", id)
    .eq("api_key", sim.api_key);

  if (error) {
    return Response.json({ error: "Failed to unpublish simulation" }, { status: 500 });
  }

  return Response.json({ simulation_id: id, public: false });
}
