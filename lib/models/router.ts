import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicEnv } from "@/lib/env";
import {
  CLASSIFIERS,
  DEFAULT_CLASSIFIER_IDS,
  DEFAULT_GENERATOR_ID,
  GENERATORS,
  findClassifier,
  findGenerator,
} from "./registry";

export interface RoutingDecision {
  classifier_ids: string[];
  generator_id: string;
  reasoning: string;
  vocabulary_seeds: string[];
  /** Whether the decision came from Claude or fell back to defaults. */
  source: "router" | "fallback";
}

export interface RoutingInput {
  audience_name: string;
  platform: string; // "twitter" | "reddit" | "slack" — what the user wants to simulate
  text_samples: string[]; // up to ~12 short rows from the upload
}

const ROUTER_MODEL = "claude-haiku-4-5-20251001";

function buildRegistryPrompt(): string {
  const generators = GENERATORS.map(
    (g) =>
      `  - id: ${g.id}\n    languages: ${g.languages.join(",")}\n    refusal: ${g.refusal_posture}\n    cost/1M_out: $${g.output_cost_per_million.toFixed(2)}\n    strengths: ${g.task_strengths.join(", ")}\n    notes: ${g.notes}`
  ).join("\n\n");

  const classifiers = CLASSIFIERS.map(
    (c) =>
      `  - id: ${c.id}\n    field: ${c.field}\n    languages: ${c.languages.join(",")}\n    notes: ${c.notes}`
  ).join("\n\n");

  return `You are a routing model for Atharias, a multi-agent social-discourse simulator. You pick which classifiers to run on a user's uploaded data and which generator to use when simulating discourse.

GENERATORS (pick exactly one id):

${generators}

CLASSIFIERS (pick 2 to 5 ids — sentiment is required):

${classifiers}

ROUTING RULES:
- For corporate / Slack / internal-comms / professional-email simulations, pick an aligned generator (Claude Haiku, Claude Sonnet, Llama 3.3 70B). RLHF politeness is realistic in those domains.
- For X / Twitter / Reddit / Discord / gaming / political / community simulations where hostility is expected, pick an uncensored generator (Dolphin-Mistral 24B Venice or Dolphin-Llama3 8B). Aligned models WILL refuse and ruin the sim.
- For non-English or multilingual data, prefer multilingual classifiers and generators (Qwen 3, Mistral Small, Claude).
- Skip the political_leaning classifier unless the data is clearly politically inflected. It produces noise on product/brand data.
- Skip the formality classifier unless the platform is slack or internal-comms.
- For long-form content (Reddit posts, support tickets, reviews) prefer the long-form sentiment + toxicity classifiers over Twitter-specific ones.
- vocabulary_seeds: extract 3–8 specific words/phrases from the user's text that should bias the generator's vocabulary (community jargon, partisan keywords, brand names, slang). NOT generic English.

Return ONLY valid JSON matching this schema, no prose:
{
  "classifier_ids": ["..."],
  "generator_id": "...",
  "reasoning": "<one short paragraph explaining your choices>",
  "vocabulary_seeds": ["...", "..."]
}`;
}

function buildUserPrompt(input: RoutingInput): string {
  const samplePreview = input.text_samples
    .slice(0, 12)
    .map((t, i) => `${i + 1}. "${t.replace(/"/g, "'").slice(0, 280)}"`)
    .join("\n");

  return `Audience name: ${input.audience_name}
Simulation platform: ${input.platform}

Sample of the uploaded data (${input.text_samples.length} total rows):
${samplePreview}

Pick the best classifier set, generator, and 3–8 vocabulary seeds extracted from these samples.`;
}

function fallback(reason: string): RoutingDecision {
  return {
    classifier_ids: DEFAULT_CLASSIFIER_IDS,
    generator_id: DEFAULT_GENERATOR_ID,
    reasoning: `Fallback: ${reason}`,
    vocabulary_seeds: [],
    source: "fallback",
  };
}

function safeParseJSON(text: string): unknown {
  // Claude sometimes wraps JSON in fences. Strip and parse.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Last-ditch: try to find a JSON object inside the text.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validateDecision(parsed: unknown): RoutingDecision | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const classifierIds = Array.isArray(obj.classifier_ids)
    ? (obj.classifier_ids.filter((c) => typeof c === "string") as string[])
    : [];
  const validClassifiers = classifierIds.filter((id) => findClassifier(id) !== null);
  // Sentiment is mandatory — backfill if Claude omitted.
  if (!validClassifiers.some((id) => findClassifier(id)?.field === "sentiment")) {
    validClassifiers.unshift("sentiment_en_twitter");
  }
  if (validClassifiers.length === 0) return null;

  const generatorId = typeof obj.generator_id === "string" ? obj.generator_id : null;
  if (!generatorId || !findGenerator(generatorId)) return null;

  const reasoning =
    typeof obj.reasoning === "string" && obj.reasoning.trim().length > 0
      ? obj.reasoning.trim().slice(0, 800)
      : "Routing decision returned no reasoning.";

  const vocab = Array.isArray(obj.vocabulary_seeds)
    ? (obj.vocabulary_seeds
        .filter((v) => typeof v === "string")
        .map((v) => (v as string).trim())
        .filter((v) => v.length > 0 && v.length < 60) as string[])
    : [];

  return {
    classifier_ids: validClassifiers.slice(0, 5),
    generator_id: generatorId,
    reasoning,
    vocabulary_seeds: vocab.slice(0, 8),
    source: "router",
  };
}

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const env = getAnthropicEnv();
  if (!env) return null;
  _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

export async function routeAudience(input: RoutingInput): Promise<RoutingDecision> {
  const client = getClient();
  if (!client) {
    return fallback("ANTHROPIC_API_KEY not configured.");
  }

  if (input.text_samples.length === 0) {
    return fallback("No text samples to route on.");
  }

  try {
    const response = await client.messages.create({
      model: ROUTER_MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      system: buildRegistryPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("\n");

    const parsed = safeParseJSON(text);
    const decision = validateDecision(parsed);
    if (!decision) {
      console.warn("Router returned unparseable decision:", text.slice(0, 400));
      return fallback("Router returned unparseable decision.");
    }
    return decision;
  } catch (err) {
    console.error("Router call failed:", err instanceof Error ? err.message : err);
    return fallback("Router call failed.");
  }
}
