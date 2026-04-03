import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  CREDITS_PER_MESSAGE,
  PLAYGROUND_KEY_PREFIX,
  PLAYGROUND_PERSONA_CAP,
  SIMULATION_ROUNDS,
} from "@/lib/credits";
import { ensureOperatorAccount, getOrCreatePlaygroundKey } from "@/lib/playground";
import {
  FREE_PLAYGROUND_SIMULATIONS_PER_DAY,
  QUOTA_BUCKETS,
  consumeDailyQuota,
  getDailyQuotaState,
  refundDailyQuota,
} from "@/lib/quotas";
import { SimulateInputSchema } from "@/lib/schemas";
import { createSimulationJob } from "@/lib/simulation/jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function getAuthenticatedUser(request: NextRequest) {
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

  if (!user || !user.email) {
    return null;
  }

  await ensureOperatorAccount(user.id, user.email);
  return {
    id: user.id,
    email: user.email,
  };
}

export async function POST(request: NextRequest) {
  let user: { id: string; email: string } | null = null;

  try {
    user = await getAuthenticatedUser(request);
  } catch (authError) {
    console.error("Playground auth error:", authError);
    return Response.json({ error: "Authentication failed" }, { status: 500 });
  }

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
  const { data: audience, error: audienceError } = await db
    .from("audiences")
    .select("personas")
    .eq("id", audience_id)
    .single();

  if (audienceError || !audience) {
    return Response.json({ error: `Audience '${audience_id}' not found` }, { status: 404 });
  }

  const personas = audience.personas as unknown[];
  if (!Array.isArray(personas) || personas.length === 0) {
    return Response.json({ error: "Audience has no personas" }, { status: 400 });
  }

  let quota: Awaited<ReturnType<typeof consumeDailyQuota>>;
  try {
    quota = await consumeDailyQuota(
      user.id,
      QUOTA_BUCKETS.playgroundSimulation,
      FREE_PLAYGROUND_SIMULATIONS_PER_DAY
    );
  } catch (quotaError) {
    console.error("Playground quota error:", JSON.stringify(quotaError, null, 2));
    const detail =
      quotaError instanceof Error
        ? quotaError.message
        : typeof quotaError === "object" && quotaError !== null && "message" in quotaError
          ? (quotaError as { message: string }).message
          : JSON.stringify(quotaError);
    return Response.json({ error: `Failed to check simulation quota: ${detail}` }, { status: 500 });
  }

  if (!quota.allowed) {
    return Response.json(
      {
        error: `Your ${FREE_PLAYGROUND_SIMULATIONS_PER_DAY} free simulations for today are used up. Try again tomorrow.`,
        daily_limit: FREE_PLAYGROUND_SIMULATIONS_PER_DAY,
        remaining_today: quota.remaining,
        usage_date: quota.usage_date,
      },
      { status: 429 }
    );
  }

  const personaCap = Math.min(PLAYGROUND_PERSONA_CAP, personas.length);
  const reservedCredits = personaCap * SIMULATION_ROUNDS * CREDITS_PER_MESSAGE;

  try {
    const apiKey = await getOrCreatePlaygroundKey(user.id, user.email);
    const job = await createSimulationJob({
      apiKey: apiKey.key,
      audienceId: audience_id,
      personaCap,
      platform,
      input,
      reservedCredits: 0,
    });

    return Response.json(
      {
        simulation_id: job.id,
        status: job.status,
        audience_id,
        platform,
        input,
        persona_cap: personaCap,
        expected_messages: reservedCredits / CREDITS_PER_MESSAGE,
        simulation_rounds: SIMULATION_ROUNDS,
        reserved_credits: reservedCredits,
        progress_messages: 0,
        daily_limit: FREE_PLAYGROUND_SIMULATIONS_PER_DAY,
        remaining_today: quota.remaining,
        usage_date: quota.usage_date,
        public: false,
        title: null,
        summary: null,
        shared_at: null,
        created_at: job.created_at,
        completed_at: null,
        poll_url: `/api/v1/playground?id=${job.id}`,
      },
      { status: 202 }
    );
  } catch (error) {
    try {
      await refundDailyQuota(user.id, QUOTA_BUCKETS.playgroundSimulation, 1);
    } catch (refundError) {
      console.error("Failed to refund playground daily quota after enqueue error:", {
        userId: user.id,
        refundError,
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to enqueue playground simulation";
    console.error("Playground enqueue error:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  let user: { id: string; email: string } | null = null;

  try {
    user = await getAuthenticatedUser(request);
  } catch (authError) {
    console.error("Playground GET auth error:", authError);
    return Response.json({ error: "Authentication failed" }, { status: 500 });
  }

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const simulationId = request.nextUrl.searchParams.get("id");
  if (!simulationId) {
    return Response.json({ error: "Missing simulation id" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: keys, error: keyError } = await db
    .from("api_keys")
    .select("key")
    .eq("user_id", user.id)
    .like("key", `${PLAYGROUND_KEY_PREFIX}%`);

  if (keyError) {
    return Response.json({ error: "Failed to load playground access" }, { status: 500 });
  }

  const playgroundKeys = (keys ?? []).map((entry) => entry.key);
  if (playgroundKeys.length === 0) {
    return Response.json({ error: "Simulation not found" }, { status: 404 });
  }

  const { data: simulation, error: simulationError } = await db
    .from("simulations")
    .select(
      "id, audience_id, persona_cap, platform, input, progress_messages, aggression_score, status, public, title, summary, shared_at, error_message, started_at, created_at, completed_at, refunded_credits, thread"
    )
    .eq("id", simulationId)
    .in("api_key", playgroundKeys)
    .maybeSingle();

  if (simulationError) {
    return Response.json({ error: "Failed to load simulation" }, { status: 500 });
  }

  if (!simulation) {
    return Response.json({ error: "Simulation not found" }, { status: 404 });
  }

  const expectedMessages =
    (simulation.persona_cap ?? PLAYGROUND_PERSONA_CAP) * SIMULATION_ROUNDS;
  const quota = await getDailyQuotaState(
    user.id,
    QUOTA_BUCKETS.playgroundSimulation,
    FREE_PLAYGROUND_SIMULATIONS_PER_DAY
  );

  return Response.json({
    simulation_id: simulation.id,
    status: simulation.status,
    audience_id: simulation.audience_id,
    persona_cap: simulation.persona_cap,
    platform: simulation.platform,
    input: simulation.input,
    progress_messages: simulation.progress_messages,
    expected_messages: expectedMessages,
    simulation_rounds: SIMULATION_ROUNDS,
    aggression_score: simulation.aggression_score,
    public: simulation.public,
    title: simulation.title,
    summary: simulation.summary,
    shared_at: simulation.shared_at,
    error: simulation.error_message,
    started_at: simulation.started_at,
    created_at: simulation.created_at,
    completed_at: simulation.completed_at,
    refunded_credits: simulation.refunded_credits,
    thread: simulation.thread ?? [],
    daily_limit: FREE_PLAYGROUND_SIMULATIONS_PER_DAY,
    remaining_today: quota.remaining,
    usage_date: quota.usage_date,
  });
}
