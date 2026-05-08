import OpenAI from "openai";
import {
  classifiersByIds,
  type ClassifierField,
  type ClassifierModel,
} from "@/lib/models/registry";
import { getOpenRouterEnv } from "@/lib/env";

const MODEL =
  process.env.OPENROUTER_CLASSIFIER_MODEL || "google/gemini-2.5-flash";
const BATCH_SIZE = 20;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 20_000;
const BATCH_CONCURRENCY = Number(
  process.env.OPENROUTER_CLASSIFIER_CONCURRENCY || 8
);

export type RowScores = Partial<Record<ClassifierField, Record<string, number>>>;

interface FieldInference {
  label: string | null;
  confidence: number | null;
}

interface RowInference {
  sentiment?: FieldInference | null;
  emotion?: FieldInference | null;
  offensive?: FieldInference | null;
  hate?: FieldInference | null;
  political?: FieldInference | null;
  toxicity?: FieldInference | null;
  formality?: FieldInference | null;
}

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  _client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: getOpenRouterEnv().OPENROUTER_API_KEY,
  });
  return _client;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function normaliseLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function labelsForField(field: ClassifierField): string[] {
  switch (field) {
    case "sentiment":
      return ["positive", "neutral", "negative"];
    case "emotion":
      return ["anger", "joy", "optimism", "sadness", "none"];
    case "offensive":
      return ["offensive", "not_offensive"];
    case "hate":
      return ["hate", "not_hate"];
    case "political":
      return ["left", "center", "right", "none"];
    case "toxicity":
      return ["toxic", "not_toxic"];
    case "formality":
      return ["formal", "informal", "neutral"];
  }
}

function buildSchema(fields: ClassifierField[]) {
  const fieldProps: Record<string, unknown> = {};
  for (const field of fields) {
    fieldProps[field] = {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            label: {
              type: "string",
              enum: labelsForField(field),
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
          },
          required: ["label", "confidence"],
        },
        {
          type: "null",
        },
      ],
    };
  }

  return {
    name: "audience_trait_batch",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: fieldProps,
            required: fields,
          },
        },
      },
      required: ["rows"],
    },
  } as const;
}

function buildPrompt(fields: ClassifierField[], batch: string[]) {
  return `Infer latent audience traits for each row of text. The inputs may be LinkedIn job titles, bios, customer notes, short comments, or other thin audience descriptors.

You are NOT classifying the literal text tone alone. You are inferring the likely communication style and reaction posture of the person represented by each row.

Field guidance:
- sentiment: baseline stance toward bold claims or product announcements
- emotion: likely default emotional register
- offensive: likelihood of blunt or abrasive wording
- hate: likelihood of identity-targeted hostility; use sparingly
- political: only if there is a clear ideological signal, otherwise none
- toxicity: likelihood of hostile or corrosive discourse
- formality: expected register if this person posts publicly

Rules:
- Return one row result per input row, in the same order.
- If evidence is weak, still make the least speculative estimate and use low confidence.
- For political, use "none" unless the signal is genuinely present.
- For hate, default to "not_hate" unless there is a strong reason otherwise.
- Do not output prose.

Requested fields: ${fields.join(", ")}

Rows:
${batch.map((text, index) => `${index + 1}. ${JSON.stringify(text)}`).join("\n")}`;
}

function parseResponse(
  content: string,
  fields: ClassifierField[],
  batchLength: number
): RowInference[] | null {
  const raw = content.trim();
  if (!raw) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate =
      fenceMatch?.[1]?.trim() ??
      raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    if (!candidate) return null;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;
  const rows = (parsed as { rows?: unknown }).rows;
  if (!Array.isArray(rows) || rows.length !== batchLength) return null;

  return rows.map((row) => {
    if (!row || typeof row !== "object") return {};
    const out: RowInference = {};
    for (const field of fields) {
      const value = (row as Record<string, unknown>)[field];
      if (value === null) {
        out[field] = null;
        continue;
      }
      if (!value || typeof value !== "object") continue;
      out[field] = {
        label: normaliseLabel((value as { label?: unknown }).label),
        confidence: clampConfidence((value as { confidence?: unknown }).confidence),
      };
    }
    return out;
  });
}

function fieldInferenceToMap(
  field: ClassifierField,
  inference: FieldInference | null | undefined
): Record<string, number> | null {
  if (!inference?.label) return null;
  const confidence = inference.confidence ?? 0.5;
  switch (field) {
    case "sentiment":
      return {
        positive: inference.label === "positive" ? confidence : 0,
        neutral: inference.label === "neutral" ? confidence : 0,
        negative: inference.label === "negative" ? confidence : 0,
      };
    case "emotion":
      if (inference.label === "none") return null;
      return { [inference.label]: confidence };
    case "offensive":
      return {
        offensive: inference.label === "offensive" ? confidence : 0,
        not_offensive: inference.label === "not_offensive" ? confidence : 0,
      };
    case "hate":
      return {
        hate: inference.label === "hate" ? confidence : 0,
        not_hate: inference.label === "not_hate" ? confidence : 0,
      };
    case "political":
      if (inference.label === "none") return null;
      return { [inference.label]: confidence };
    case "toxicity":
      return {
        toxic: inference.label === "toxic" ? confidence : 0,
        not_toxic: inference.label === "not_toxic" ? confidence : 0,
      };
    case "formality":
      if (inference.label === "neutral") return { neutral: confidence };
      return { [inference.label]: confidence };
  }
}

async function inferBatch(
  batch: string[],
  fields: ClassifierField[]
): Promise<RowInference[] | null> {
  const schema = buildSchema(fields);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await getClient().chat.completions.create(
        {
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You infer audience traits for persona synthesis in a social discourse simulator.",
            },
            {
              role: "user",
              content: buildPrompt(fields, batch),
            },
          ],
          temperature: 0.2,
          max_tokens: Math.max(400, batch.length * 90),
          response_format: {
            type: "json_schema",
            json_schema: schema,
          },
          provider: {
            require_parameters: true,
          },
        } as never,
        {
          signal: controller.signal,
        }
      );

      const content = response.choices[0]?.message?.content?.trim() ?? "";
      const parsed = parseResponse(content, fields, batch.length);
      if (parsed) return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`OpenRouter classify batch failed (${attempt + 1}/${MAX_RETRIES + 1}):`, message);
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

/**
 * OpenRouter-backed trait inference. This replaces the old Hugging Face
 * checkpoint bank with a single structured batch call that infers the same
 * downstream fields from the uploaded rows directly.
 */
export async function classifyTexts(
  texts: string[],
  classifierIds: string[]
): Promise<RowScores[]> {
  const classifiers = classifiersByIds(classifierIds);
  if (classifiers.length === 0) return texts.map(() => ({}));

  const fields = Array.from(
    new Set(classifiers.map((classifier: ClassifierModel) => classifier.field))
  );
  const rows: RowScores[] = texts.map(() => ({}));
  const batches = chunk(texts, BATCH_SIZE);

  const offsets: number[] = [];
  let running = 0;
  for (const batch of batches) {
    offsets.push(running);
    running += batch.length;
  }

  const concurrency = Math.max(1, BATCH_CONCURRENCY);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= batches.length) return;
      const batch = batches[idx];
      const offset = offsets[idx];
      const inferred = await inferBatch(batch, fields);
      if (!inferred) continue;
      for (let i = 0; i < batch.length; i += 1) {
        const result = inferred[i] ?? {};
        for (const field of fields) {
          const mapped = fieldInferenceToMap(field, result[field]);
          if (mapped) rows[offset + i][field] = mapped;
        }
      }
    }
  });
  await Promise.all(workers);

  return rows;
}
