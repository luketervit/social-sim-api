import type { AgentMessage } from "./types";

type Sentiment = AgentMessage["sentiment"];

// Dissertation §3.6.1: classify generated text with the SAME models used for
// agent construction (Twitter-RoBERTa stack). For Atharias' production path we
// only call sentiment + offensive — political/emotion/hate are added in v2 when
// the validation panel ships.
//
// CardiffNLP labels:
//   sentiment-latest → ["negative", "neutral", "positive"]
//   offensive        → ["non-offensive", "offensive"]
//
// We map negative + offensive>=0.5 → "hostile" (Atharias' fourth band).

const SENTIMENT_MODEL =
  process.env.SENTIMENT_CLASSIFIER_MODEL ||
  "cardiffnlp/twitter-roberta-base-sentiment-latest";
const OFFENSIVE_MODEL =
  process.env.OFFENSIVE_CLASSIFIER_MODEL ||
  "cardiffnlp/twitter-roberta-base-offensive";

const HF_API_URL = "https://api-inference.huggingface.co/models";
const REQUEST_TIMEOUT_MS = 8000;

interface HFLabelScore {
  label: string;
  score: number;
}

async function callHuggingFace(model: string, text: string): Promise<HFLabelScore[] | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${HF_API_URL}/${model}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        inputs: text.slice(0, 512),
        options: { wait_for_model: true },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Cold start (503) or rate limit (429) — caller falls back gracefully.
      return null;
    }

    const data = (await res.json()) as HFLabelScore[][] | HFLabelScore[];
    // HF returns nested arrays for single-input requests
    const flat = Array.isArray(data[0]) ? (data[0] as HFLabelScore[]) : (data as HFLabelScore[]);
    if (!Array.isArray(flat) || flat.length === 0) return null;
    return flat;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function pickTopLabel(scores: HFLabelScore[]): { label: string; score: number } {
  let best = scores[0];
  for (const s of scores) {
    if (s.score > best.score) best = s;
  }
  return best;
}

function findLabel(scores: HFLabelScore[], label: string): number {
  const lower = label.toLowerCase();
  for (const s of scores) {
    if (s.label.toLowerCase() === lower) return s.score;
  }
  return 0;
}

/**
 * Classify a generated message into one of {hostile, negative, neutral, positive}.
 * Falls back to `fallback` if the API is unavailable.
 */
export async function classifySentiment(
  text: string,
  fallback: Sentiment
): Promise<Sentiment> {
  const trimmed = text.trim();
  if (trimmed.length < 3) return fallback;

  // Run sentiment + offensive in parallel.
  const [sentimentScores, offensiveScores] = await Promise.all([
    callHuggingFace(SENTIMENT_MODEL, trimmed),
    callHuggingFace(OFFENSIVE_MODEL, trimmed),
  ]);

  if (!sentimentScores) return fallback;

  const top = pickTopLabel(sentimentScores);
  const label = top.label.toLowerCase();
  // CardiffNLP sentiment-latest sometimes returns LABEL_0/1/2 instead of named labels.
  const namedLabel =
    label === "label_0" ? "negative" :
    label === "label_1" ? "neutral" :
    label === "label_2" ? "positive" :
    label;

  // Promote to hostile if the message is also flagged offensive.
  const offensiveScore = offensiveScores
    ? Math.max(
        findLabel(offensiveScores, "offensive"),
        findLabel(offensiveScores, "label_1")
      )
    : 0;

  if (namedLabel === "negative" && offensiveScore >= 0.5) {
    return "hostile";
  }

  if (namedLabel === "positive") return "positive";
  if (namedLabel === "neutral") return "neutral";
  if (namedLabel === "negative") return "negative";

  return fallback;
}
