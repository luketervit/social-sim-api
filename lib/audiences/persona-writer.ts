import OpenAI from "openai";
import type { Persona } from "@/lib/schemas";
import { getOpenRouterEnv } from "@/lib/env";
import type { ParsedRow } from "./parse";
import type { RowScores } from "./classify";

const MODEL =
  process.env.PERSONA_WRITER_MODEL || "qwen/qwen3-32b";
const MAX_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 15_000;

interface PersonaWriteResult {
  archetype: string;
  core_values: string[];
  persona_prompt: string;
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

function clampText(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function topLabel(map: Record<string, number> | undefined): string | null {
  if (!map) return null;
  let bestLabel: string | null = null;
  let bestScore = -1;
  for (const [label, score] of Object.entries(map)) {
    if (score > bestScore) {
      bestLabel = label;
      bestScore = score;
    }
  }
  return bestLabel;
}

function summariseScores(scores: RowScores) {
  return {
    dominant_sentiment: topLabel(scores.sentiment),
    dominant_emotion: topLabel(scores.emotion),
    dominant_political: topLabel(scores.political),
    dominant_formality: topLabel(scores.formality),
    offensive: scores.offensive?.offensive ?? 0,
    hate: scores.hate?.hate ?? 0,
    toxicity: scores.toxicity?.toxic ?? 0,
  };
}

function buildUserPrompt(
  platform: string,
  row: ParsedRow,
  persona: Persona,
  scores: RowScores
) {
  const role =
    row.fields?.position ??
    row.fields?.Position ??
    row.fields?.title ??
    row.fields?.Title ??
    null;

  const payload = {
    platform,
    current_archetype: persona.archetype,
    reactivity_baseline: Number(persona.reactivity_baseline.toFixed(2)),
    sophistication: Number(persona.sophistication.toFixed(2)),
    brand_affinity: Number(persona.brand_affinity.toFixed(2)),
    current_core_values: persona.core_values.slice(0, 5),
    role_hint: role ? clampText(role, 80) : null,
    keyword_hints: persona.core_values.slice(0, 5),
    classifier_summary: summariseScores(scores),
  };

  return `Write a de-identified synthetic audience persona from these structured traits.

Constraints:
- Never mention any real names, companies, products, URLs, emails, locations, or unique identifiers.
- Never mention scores, probabilities, classifiers, or that these are inferred traits.
- Keep it specific and human, not corporate or generic.
- The persona_prompt should describe posting voice, likely concerns, rhetorical style, and default reaction posture.
- The persona is an audience member reacting to posts, not a brand spokesperson.

Structured traits:
${JSON.stringify(payload, null, 2)}`;
}

function parseJsonObject(text: string): PersonaWriteResult | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersonaWriteResult;
  } catch {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenceMatch?.[1]?.trim() ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    if (!candidate) return null;
    try {
      return JSON.parse(candidate) as PersonaWriteResult;
    } catch {
      return null;
    }
  }
}

async function writeOne(
  platform: string,
  row: ParsedRow,
  persona: Persona,
  scores: RowScores
): Promise<Persona> {
  try {
    const response = (await Promise.race([
      getClient().chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You create de-identified synthetic audience personas for a social discourse simulator.",
          },
          {
            role: "user",
            content: buildUserPrompt(platform, row, persona, scores),
          },
        ],
        temperature: 0.5,
        max_tokens: 360,
        response_format: {
          type: "json_object",
        },
      } as never),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Persona writer timed out after ${REQUEST_TIMEOUT_MS}ms`)),
          REQUEST_TIMEOUT_MS
        )
      ),
    ])) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      return persona;
    }

    const parsed = parseJsonObject(content);
    if (!parsed) {
      return persona;
    }
    const archetype = clampText(parsed.archetype || persona.archetype, 80);
    const coreValues = Array.isArray(parsed.core_values)
      ? parsed.core_values
          .filter((value) => typeof value === "string")
          .map((value) => clampText(value, 40))
          .filter((value) => value.length > 0)
          .slice(0, 5)
      : persona.core_values;
    const personaPrompt = clampText(
      parsed.persona_prompt || persona.persona_prompt,
      500
    );

    return {
      ...persona,
      archetype: archetype || persona.archetype,
      core_values: coreValues.length > 0 ? coreValues : persona.core_values,
      persona_prompt: personaPrompt || persona.persona_prompt,
    };
  } catch (err) {
    console.warn(
      "persona writer failed:",
      err instanceof Error ? err.message : err
    );
    return persona;
  }
}

export async function enrichPersonasWithModel(
  platform: string,
  rows: ParsedRow[],
  personas: Persona[],
  scores: RowScores[]
): Promise<Persona[]> {
  const output = [...personas];
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= output.length) return;
      output[index] = await writeOne(
        platform,
        rows[index],
        output[index],
        scores[index] ?? {}
      );
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, output.length) },
    () => worker()
  );
  await Promise.all(workers);
  return output;
}
