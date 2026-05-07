import { NextRequest, after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOperatorAccountByUserId } from "@/lib/operator-accounts";
import { getOrCreateUserApiKey } from "@/lib/user-api-key";
import { createSimulationJob } from "@/lib/simulation/jobs";
import { runSimulationInline } from "@/lib/simulation/runInline";
import { CREDITS_PER_MESSAGE, SIMULATION_ROUNDS } from "@/lib/credits";
import { analyzePostImage } from "@/lib/simulation/llm";

export const maxDuration = 300;

const ALLOWED_PLATFORMS = new Set(["twitter", "reddit", "slack", "linkedin"]);
const MAX_INPUT_LENGTH = 2000;
const MAX_IMAGE_URL_LENGTH = 3_000_000;

function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_IMAGE_URL_LENGTH) {
    throw new Error("Attached image is too large.");
  }
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }
  throw new Error("imageUrl must be an https URL or data:image payload.");
}

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
    imageUrl?: unknown;
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

  let imageUrl: string | null = null;
  try {
    imageUrl = sanitizeImageUrl(payload.imageUrl);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid imageUrl." },
      { status: 400 }
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
  let imageAnalysis = null;
  if (imageUrl) {
    try {
      const result = await analyzePostImage(input, platform, imageUrl);
      imageAnalysis = result.analysis;
    } catch (error) {
      console.error("Image analysis failed:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not analyze the attached image.",
        },
        { status: 502 }
      );
    }
  }

  const cap = Math.max(1, audience.row_count ?? 1);
  const reservedCredits = cap * SIMULATION_ROUNDS * CREDITS_PER_MESSAGE;

  const job = await createSimulationJob({
    apiKey,
    audienceId: audience.id,
    personaCap: cap,
    platform,
    input,
    imageUrl,
    imageAnalysis,
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
      imageAnalyzed: Boolean(imageAnalysis),
    },
    { status: 202 }
  );
}
