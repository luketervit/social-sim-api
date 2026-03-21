import { NextRequest } from "next/server";
import { SimulateInputSchema } from "@/lib/schemas";
import { consumeApiCredits, getApiKeyStatus, refundApiCredits } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSimulationJob, getSimulationJob } from "@/lib/simulation/jobs";
import { CREDITS_PER_MESSAGE, MAX_MESSAGES_PER_SIMULATION, SIMULATION_ROUNDS } from "@/lib/credits";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json({ error: "Missing x-api-key header" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SimulateInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { audience_id, platform, input } = parsed.data;
  const db = supabaseAdmin();

  const { data: audience, error: audError } = await db
    .from("audiences")
    .select("personas")
    .eq("id", audience_id)
    .single();

  if (audError || !audience) {
    return Response.json({ error: `Audience '${audience_id}' not found` }, { status: 404 });
  }

  const personas = audience.personas as unknown[];
  if (!Array.isArray(personas) || personas.length === 0) {
    return Response.json({ error: "Audience has no personas" }, { status: 400 });
  }

  const reservedCredits = personas.length * SIMULATION_ROUNDS * CREDITS_PER_MESSAGE;

  const auth = await getApiKeyStatus(apiKey, reservedCredits);
  if (!auth.valid) {
    return Response.json({ error: auth.error }, { status: 401 });
  }

  const debit = await consumeApiCredits(apiKey, reservedCredits);
  if (!debit.valid) {
    const status = debit.error === "No credits remaining" ? 402 : 500;
    return Response.json({ error: debit.error ?? "Failed to reserve credits" }, { status });
  }

  try {
    const job = await createSimulationJob({
      apiKey,
      audienceId: audience_id,
      personaCap: null,
      platform,
      input,
      reservedCredits,
    });

    return Response.json(
      {
        simulation_id: job.id,
        status: job.status,
        expected_messages: reservedCredits / CREDITS_PER_MESSAGE,
        simulation_rounds: SIMULATION_ROUNDS,
        reserved_credits: reservedCredits,
        progress_messages: 0,
        poll_url: `/api/v1/simulate?id=${job.id}`,
      },
      { status: 202 }
    );
  } catch (error) {
    const refund = await refundApiCredits(apiKey, reservedCredits);
    if (!refund.ok) {
      console.error("Failed to refund credits after enqueue error:", {
        apiKeyPrefix: apiKey.slice(0, 12),
        reservedCredits,
        refundError: refund.error,
      });
    }

    const message = error instanceof Error ? error.message : "Failed to enqueue simulation";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json({ error: "Missing x-api-key header" }, { status: 401 });
  }

  const simulationId = request.nextUrl.searchParams.get("id");
  if (!simulationId) {
    return Response.json({ error: "Missing simulation id" }, { status: 400 });
  }

  try {
    const job = await getSimulationJob(simulationId, apiKey);
    if (!job) {
      return Response.json({ error: "Simulation not found" }, { status: 404 });
    }

    return Response.json({
      simulation_id: job.id,
      status: job.status,
      audience_id: job.audience_id,
      persona_cap: job.persona_cap,
      platform: job.platform,
      input: job.input,
      progress_messages: job.progress_messages,
      expected_messages: job.reserved_credits / CREDITS_PER_MESSAGE || MAX_MESSAGES_PER_SIMULATION,
      simulation_rounds: SIMULATION_ROUNDS,
      aggression_score: job.aggression_score,
      error: job.error_message,
      started_at: job.started_at,
      completed_at: job.completed_at,
      refunded_credits: job.refunded_credits,
      thread: job.thread ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load simulation";
    return Response.json({ error: message }, { status: 500 });
  }
}
