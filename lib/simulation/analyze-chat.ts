import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicEnv } from "@/lib/env";
import type { AgentMessage } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const env = getAnthropicEnv();
  if (!env) return null;
  _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

export interface AnalyzeVariantInput {
  index: number;
  label: string;
  post: string;
  thread: AgentMessage[];
  aggression: string | null;
}

export interface AnalyzeChatInput {
  audienceName: string | null;
  audienceTone: string | null;
  topArchetypes: Array<{ archetype: string; count: number }>;
  platform: string | null;
  variants: AnalyzeVariantInput[];
}

export interface ChatAnalysis {
  recommendedIndex: number;
  recommendedHeadline: string; // "Ship the original" / "Ship Variant 1"
  whyThisWins: string; // 2-3 sentences
  expectedReaction: string; // 2-3 sentences describing what the audience will likely say
  risksToWatch: string[]; // 2-4 concrete risks/pushback themes
  alternateNotes: Array<{
    index: number;
    summary: string; // 1-2 sentences why this variant didn't win
  }>;
}

function summariseReplies(thread: AgentMessage[]): string {
  // Bucket by sentiment, keep ~3 representative quotes per bucket.
  const buckets: Record<AgentMessage["sentiment"], string[]> = {
    positive: [],
    neutral: [],
    negative: [],
    hostile: [],
  };
  for (const msg of thread) {
    if (buckets[msg.sentiment].length < 3) {
      buckets[msg.sentiment].push(`${msg.archetype}: ${msg.message}`);
    }
  }
  const sections: string[] = [];
  for (const key of ["hostile", "negative", "neutral", "positive"] as const) {
    const items = buckets[key];
    if (items.length > 0) {
      sections.push(
        `${key.toUpperCase()} (${items.length} sample of ${
          thread.filter((m) => m.sentiment === key).length
        }):\n${items.map((it) => `- "${it}"`).join("\n")}`
      );
    }
  }
  return sections.join("\n\n");
}

function defaultAnalysis(input: AnalyzeChatInput): ChatAnalysis {
  // Best guess from the raw counts when Claude isn't reachable.
  const ranked = [...input.variants].sort((a, b) => {
    const aBad =
      a.thread.filter((m) => m.sentiment === "hostile").length * 3 +
      a.thread.filter((m) => m.sentiment === "negative").length * 1.5 -
      a.thread.filter((m) => m.sentiment === "positive").length * 1.2;
    const bBad =
      b.thread.filter((m) => m.sentiment === "hostile").length * 3 +
      b.thread.filter((m) => m.sentiment === "negative").length * 1.5 -
      b.thread.filter((m) => m.sentiment === "positive").length * 1.2;
    return aBad - bBad;
  });
  const winner = ranked[0];
  return {
    recommendedIndex: winner ? winner.index : 0,
    recommendedHeadline:
      winner && winner.index === 0
        ? "Ship the original"
        : `Ship Variant ${winner?.index ?? 0}`,
    whyThisWins:
      "This draft drew the cleanest reaction across the simulated audience. Detailed analysis is unavailable right now — see the raw sentiment breakdown below.",
    expectedReaction:
      "The room's reaction skews toward neutral and positive responses, with negative voices in the minority.",
    risksToWatch: [],
    alternateNotes: [],
  };
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

export async function analyzeChat(
  input: AnalyzeChatInput
): Promise<ChatAnalysis> {
  const client = getClient();
  if (!client) return defaultAnalysis(input);
  if (input.variants.length === 0) return defaultAnalysis(input);

  const systemPrompt = `You are a senior comms strategist reading the results of a simulated social-media test. The user ran 1-3 drafts of the same post against a simulated audience and got back hundreds of synthetic replies. Your job is to tell them which draft to ship and why.

Be direct, specific, and grounded in what the synthetic audience actually said. Quote them sparingly when it strengthens the point. Avoid corporate-speak, avoid hedging.

Return JSON only, in this exact shape:
{
  "recommendedIndex": <integer index into the variants array>,
  "recommendedHeadline": "Ship the original" or "Ship Variant N — Label",
  "whyThisWins": "2-3 sentences explaining why this draft lands cleanest with this specific audience. Reference the audience composition + their actual reactions.",
  "expectedReaction": "2-3 sentences predicting how the real audience will respond. Concrete: who will agree, who will pushback, what tone the conversation takes.",
  "risksToWatch": ["1 short sentence per risk", "another", "another"],
  "alternateNotes": [
    {"index": <int>, "summary": "1-2 sentences on why this variant came up short"}
  ]
}

Rules:
- recommendedIndex: pick the variant with the cleanest reaction. Lowest hostile+negative share usually wins, but break ties by who has the highest positive share or lowest aggression.
- whyThisWins: ground it in audience makeup + actual sample replies. Don't say "the data shows" or "based on analysis" — just say what's true.
- expectedReaction: write it like you're briefing a founder before they ship. Concrete predictions.
- risksToWatch: 2-4 entries, each one a specific failure mode. NOT generic ("some users may disagree") — point at real patterns from the replies.
- alternateNotes: include EVERY non-winning variant. Be specific about what made each one worse.`;

  const variantsBlock = input.variants
    .map(
      (v) => `=== VARIANT ${v.index} ${v.index === 0 ? "(ORIGINAL)" : `— ${v.label}`} ===
POST:
${v.post}

REPLY SUMMARY (${v.thread.length} total replies, aggression: ${v.aggression ?? "—"}):
${summariseReplies(v.thread)}`
    )
    .join("\n\n");

  const archetypeLine = input.topArchetypes
    .slice(0, 6)
    .map((a) => `${a.archetype} (${a.count})`)
    .join(", ");

  const userPrompt = `Audience: ${input.audienceName ?? "—"}${
    input.audienceTone ? ` (skews ${input.audienceTone})` : ""
  }
Top archetypes: ${archetypeLine || "unknown"}
Platform: ${input.platform ?? "—"}

${variantsBlock}

Pick the draft to ship. Explain why. Tell them what to expect when they post it.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("\n");

    const parsed = safeParseJSON(text);
    if (!parsed || typeof parsed !== "object") {
      return defaultAnalysis(input);
    }

    const obj = parsed as {
      recommendedIndex?: unknown;
      recommendedHeadline?: unknown;
      whyThisWins?: unknown;
      expectedReaction?: unknown;
      risksToWatch?: unknown;
      alternateNotes?: unknown;
    };

    const recIndex =
      typeof obj.recommendedIndex === "number" &&
      obj.recommendedIndex >= 0 &&
      obj.recommendedIndex < input.variants.length
        ? Math.floor(obj.recommendedIndex)
        : 0;

    return {
      recommendedIndex: recIndex,
      recommendedHeadline:
        typeof obj.recommendedHeadline === "string" &&
        obj.recommendedHeadline.trim().length > 0
          ? obj.recommendedHeadline.trim().slice(0, 120)
          : recIndex === 0
            ? "Ship the original"
            : `Ship Variant ${recIndex}`,
      whyThisWins:
        typeof obj.whyThisWins === "string"
          ? obj.whyThisWins.trim().slice(0, 1200)
          : "",
      expectedReaction:
        typeof obj.expectedReaction === "string"
          ? obj.expectedReaction.trim().slice(0, 1200)
          : "",
      risksToWatch: Array.isArray(obj.risksToWatch)
        ? (obj.risksToWatch
            .filter((r) => typeof r === "string")
            .map((r) => (r as string).trim().slice(0, 240))
            .filter((r) => r.length > 0)
            .slice(0, 6) as string[])
        : [],
      alternateNotes: Array.isArray(obj.alternateNotes)
        ? (obj.alternateNotes
            .map((n) => {
              if (!n || typeof n !== "object") return null;
              const note = n as { index?: unknown; summary?: unknown };
              if (
                typeof note.index !== "number" ||
                note.index < 0 ||
                note.index >= input.variants.length
              ) {
                return null;
              }
              const summary =
                typeof note.summary === "string"
                  ? note.summary.trim().slice(0, 600)
                  : "";
              if (!summary) return null;
              return { index: Math.floor(note.index), summary };
            })
            .filter((n): n is { index: number; summary: string } => n !== null)
            .slice(0, 4))
        : [],
    };
  } catch (err) {
    console.error(
      "analyzeChat failed:",
      err instanceof Error ? err.message : err
    );
    return defaultAnalysis(input);
  }
}
