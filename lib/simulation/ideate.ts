import OpenAI from "openai";
import { getEnv } from "@/lib/env";

let client: OpenAI | null = null;

function getClient() {
  if (client) return client;

  client = new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: getEnv().DEEPSEEK_API_KEY,
  });

  return client;
}

export interface ViralIdeaInput {
  topic: string;
  context?: string;
  brand?: string;
  platform: "twitter" | "reddit" | "slack";
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
};

function fallbackIdeas({
  topic,
  context,
  brand,
  platform,
}: ViralIdeaInput): ViralIdea[] {
  const brandPrefix = brand?.trim() ? `${brand.trim()} ` : "";
  const contextSuffix = context?.trim() ? ` Context: ${context.trim()}` : "";
  const maxLen = PLATFORM_LIMITS[platform];

  const variants = [
    {
      label: "Hot take",
      hook: "Lead with a strong opinion to invite pushback quickly.",
      post: `${brandPrefix}hot take: ${topic} is going to split the internet faster than people expect.${contextSuffix}`.trim(),
      rationale: "Useful when you want to test whether a sharp claim triggers ridicule or rallying behavior.",
    },
    {
      label: "Insider drop",
      hook: "Frame it like new information people will repeat.",
      post: `${brandPrefix}we've been hearing the same thing all day: ${topic}. If this holds, the conversation is going to move fast.${contextSuffix}`.trim(),
      rationale: "Good for measuring how rumor-like framing amplifies urgency and quote-post behavior.",
    },
    {
      label: "Question bait",
      hook: "Ask the audience to take a side instead of just reading.",
      post: `${brandPrefix}${topic} feels like a turning point. Are people overreacting, or is this actually the start of something bigger?${contextSuffix}`.trim(),
      rationale: "Questions often create more replies from neutral lurkers and surface polarization.",
    },
    {
      label: "Contrarian memo",
      hook: "State the unpopular interpretation and make people argue.",
      post: `${brandPrefix}contrarian view: the real story behind ${topic} is not the headline everyone is fighting over.${contextSuffix}`.trim(),
      rationale: "This format helps test whether a corrective angle calms the thread or attracts hostility.",
    },
  ];

  return variants.map((idea, index) => ({
    ...idea,
    id: `idea-${index + 1}`,
    post: idea.post.slice(0, maxLen),
  }));
}

export async function generateViralIdeas(input: ViralIdeaInput): Promise<ViralIdea[]> {
  const maxLen = PLATFORM_LIMITS[input.platform];

  try {
    const response = await getClient().chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.9,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: `You create social post variations for internal simulation testing.

Return JSON only in this format:
{"ideas":[{"label":"...","hook":"...","post":"...","rationale":"..."}]}

Rules:
- Return exactly 4 ideas.
- Each label must be 2-4 words.
- Each hook must be one sentence and under 90 characters.
- Each rationale must be one sentence and under 160 characters.
- Each post must feel native to ${input.platform}.
- Each post must stay under ${maxLen} characters.
- Vary the strategic angle across the 4 ideas: one sharp/hot take, one informational, one curiosity-driven, one contrarian.
- Make each post specific enough to simulate realistically. Avoid placeholders and generic marketing fluff.`,
        },
        {
          role: "user",
          content: `Topic: ${input.topic}
Audience: ${input.audienceId}
Platform: ${input.platform}
Brand or account voice: ${input.brand?.trim() || "None provided"}
Context: ${input.context?.trim() || "None provided"}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(raw) as {
      ideas?: Array<{
        label?: string;
        hook?: string;
        post?: string;
        rationale?: string;
      }>;
    };

    if (!Array.isArray(parsed.ideas) || parsed.ideas.length === 0) {
      return fallbackIdeas(input);
    }

    return parsed.ideas.slice(0, 4).map((idea, index) => ({
      id: `idea-${index + 1}`,
      label: String(idea.label || `Variant ${index + 1}`).slice(0, 40),
      hook: String(idea.hook || "").slice(0, 120),
      post: String(idea.post || "").slice(0, maxLen),
      rationale: String(idea.rationale || "").slice(0, 180),
    }));
  } catch {
    return fallbackIdeas(input);
  }
}
