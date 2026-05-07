import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicEnv } from "@/lib/env";

const MODEL = "claude-haiku-4-5-20251001";

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const env = getAnthropicEnv();
  if (!env) return null;
  _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
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

function localTemplateIdeas(input: ViralIdeaInput): Omit<ViralIdea, "id">[] {
  const raw = input.topic.trim().replace(/\s+/g, " ");
  const base = raw.replace(/[.!?\s]+$/, "");

  return [
    {
      label: "Sharp take",
      hook: "Lead with a more polarizing framing to trigger reaction fast.",
      post: `Hot take: ${base}.`,
      rationale: "Tests whether a stronger opinion framing gets more immediate engagement.",
    },
    {
      label: "Curiosity gap",
      hook: "Turn the claim into an open loop people want explained.",
      post: `${base}. The interesting part is what that actually says about timing, leverage, and luck.`,
      rationale: "Tests whether intrigue beats certainty for this audience.",
    },
    {
      label: "Story frame",
      hook: "Make it feel like the start of a story instead of a headline.",
      post: `A short version of the story: ${base}. What happened next matters more than the headline.`,
      rationale: "Tests whether narrative framing feels more native than a blunt claim.",
    },
    {
      label: "Context drop",
      hook: "Add a little interpretation so the post does more than state the fact.",
      post: `${base}. On its own that sounds impressive. In practice it mostly shows how weird startup timing can be.`,
      rationale: "Tests whether extra context improves credibility and depth.",
    },
  ];
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

  if (out.length >= 3) return out;

  for (const idea of localTemplateIdeas(input)) {
    const post = clampPost(idea.post, max);
    const normalized = normalizeIdeaText(post);
    if (!normalized || normalized === originalNorm || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push({
      id: `idea-${out.length + 1}`,
      label: idea.label,
      hook: idea.hook,
      post,
      rationale: idea.rationale,
    });
    if (out.length >= 3) break;
  }

  return out;
}

function fallbackIdeas(input: ViralIdeaInput): ViralIdea[] {
  return finalizeIdeas(input, localTemplateIdeas(input));
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

export async function generateViralIdeas(
  input: ViralIdeaInput
): Promise<ViralIdea[]> {
  const client = getClient();
  if (!client) return fallbackIdeas(input);

  const maxLen = PLATFORM_LIMITS[input.platform];
  const platformTone = PLATFORM_TONE[input.platform];

  const systemPrompt = `You are a copywriter helping someone test 3 alternative drafts of a social post against a simulated audience before they ship the original.

Return JSON only, in this exact shape:
{"ideas":[{"label":"...","hook":"...","post":"...","rationale":"..."}]}

Rules:
- Return EXACTLY 3 ideas, all rewriting the same underlying message — never the same wording, never the same angle.
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

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: 0.85,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("\n");

    const parsed = safeParseJSON(text);
    if (!parsed || typeof parsed !== "object") return fallbackIdeas(input);

    const ideas = (parsed as { ideas?: unknown }).ideas;
    if (!Array.isArray(ideas) || ideas.length === 0) return fallbackIdeas(input);

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

    return finalizeIdeas(input, cleaned);
  } catch (err) {
    console.error(
      "generateViralIdeas failed:",
      err instanceof Error ? err.message : err
    );
    return fallbackIdeas(input);
  }
}
