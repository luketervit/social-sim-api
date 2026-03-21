import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ShareEventSchema = z.object({
  channel: z.enum([
    "published",
    "copy_link",
    "copy_summary",
    "twitter",
    "linkedin",
    "email",
    "direct",
  ]),
  share_text: z.string().max(500).nullable().optional(),
  destination: z.string().max(500).nullable().optional(),
});

async function canAccessSimulation(request: NextRequest, simulationId: string) {
  const apiKey = request.headers.get("x-api-key");
  const db = supabaseAdmin();

  if (apiKey) {
    const { data: simulation, error } = await db
      .from("simulations")
      .select("id")
      .eq("id", simulationId)
      .eq("api_key", apiKey)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(simulation);
  }

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
    return false;
  }

  const { data: simulation, error: simulationError } = await db
    .from("simulations")
    .select("id, api_key")
    .eq("id", simulationId)
    .maybeSingle();

  if (simulationError) {
    throw simulationError;
  }

  if (!simulation?.api_key) {
    return false;
  }

  const { data: keyOwner, error: ownerError } = await db
    .from("api_keys")
    .select("user_id")
    .eq("key", simulation.api_key)
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    throw ownerError;
  }

  return Boolean(keyOwner);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ShareEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const allowed = await canAccessSimulation(request, id);
    if (!allowed) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = supabaseAdmin();
    const payload = {
      simulation_id: id,
      channel: parsed.data.channel,
      share_text: parsed.data.share_text ?? null,
      destination: parsed.data.destination ?? null,
    };

    const { data, error } = await db
      .from("simulation_share_events")
      .insert(payload)
      .select("id, simulation_id, channel, share_text, destination, created_at")
      .single();

    if (error || !data) {
      return Response.json({ error: "Failed to log share event" }, { status: 500 });
    }

    return Response.json({ event: data }, { status: 201 });
  } catch (error) {
    console.error("Failed to log simulation share event:", error);
    return Response.json({ error: "Failed to log share event" }, { status: 500 });
  }
}
