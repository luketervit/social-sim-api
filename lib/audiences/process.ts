import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyTexts } from "./classify";
import { synthesizePersona } from "./synthesize";
import type { ParsedRow } from "./parse";
import { routeAudience } from "@/lib/models/router";
import {
  DEFAULT_CLASSIFIER_IDS,
  DEFAULT_GENERATOR_ID,
  generatorById,
} from "@/lib/models/registry";

export interface ProcessAudienceInput {
  audienceId: string;
  audienceName: string;
  platform: string;
  rows: ParsedRow[];
}

const ROUTER_SAMPLE_SIZE = 12;

function pickRandomSample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  const out: T[] = [];
  const taken = new Set<number>();
  while (out.length < n) {
    const idx = Math.floor(Math.random() * arr.length);
    if (taken.has(idx)) continue;
    taken.add(idx);
    out.push(arr[idx]);
  }
  return out;
}

/**
 * Background worker invoked via Vercel after():
 *  1. Asks Claude (router) which classifiers + generator to use.
 *  2. Runs the chosen classifiers in batches.
 *  3. Synthesizes a Persona per row.
 *  4. Persists the routing decision + generator_model + personas.
 */
export async function processAudienceUpload({
  audienceId,
  audienceName,
  platform,
  rows,
}: ProcessAudienceInput): Promise<void> {
  const db = supabaseAdmin();
  try {
    const sample = pickRandomSample(rows, ROUTER_SAMPLE_SIZE).map((r) => r.text);
    const decision = await routeAudience({
      audience_name: audienceName,
      platform,
      text_samples: sample,
    });

    const classifierIds = decision.classifier_ids.length
      ? decision.classifier_ids
      : DEFAULT_CLASSIFIER_IDS;
    const generatorId = decision.generator_id || DEFAULT_GENERATOR_ID;
    const generator = generatorById(generatorId);

    const texts = rows.map((r) => r.text);
    const scored = await classifyTexts(texts, classifierIds);

    const personas = rows.map((row, i) => synthesizePersona(audienceId, row, scored[i]));

    const { error } = await db
      .from("audiences")
      .update({
        personas,
        status: "ready",
        row_count: personas.length,
        processed_at: new Date().toISOString(),
        error_message: null,
        routing_decision: decision,
        classifier_models: classifierIds,
        generator_model: generator.openrouter_id,
      })
      .eq("id", audienceId);

    if (error) {
      console.error("processAudienceUpload write failed:", { audienceId, error });
      await db
        .from("audiences")
        .update({
          status: "failed",
          error_message: "Failed to save processed audience.",
        })
        .eq("id", audienceId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    console.error("processAudienceUpload error:", { audienceId, error: err });
    await db
      .from("audiences")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
      })
      .eq("id", audienceId);
  }
}
