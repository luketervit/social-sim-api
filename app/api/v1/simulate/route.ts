import { NextRequest, after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOperatorAccountByUserId } from "@/lib/operator-accounts";
import { getOrCreateUserApiKey } from "@/lib/user-api-key";
import { createSimulationJob } from "@/lib/simulation/jobs";
import { runSimulationInline } from "@/lib/simulation/runInline";
import { CREDITS_PER_MESSAGE, SIMULATION_ROUNDS } from "@/lib/credits";

export const maxDuration = 300;

const ALLOWED_PLATFORMS = new Set(["twitter", "reddit", "slack", "linkedin"]);
const MAX_INPUT_LENGTH = 2000;
const MIN_PERSONA_CAP = 5;
const MAX_PERSONA_CAP = 200;

async function getUser(request: NextRequest) {
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
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOperatorAccountByUserId(user.id);
  if (!account || account.waitlist) {
    return Response.json(
      { error: "Your account is still on the waitlist." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    audienceId?: unknown;
    platform?: unknown;
    input?: unknown;
    personaCap?: unknown;
  };

  const audienceId =
    typeof payload.audienceId === "string" ? payload.audienceId.trim() : "";
  if (!audienceId) {
    return Response.json({ error: "audienceId required." }, { status: 400 });
  }

  const platform =
    typeof payload.platform === "string" ? payload.platform.toLowerCase() : "";
  if (!ALLOWED_PLATFORMS.has(platform)) {
    return Response.json(
      { error: "platform must be twitter, linkedin, reddit, or slack." },
      { status: 400 }
    );
  }

  const input = typeof payload.input === "string" ? payload.input.trim() : "";
  if (input.length === 0) {
    return Response.json({ error: "Post text required." }, { status: 400 });
  }
  if (input.length > MAX_INPUT_LENGTH) {
    return Response.json(
      { error: `Post must be under ${MAX_INPUT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  let personaCap: number | null = null;
  if (typeof payload.personaCap === "number" && Number.isFinite(payload.personaCap)) {
    personaCap = Math.max(
      MIN_PERSONA_CAP,
      Math.min(MAX_PERSONA_CAP, Math.floor(payload.personaCap))
    );
  }

  const db = supabaseAdmin();
  const { data: audience, error: audienceError } = await db
    .from("audiences")
    .select("id, owner_user_id, status, row_count")
    .eq("id", audienceId)
    .maybeSingle();

  if (audienceError) {
    console.error("Failed to load audience:", audienceError);
    return Response.json({ error: "Audience lookup failed." }, { status: 500 });
  }
  if (!audience) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }
  if (audience.owner_user_id !== user.id) {
    return Response.json({ error: "Audience not found." }, { status: 404 });
  }
  if (audience.status !== "ready") {
    return Response.json(
      { error: `Audience is ${audience.status}, not ready yet.` },
      { status: 409 }
    );
  }

  const apiKey = await getOrCreateUserApiKey(user.email);

  const cap =
    personaCap ?? Math.min(audience.row_count ?? 50, MAX_PERSONA_CAP);
  const reservedCredits = cap * SIMULATION_ROUNDS * CREDITS_PER_MESSAGE;

  const job = await createSimulationJob({
    apiKey,
    audienceId: audience.id,
    personaCap: cap,
    platform,
    input,
    reservedCredits,
  });

  after(() =>
    runSimulationInline(job).catch((err) => {
      console.error("Inline simulation crashed:", { jobId: job.id, err });
    })
  );

  return Response.json(
    {
      simulationId: job.id,
      status: "queued",
      personaCap: cap,
      reservedCredits,
    },
    { status: 202 }
  );
}
