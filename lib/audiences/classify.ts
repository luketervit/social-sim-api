// Generalised classifier dispatcher. Runs whichever HuggingFace classifiers
// the router selected, returns a per-row score record keyed by classifier
// field. The downstream synthesizer reads only the fields that are present.

import { classifiersByIds, type ClassifierField, type ClassifierModel } from "@/lib/models/registry";

const HF_API_URL = "https://api-inference.huggingface.co/models";
const BATCH_SIZE = 32;
const REQUEST_TIMEOUT_MS = 20_000;

export type RowScores = Partial<Record<ClassifierField, Record<string, number>>>;

interface HFLabelScore {
  label: string;
  score: number;
}

function normaliseLabel(label: string): string {
  const lower = label.toLowerCase();
  // CardiffNLP returns LABEL_0/1/2 for some checkpoints
  if (lower === "label_0") return "negative";
  if (lower === "label_1") return "neutral";
  if (lower === "label_2") return "positive";
  return lower;
}

function rowToMap(row: HFLabelScore[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of row) {
    out[normaliseLabel(s.label)] = s.score;
  }
  return out;
}

async function callHFBatch(
  hfModel: string,
  inputs: string[]
): Promise<HFLabelScore[][] | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${HF_API_URL}/${hfModel}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        inputs,
        options: { wait_for_model: true },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`HF batch ${hfModel} failed:`, res.status);
      return null;
    }

    const data = (await res.json()) as HFLabelScore[][] | HFLabelScore[];
    if (Array.isArray(data) && data.length > 0 && !Array.isArray(data[0])) {
      return [data as HFLabelScore[]];
    }
    return data as HFLabelScore[][];
  } catch (err) {
    console.warn(`HF batch ${hfModel} threw:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Run the chosen classifier set on every text. Returns a per-row map of
 * {field → {label → score}}. If a classifier fails, that field is omitted
 * from rows in its batch — synthesizer treats missing fields as "unknown".
 */
export async function classifyTexts(
  texts: string[],
  classifierIds: string[]
): Promise<RowScores[]> {
  const classifiers = classifiersByIds(classifierIds);
  if (classifiers.length === 0) return texts.map(() => ({}));

  // De-dupe by HF model id so we don't call the same checkpoint twice
  // for fields that share a checkpoint.
  const byModel = new Map<string, ClassifierModel[]>();
  for (const c of classifiers) {
    const list = byModel.get(c.hf_model) ?? [];
    list.push(c);
    byModel.set(c.hf_model, list);
  }

  const rows: RowScores[] = texts.map(() => ({}));
  const batches = chunk(texts, BATCH_SIZE);

  let cursor = 0;
  for (const batch of batches) {
    // Call every distinct HF model in parallel within a chunk.
    const results = await Promise.all(
      Array.from(byModel.keys()).map(async (hfModel) => {
        const out = await callHFBatch(hfModel, batch);
        return { hfModel, out };
      })
    );

    for (let i = 0; i < batch.length; i++) {
      for (const { hfModel, out } of results) {
        const row = out?.[i];
        if (!row) continue;
        const labelMap = rowToMap(row);
        // Each classifier registered against this hfModel claims a field.
        for (const cls of byModel.get(hfModel) ?? []) {
          rows[cursor + i][cls.field] = labelMap;
        }
      }
    }
    cursor += batch.length;
  }

  return rows;
}
