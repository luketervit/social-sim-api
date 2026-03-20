import { NextRequest } from "next/server";
import { SimulateInputSchema } from "@/lib/schemas";
import { validateApiKey } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { runSimulation } from "@/lib/simulation/engine";
import type { AgentMessage } from "@/lib/simulation/types";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json({ error: "Missing x-api-key header" }, { status: 401 });
  }

  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return Response.json({ error: auth.error }, { status: 401 });
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

  const allMessages: AgentMessage[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const message of runSimulation(personas as any, audience_id, platform, input)) {
          allMessages.push(message);
          controller.enqueue(encoder.encode(JSON.stringify(message) + "\n"));
        }

        const sentiments = allMessages.map((m) => m.sentiment);
        const hostileCount = sentiments.filter((s) => s === "hostile").length;
        const negativeCount = sentiments.filter((s) => s === "negative").length;
        const score =
          hostileCount >= 4 ? "critical" :
          hostileCount + negativeCount >= 5 ? "high" :
          negativeCount >= 3 ? "moderate" : "low";

        const summary = { type: "summary", aggression_score: score, total_messages: allMessages.length };
        controller.enqueue(encoder.encode(JSON.stringify(summary) + "\n"));

        db.from("simulations")
          .insert({ audience_id, platform, input, thread: allMessages, aggression_score: score })
          .then(({ error }) => {
            if (error) console.error("Failed to save simulation:", error.message);
          });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Simulation failed";
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", error: errorMsg }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
