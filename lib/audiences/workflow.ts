import { FatalError } from "workflow";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyTexts } from "./classify";
import { synthesizePersona } from "./synthesize";
import { enrichPersonasWithModel } from "./persona-writer";
import { selectUsefulColumns } from "./select-columns";
import { routeAudience } from "@/lib/models/router";
import { evaluateLinkedInPrivateDataset } from "@/lib/evals/linkedinPrivate";
import {
  DEFAULT_CLASSIFIER_IDS,
  DEFAULT_GENERATOR_ID,
  generatorById,
} from "@/lib/models/registry";
import { MAX_TEXT_CHARS, MIN_TEXT_CHARS, type ParsedRow } from "./parse";
import type { LinkedInPostEvalRow } from "./linkedinExport";
import type { RowScores } from "./classify";

const ROUTER_SAMPLE_SIZE = 12;
const COLUMN_SELECTOR_SAMPLE_SIZE = 5;
// Rows per classify step. Workflow runs these in parallel via Promise.all,
// so each step stays short and resumable on failure.
const CLASSIFY_CHUNK_SIZE = 200;

interface StagedAudience {
  audienceId: string;
  audienceName: string;
  platform: string;
  synthetic: boolean;
  headers: string[];
  rows: ParsedRow[];
}

function pickRandomSample<T>(arr: T[], n: number, seed: number): T[] {
  if (arr.length <= n) return arr.slice();
  // Deterministic LCG so the workflow stays reproducible across replays.
  let s = (seed | 0) || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
  const out: T[] = [];
  const taken = new Set<number>();
  while (out.length < n) {
    const idx = Math.floor(rand() * arr.length);
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

async function loadStaging(audienceId: string): Promise<StagedAudience> {
  "use step";
  console.log(`[audience-workflow] loadStaging ${audienceId}`);
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audience_staging")
    .select("audience_id, rows, headers, synthetic, audience_name, platform")
    .eq("audience_id", audienceId)
    .maybeSingle();
  if (error || !data) {
    throw new FatalError(
      `audience_staging row missing for ${audienceId}: ${error?.message ?? "not found"}`
    );
  }
  return {
    audienceId: data.audience_id,
    audienceName: data.audience_name,
    platform: data.platform,
    synthetic: !!data.synthetic,
    headers: Array.isArray(data.headers) ? (data.headers as string[]) : [],
    rows: Array.isArray(data.rows) ? (data.rows as ParsedRow[]) : [],
  };
}

async function runColumnSelection(
  headers: string[],
  sampleRows: Array<Record<string, string>>
): Promise<{ useful: string[]; reasoning: string; source: "ai" | "fallback" }> {
  "use step";
  console.log(`[audience-workflow] selectColumns headers=${headers.length}`);
  return await selectUsefulColumns({ headers, sampleRows });
}

async function runRouter(
  audienceName: string,
  platform: string,
  textSamples: string[]
) {
  "use step";
  console.log(`[audience-workflow] router platform=${platform}`);
  return await routeAudience({
    audience_name: audienceName,
    platform,
    text_samples: textSamples,
  });
}

async function classifyChunk(
  texts: string[],
  classifierIds: string[]
): Promise<RowScores[]> {
  "use step";
  console.log(`[audience-workflow] classifyChunk size=${texts.length}`);
  return await classifyTexts(texts, classifierIds);
}

async function persistResult({
  audienceId,
  workingRows,
  scored,
  decision,
  classifierIds,
  generatorId,
  platform,
  columnSelection,
}: {
  audienceId: string;
  workingRows: ParsedRow[];
  scored: RowScores[];
  decision: Awaited<ReturnType<typeof routeAudience>>;
  classifierIds: string[];
  generatorId: string;
  platform: string;
  columnSelection: {
    useful: string[];
    reasoning: string;
    source: "ai" | "fallback";
  } | null;
}): Promise<void> {
  "use step";
  console.log(
    `[audience-workflow] persistResult ${audienceId} rows=${workingRows.length}`
  );
  const db = supabaseAdmin();
  const generator = generatorById(generatorId);

  const basePersonas = workingRows.map((row, i) =>
    synthesizePersona(audienceId, row, scored[i] ?? {})
  );
  const personas =
    process.env.ENABLE_PERSONA_WRITER === "true"
      ? await enrichPersonasWithModel(platform, workingRows, basePersonas, scored)
      : basePersonas;

  const { data: existingAudience } = await db
    .from("audiences")
    .select("metadata")
    .eq("id", audienceId)
    .maybeSingle();

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

  const existingMetadata =
    existingAudience &&
    existingAudience.metadata &&
    typeof existingAudience.metadata === "object"
      ? (existingAudience.metadata as Record<string, unknown>)
      : {};
  const linkedInExport =
    existingMetadata.linkedin_export &&
    typeof existingMetadata.linkedin_export === "object"
      ? (existingMetadata.linkedin_export as Record<string, unknown>)
      : null;
  const linkedInPosts = Array.isArray(linkedInExport?.posts)
    ? (linkedInExport.posts as LinkedInPostEvalRow[])
    : [];
  const linkedInEval =
    platform === "linkedin" && linkedInPosts.length > 0
      ? evaluateLinkedInPrivateDataset(personas, linkedInPosts)
      : null;
  const metadata = linkedInExport
    ? {
        ...existingMetadata,
        linkedin_export: { ...linkedInExport, eval: linkedInEval },
      }
    : existingMetadata;

  const { error } = await db
    .from("audiences")
    .update({
      personas,
      metadata,
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
    throw new Error(`Failed to write personas: ${error.message}`);
  }

  await db.from("audience_staging").delete().eq("audience_id", audienceId);
}

async function markFailed(audienceId: string, message: string): Promise<void> {
  "use step";
  console.log(`[audience-workflow] markFailed ${audienceId}: ${message}`);
  const db = supabaseAdmin();
  await db
    .from("audiences")
    .update({ status: "failed", error_message: message.slice(0, 500) })
    .eq("id", audienceId);
}

export async function audienceUploadWorkflow(audienceId: string) {
  "use workflow";
  console.log(`[audience-workflow] start ${audienceId}`);

  try {
    const staged = await loadStaging(audienceId);

    let workingRows = staged.rows;
    let columnSelection:
      | { useful: string[]; reasoning: string; source: "ai" | "fallback" }
      | null = null;

    if (staged.synthetic) {
      const sampleRows = pickRandomSample(
        workingRows.filter((r) => r.fields),
        COLUMN_SELECTOR_SAMPLE_SIZE,
        1
      ).map((r) => r.fields ?? {});

      columnSelection = await runColumnSelection(staged.headers, sampleRows);

      workingRows = workingRows
        .map((row) => {
          if (!row.fields) return row;
          const text = buildTextFromColumns(row.fields, columnSelection!.useful);
          return { ...row, text };
        })
        .filter((row) => row.text.length >= MIN_TEXT_CHARS);

      if (workingRows.length === 0) {
        await markFailed(
          audienceId,
          "Couldn't find enough useful text in this CSV. Try one with bios, descriptions, or messages."
        );
        return;
      }
    }

    const sampleTexts = pickRandomSample(workingRows, ROUTER_SAMPLE_SIZE, 2).map(
      (r) => r.text
    );
    const decision = await runRouter(staged.audienceName, staged.platform, sampleTexts);

    const classifierIds = decision.classifier_ids.length
      ? decision.classifier_ids
      : DEFAULT_CLASSIFIER_IDS;
    const generatorId = decision.generator_id || DEFAULT_GENERATOR_ID;

    const texts = workingRows.map((r) => r.text);
    const chunks: string[][] = [];
    for (let i = 0; i < texts.length; i += CLASSIFY_CHUNK_SIZE) {
      chunks.push(texts.slice(i, i + CLASSIFY_CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk) => classifyChunk(chunk, classifierIds))
    );
    const scored: RowScores[] = chunkResults.flat();

    await persistResult({
      audienceId,
      workingRows,
      scored,
      decision,
      classifierIds,
      generatorId,
      platform: staged.platform,
      columnSelection,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    await markFailed(audienceId, message);
    throw err;
  }
}
