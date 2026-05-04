// Batched HuggingFace Inference API client for the CardiffNLP classifier
// stack used during audience-upload persona synthesis.
//
// We only call sentiment + offensive in v1. Political/emotion/hate are
// added in v2 when the validation panel ships.

const SENTIMENT_MODEL =
  process.env.SENTIMENT_CLASSIFIER_MODEL ||
  "cardiffnlp/twitter-roberta-base-sentiment-latest";
const OFFENSIVE_MODEL =
  process.env.OFFENSIVE_CLASSIFIER_MODEL ||
  "cardiffnlp/twitter-roberta-base-offensive";

const HF_API_URL = "https://api-inference.huggingface.co/models";
const BATCH_SIZE = 32;
const REQUEST_TIMEOUT_MS = 20_000;

export interface RowScores {
  positive: number;
  neutral: number;
  negative: number;
  offensive: number;
}

interface HFLabelScore {
  label: string;
  score: number;
}

function normaliseLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower === "label_0") return "negative";
  if (lower === "label_1") return "neutral";
  if (lower === "label_2") return "positive";
  return lower;
}

function pickScore(scores: HFLabelScore[], target: string): number {
  for (const s of scores) {
    if (normaliseLabel(s.label) === target) return s.score;
  }
  return 0;
}

async function callHFBatch(model: string, inputs: string[]): Promise<HFLabelScore[][] | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${HF_API_URL}/${model}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        inputs,
        options: { wait_for_model: true },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`HF batch call ${model} failed:`, res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = (await res.json()) as HFLabelScore[][] | HFLabelScore[];
    // Single-input non-batched response wraps differently; coerce to batch shape.
    if (Array.isArray(data) && data.length > 0 && !Array.isArray(data[0])) {
      // Most likely a single-row batch (HF sometimes returns flat for size 1).
      return [data as HFLabelScore[]];
    }
    return data as HFLabelScore[][];
  } catch (err) {
    console.warn(`HF batch call ${model} threw:`, err instanceof Error ? err.message : err);
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
 * Classify a list of texts into per-row {positive, neutral, negative, offensive}
 * scores. Failed batches return zeroed neutral defaults so the pipeline keeps
 * moving.
 */
export async function classifyTexts(texts: string[]): Promise<RowScores[]> {
  const batches = chunk(texts, BATCH_SIZE);

  // Run sentiment + offensive batches sequentially per chunk to be polite to
  // the free HF tier, but parallelise the two model calls within a chunk.
  const result: RowScores[] = new Array(texts.length).fill(null).map(() => ({
    positive: 0,
    neutral: 1,
    negative: 0,
    offensive: 0,
  }));

  let cursor = 0;
  for (const batch of batches) {
    const [sentBatch, offBatch] = await Promise.all([
      callHFBatch(SENTIMENT_MODEL, batch),
      callHFBatch(OFFENSIVE_MODEL, batch),
    ]);

    for (let i = 0; i < batch.length; i++) {
      const out: RowScores = {
        positive: 0,
        neutral: 1,
        negative: 0,
        offensive: 0,
      };
      const sentRow = sentBatch?.[i];
      if (sentRow) {
        out.positive = pickScore(sentRow, "positive");
        out.neutral = pickScore(sentRow, "neutral");
        out.negative = pickScore(sentRow, "negative");
      }
      const offRow = offBatch?.[i];
      if (offRow) {
        // CardiffNLP offensive returns "offensive" / "non-offensive"
        const offScore = Math.max(
          pickScore(offRow, "offensive"),
          pickScore(offRow, "label_1")
        );
        out.offensive = offScore;
      }
      result[cursor + i] = out;
    }
    cursor += batch.length;
  }

  return result;
}
