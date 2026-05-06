import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyTexts } from "./classify";
import { synthesizePersona } from "./synthesize";
import { enrichPersonasWithModel } from "./persona-writer";
import { MAX_TEXT_CHARS, MIN_TEXT_CHARS, type ParsedRow } from "./parse";
import { selectUsefulColumns } from "./select-columns";
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
  /** Original column headers from the upload. */
  headers: string[];
  /** True when the upload had no recognised text column and AI must pick. */
  synthetic: boolean;
}

const ROUTER_SAMPLE_SIZE = 12;
const COLUMN_SELECTOR_SAMPLE_SIZE = 5;

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

function buildTextFromColumns(
  fields: Record<string, string>,
  columns: string[]
): string {
  const parts: string[] = [];
  for (const column of columns) {
    const value = fields[column];
    if (typeof value !== "string" || value.length === 0) continue;
    parts.push(`${column}: ${value}`);
  }
  return parts.join(" · ").slice(0, MAX_TEXT_CHARS);
}

/**
 * Background worker invoked via Vercel after():
 *  1. (Synthetic uploads only) Asks Claude which columns carry signal,
 *     re-derives each row's text from those columns, and drops rows whose
 *     selected text is too short.
 *  2. Asks the router which classifiers + generator to use.
 *  3. Runs the chosen classifiers in batches.
 *  4. Synthesises a Persona per row.
 *  5. Persists the routing decision + generator_model + personas.
 */
export async function processAudienceUpload({
  audienceId,
  audienceName,
  platform,
  rows,
  headers,
  synthetic,
}: ProcessAudienceInput): Promise<void> {
  const db = supabaseAdmin();
  try {
    let workingRows = rows;
    let columnSelection: {
      useful: string[];
      reasoning: string;
      source: "ai" | "fallback";
    } | null = null;

    if (synthetic) {
      const sampleRows = pickRandomSample(
        workingRows.filter((r) => r.fields),
        COLUMN_SELECTOR_SAMPLE_SIZE
      ).map((r) => r.fields ?? {});

      columnSelection = await selectUsefulColumns({
        headers,
        sampleRows,
      });

      workingRows = workingRows
        .map((row) => {
          if (!row.fields) return row;
          const text = buildTextFromColumns(row.fields, columnSelection!.useful);
          return { ...row, text };
        })
        .filter((row) => row.text.length >= MIN_TEXT_CHARS);

      if (workingRows.length === 0) {
        await db
          .from("audiences")
          .update({
            status: "failed",
            error_message:
              "Couldn't find enough useful text in this CSV. Try one with bios, descriptions, or messages.",
          })
          .eq("id", audienceId);
        return;
      }
    }

    const sample = pickRandomSample(workingRows, ROUTER_SAMPLE_SIZE).map(
      (r) => r.text
    );
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

    const texts = workingRows.map((r) => r.text);
    const scored = await classifyTexts(texts, classifierIds);

    const basePersonas = workingRows.map((row, i) =>
      synthesizePersona(audienceId, row, scored[i])
    );
    const personas =
      process.env.ENABLE_PERSONA_WRITER === "true"
        ? await enrichPersonasWithModel(
            platform,
            workingRows,
            basePersonas,
            scored
          )
        : basePersonas;

    // Surface the column selection alongside the existing routing decision so
    // the audience tile's "Routing" disclosure shows what got picked and why.
    const routingDecision = columnSelection
      ? {
          ...decision,
          column_selection: {
            useful_columns: columnSelection.useful,
            reasoning: columnSelection.reasoning,
            source: columnSelection.source,
          },
        }
      : decision;

    const { error } = await db
      .from("audiences")
      .update({
        personas,
        status: "ready",
        row_count: personas.length,
        processed_at: new Date().toISOString(),
        error_message: null,
        routing_decision: routingDecision,
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
