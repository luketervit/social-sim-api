import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { incrementApiKeyTokensUsed, refundApiCredits } from "@/lib/auth";
import { CREDITS_PER_MESSAGE } from "@/lib/credits";
import { runSimulation } from "@/lib/simulation/engine";
import {
  claimNextSimulationJob,
  completeSimulationJob,
  failSimulationJob,
  heartbeatSimulationJob,
  type SimulationJob,
} from "@/lib/simulation/jobs";
import { scoreAggression } from "@/lib/simulation/scoring";
import type { AgentMessage } from "@/lib/simulation/types";

const workerId = process.env.SIMULATION_WORKER_ID || `worker-${randomUUID()}`;
const pollMs = Number(process.env.SIMULATION_QUEUE_POLL_MS || 250);
const concurrency = Number(process.env.SIMULATION_WORKER_CONCURRENCY || 2);
const leaseSeconds = Number(process.env.SIMULATION_JOB_LEASE_SECONDS || 900);
const heartbeatEveryMessages = Number(process.env.SIMULATION_PROGRESS_BATCH || 5);

let running = true;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return inspect(error, { depth: 4, breakLength: 120 });
}

async function loadPersonas(audienceId: string, personaCap?: number | null) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .select("personas")
    .eq("id", audienceId)
    .single();

  if (error || !data) {
    throw new Error(`Audience '${audienceId}' not found`);
  }

  const personas = data.personas as unknown[];
  if (!Array.isArray(personas) || personas.length === 0) {
    throw new Error("Audience has no personas");
  }

  const cappedPersonas =
    typeof personaCap === "number" && personaCap > 0
      ? personas.slice(0, Math.min(personaCap, personas.length))
      : personas;

  return cappedPersonas as any[];
}

async function processJob(job: SimulationJob, claimId: string) {
  const messages: AgentMessage[] = [];
  let refundedCredits = 0;
  let totalTokensUsed = 0;

  try {
    const personas = await loadPersonas(job.audience_id, job.persona_cap);

    for await (const message of runSimulation(
      personas as any,
      job.audience_id,
      job.platform,
      job.input,
      {
        async onAfterMessage(_turn, _round, usage) {
          totalTokensUsed += usage.total_tokens;
        },
      }
    )) {
      messages.push(message);

      if (messages.length === 1 || messages.length % heartbeatEveryMessages === 0) {
        await heartbeatSimulationJob(job.id, claimId, messages, messages.length, leaseSeconds);
      }
    }

    const score = scoreAggression(messages);
    await completeSimulationJob({
      id: job.id,
      workerId: claimId,
      messages,
      aggressionScore: score,
    });
  } catch (error) {
    const unusedCredits = Math.max(0, job.reserved_credits - messages.length * CREDITS_PER_MESSAGE);
    refundedCredits = unusedCredits;

    if (unusedCredits > 0) {
      const refund = await refundApiCredits(job.api_key, unusedCredits);
      if (!refund.ok) {
        console.error("Failed to refund queued simulation credits:", {
          jobId: job.id,
          refundedCredits: unusedCredits,
          refundError: refund.error,
        });
        refundedCredits = 0;
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Simulation failed";
    await failSimulationJob({
      id: job.id,
      workerId: claimId,
      messages,
      errorMessage,
      refundedCredits,
    });

    console.error("Simulation job failed:", {
      jobId: job.id,
      workerId,
      generatedMessages: messages.length,
      totalTokensUsed,
      refundedCredits,
      errorMessage,
    });
  } finally {
    const usageUpdate = await incrementApiKeyTokensUsed(job.api_key, totalTokensUsed);
    if (!usageUpdate.ok) {
      console.error("Failed to persist API key token usage:", {
        jobId: job.id,
        workerId,
        totalTokensUsed,
        usageError: usageUpdate.error,
      });
    }
  }
}

async function workerLoop(slot: number) {
  const claimId = `${workerId}-slot-${slot}`;

  while (running) {
    try {
      const job = await claimNextSimulationJob(claimId, leaseSeconds);

      if (!job) {
        await sleep(pollMs);
        continue;
      }

      console.log("Claimed simulation job", {
        jobId: job.id,
        audienceId: job.audience_id,
        createdAt: job.created_at,
        slot,
      });

      await processJob(job, claimId);
    } catch (error) {
      console.error("Worker loop error:", {
        slot,
        error: describeError(error),
      });
      await sleep(Math.max(500, pollMs));
    }
  }
}

async function main() {
  console.log("Starting simulation worker", {
    workerId,
    concurrency,
    pollMs,
    leaseSeconds,
    heartbeatEveryMessages,
  });

  await Promise.all(Array.from({ length: concurrency }, (_, index) => workerLoop(index + 1)));
}

process.on("SIGINT", () => {
  running = false;
});

process.on("SIGTERM", () => {
  running = false;
});

main().catch((error) => {
  console.error("Worker crashed:", error);
  process.exit(1);
});
