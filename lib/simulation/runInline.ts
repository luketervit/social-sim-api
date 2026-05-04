import { randomUUID } from "node:crypto";
import { CREDITS_PER_MESSAGE } from "@/lib/credits";
import { incrementApiKeyTokensUsed, refundApiCredits } from "@/lib/auth";
import { runSimulation } from "./engine";
import {
  completeSimulationJob,
  failSimulationJob,
  heartbeatSimulationJob,
  type SimulationJob,
} from "./jobs";
import { scoreAggression } from "./scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AgentMessage } from "./types";
import type { Persona } from "@/lib/schemas";
import { SimulationCapacityError } from "./llm";

const HEARTBEAT_EVERY_MESSAGES = Number(process.env.SIMULATION_PROGRESS_BATCH || 3);
const LEASE_SECONDS = Number(process.env.SIMULATION_JOB_LEASE_SECONDS || 900);

/**
 * Convert raw provider errors into user-readable error messages. Provider
 * 4xx text (rate limits, auth errors, model URLs) must never bleed to the
 * dashboard.
 */
function sanitiseSimulationError(error: unknown): string {
  if (error instanceof SimulationCapacityError) {
    return error.message;
  }
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("rpm") ||
    lower.includes("quota")
  ) {
    return "The simulation hit a temporary capacity limit. Please retry in a moment.";
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("api key")) {
    return "The simulation could not authenticate with the model provider. The team has been notified.";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("network")) {
    return "The simulation timed out talking to the model provider. Please retry.";
  }
  if (message && message.length < 200 && !message.startsWith("{") && !message.includes("http")) {
    return message;
  }
  return "Simulation failed. Please retry in a moment.";
}

async function loadAudience(
  audienceId: string,
  personaCap?: number | null
): Promise<{ personas: Persona[]; generatorModel: string | null }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .select("personas, generator_model")
    .eq("id", audienceId)
    .single();

  if (error || !data) {
    throw new Error(`Audience '${audienceId}' not found`);
  }

  const personas = data.personas as unknown[];
  if (!Array.isArray(personas) || personas.length === 0) {
    throw new Error("Audience has no personas");
  }

  const capped =
    typeof personaCap === "number" && personaCap > 0
      ? personas.slice(0, Math.min(personaCap, personas.length))
      : personas;

  // Defensive: ignore older saved generator_model values that no longer have
  // a working endpoint on OpenRouter (anything ending ":free" or pointing at
  // the paid Dolphin-Mistral that doesn't exist). Fall back to env default.
  let generatorModel: string | null = null;
  if (typeof data.generator_model === "string" && data.generator_model.length > 0) {
    const saved = data.generator_model;
    const broken =
      saved.endsWith(":free") ||
      saved === "cognitivecomputations/dolphin-mistral-24b-venice-edition";
    generatorModel = broken ? null : saved;
  }

  return {
    personas: capped as Persona[],
    generatorModel,
  };
}

async function claimJob(jobId: string, workerId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("simulations")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      claimed_by: workerId,
      lease_expires_at: new Date(Date.now() + LEASE_SECONDS * 1000).toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to claim simulation job inline:", { jobId, error });
    return false;
  }

  return Boolean(data);
}

export async function runSimulationInline(job: SimulationJob): Promise<void> {
  const workerId = `vercel-inline-${randomUUID().slice(0, 8)}`;

  const claimed = await claimJob(job.id, workerId);
  if (!claimed) {
    return;
  }

  const messages: AgentMessage[] = [];
  let totalTokensUsed = 0;
  let refundedCredits = 0;

  try {
    const { personas, generatorModel } = await loadAudience(job.audience_id, job.persona_cap);

    for await (const message of runSimulation(
      personas,
      job.audience_id,
      job.platform,
      job.input,
      {
        generatorModel: generatorModel ?? undefined,
        async onAfterMessage(_turn, _round, usage) {
          totalTokensUsed += usage.total_tokens;
        },
      }
    )) {
      messages.push(message);

      if (messages.length === 1 || messages.length % HEARTBEAT_EVERY_MESSAGES === 0) {
        try {
          await heartbeatSimulationJob(
            job.id,
            workerId,
            messages,
            messages.length,
            LEASE_SECONDS
          );
        } catch (heartbeatError) {
          console.error("Heartbeat failed (continuing):", { jobId: job.id, heartbeatError });
        }
      }
    }

    const score = scoreAggression(messages);
    await completeSimulationJob({
      id: job.id,
      workerId,
      messages,
      aggressionScore: score,
    });
  } catch (error) {
    const unusedCredits = Math.max(
      0,
      job.reserved_credits - messages.length * CREDITS_PER_MESSAGE
    );
    refundedCredits = unusedCredits;

    if (unusedCredits > 0) {
      const refund = await refundApiCredits(job.api_key, unusedCredits);
      if (!refund.ok) {
        refundedCredits = 0;
      }
    }

    const errorMessage = sanitiseSimulationError(error);

    try {
      await failSimulationJob({
        id: job.id,
        workerId,
        messages,
        errorMessage,
        refundedCredits,
      });
    } catch (failError) {
      console.error("Failed to mark simulation failed:", { jobId: job.id, failError });
    }

    console.error("Inline simulation failed:", {
      jobId: job.id,
      generatedMessages: messages.length,
      totalTokensUsed,
      refundedCredits,
      errorMessage,
    });
  } finally {
    if (totalTokensUsed > 0) {
      const usage = await incrementApiKeyTokensUsed(job.api_key, totalTokensUsed);
      if (!usage.ok) {
        console.error("Failed to record token usage:", { jobId: job.id, totalTokensUsed });
      }
    }
  }
}
