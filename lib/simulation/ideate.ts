import OpenAI from "openai";
import { getOpenRouterEnv } from "@/lib/env";

const MODEL =
  process.env.OPENROUTER_VARIATIONS_MODEL ||
  process.env.OPENROUTER_LINKEDIN_MODEL ||
  "qwen/qwen3-235b-a22b-2507";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  _client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: getOpenRouterEnv().OPENROUTER_API_KEY,
  });
  return _client;
}

export interface ViralIdeaInput {
  topic: string;
  context?: string;
  brand?: string;
  platform: "twitter" | "reddit" | "slack" | "linkedin";
  audienceId: string;
}

export interface ViralIdea {
  id: string;
  label: string;
  hook: string;
  post: string;
  rationale: string;
}

const PLATFORM_LIMITS: Record<ViralIdeaInput["platform"], number> = {
  twitter: 280,
  reddit: 520,
  slack: 320,
  linkedin: 1000,
};

const PLATFORM_TONE: Record<ViralIdeaInput["platform"], string> = {
  twitter:
    "Punchy, 1-3 sentences max. No hashtags. Internet voice. The tweet should feel like a real account posted it, not a marketing template.",
  reddit:
    "Title-style first line, then 1-3 sentences of context. Sound like a regular Redditor — flat, specific, slightly self-deprecating where natural. No hashtags.",
  slack:
    "Professional but human, like a senior employee in a company channel. 1-3 sentences. No emoji unless they're load-bearing.",
  linkedin:
    "Real-name voice. 2-5 short sentences, one-line-per-thought broetry style is fine. 0-1 hashtags max. Confident but not corny.",
};

function normalizeIdeaText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function clampPost(text: string, max: number) {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function finalizeIdeas(
  input: ViralIdeaInput,
  ideas: Array<Omit<ViralIdea, "id"> | null | undefined>
) {
  const max = PLATFORM_LIMITS[input.platform];
  const originalNorm = normalizeIdeaText(input.topic);
  const seen = new Set<string>();
  const out: ViralIdea[] = [];

  for (const idea of ideas) {
    if (!idea) continue;
    const post = clampPost(idea.post, max);
    if (!post) continue;
    const normalized = normalizeIdeaText(post);
    if (!normalized || normalized === originalNorm || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push({
      id: `idea-${out.length + 1}`,
      label: idea.label.trim().slice(0, 40) || `Variant ${out.length + 1}`,
      hook: idea.hook.trim().slice(0, 140),
      post,
      rationale: idea.rationale.trim().slice(0, 200),
    });
    if (out.length >= 3) break;
  }

  return out;
}

function safeParseJSON(text: string): unknown {
  const fenced = text.trim().replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(fenced);
  } catch {
    const match = fenced.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isStructuredOutputCompatibilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("response_format") ||
    message.includes("json_schema") ||
    message.includes("structured output") ||
    message.includes("unsupported parameter") ||
    message.includes("require_parameters")
  );
}

async function createCompletion(
  systemPrompt: string,
  userPrompt: string,
  structured: boolean
) {
  const payload: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 1200,
    temperature: 0.85,
  };

  if (structured) {
    payload.response_format = { type: "json_object" };
  }

  return getClient().chat.completions.create(payload as never);
}

export async function generateViralIdeas(
  input: ViralIdeaInput
): Promise<ViralIdea[]> {
  const maxLen = PLATFORM_LIMITS[input.platform];
  const platformTone = PLATFORM_TONE[input.platform];

  const systemPrompt = `You are a copywriter helping someone test 3 alternative drafts of a social post against a simulated audience before they ship the original.

Return JSON only, in this exact shape:
{"ideas":[{"label":"...","hook":"...","post":"...","rationale":"..."}]}

Rules:
- Return EXACTLY 3 ideas, all rewriting the same underlying message.
- Never repeat the original wording, and never return two ideas with the same angle.
- Each idea has its own strategic angle. Suggested angles: sharp/hot take, informational/explainer, curiosity-driven question, contrarian reframe, story/anecdote, frame as data point. Pick 3 that genuinely differ.
- Each "post" is the FULL rewritten draft, ready to paste. NEVER include the user's original text verbatim, NEVER append "Context:" or any meta tag, NEVER mention the audience by name.
- Posts must stay under ${maxLen} characters and feel native to ${input.platform}. ${platformTone}
- Each "label" is 1-3 words naming the angle (e.g. "Hot take", "Insider drop", "Curiosity gap"). Title case. No quotes.
- Each "hook" is ONE sentence under 90 characters describing why this angle works against this audience.
- Each "rationale" is ONE sentence under 160 characters describing what behaviour the angle is testing for.
- No emoji unless the platform demands them. No hashtags unless the platform demands them.`;

  const userPrompt = `Original draft (rewrite this):
"""
${input.topic.trim()}
"""

Platform: ${input.platform}
${input.brand?.trim() ? `Brand voice: ${input.brand.trim()}` : ""}

Return 3 alternative drafts of this same post, each taking a different strategic angle.`;

  let response: Awaited<ReturnType<typeof createCompletion>>;
  try {
    try {
      response = await createCompletion(systemPrompt, userPrompt, true);
    } catch (structuredError) {
      if (!isStructuredOutputCompatibilityError(structuredError)) {
        throw structuredError;
      }
      response = await createCompletion(systemPrompt, userPrompt, false);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Variation generation provider failed: ${message}`);
  }

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  const parsed = safeParseJSON(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Variation model returned invalid JSON.");
  }

  const ideas = (parsed as { ideas?: unknown }).ideas;
  if (!Array.isArray(ideas) || ideas.length === 0) {
    throw new Error("Variation model returned no draft ideas.");
  }

  const cleaned = ideas
    .slice(0, 3)
    .map((raw, index) => {
      const obj = raw as {
        label?: unknown;
        hook?: unknown;
        post?: unknown;
        rationale?: unknown;
      };
      const post = typeof obj.post === "string" ? obj.post.trim() : "";
      if (!post) return null;
      return {
        label:
          typeof obj.label === "string" && obj.label.trim().length > 0
            ? obj.label.trim().slice(0, 40)
            : `Variant ${index + 1}`,
        hook:
          typeof obj.hook === "string" ? obj.hook.trim().slice(0, 140) : "",
        post: post.slice(0, maxLen),
        rationale:
          typeof obj.rationale === "string"
            ? obj.rationale.trim().slice(0, 200)
            : "",
      };
    })
    .filter((v): v is Omit<ViralIdea, "id"> => v !== null);

  const finalized = finalizeIdeas(input, cleaned);
  if (finalized.length < 3) {
    throw new Error(
      `Variation model returned only ${finalized.length} distinct drafts.`
    );
  }

  return finalized;
}
