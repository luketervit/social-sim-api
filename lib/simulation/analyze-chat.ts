import OpenAI from "openai";
import { getOpenRouterEnv } from "@/lib/env";
import type { AgentMessage } from "./types";

const MODEL =
  process.env.OPENROUTER_CHAT_ANALYSIS_MODEL ||
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
  recommendedHeadline: string;
  whyThisWins: string;
  expectedReaction: string;
  risksToWatch: string[];
  alternateNotes: Array<{
    index: number;
    summary: string;
  }>;
}

function countSentiment(thread: AgentMessage[], sentiment: AgentMessage["sentiment"]) {
  return thread.filter((msg) => msg.sentiment === sentiment).length;
}

function badnessScore(variant: AnalyzeVariantInput) {
  const hostile = countSentiment(variant.thread, "hostile");
  const negative = countSentiment(variant.thread, "negative");
  const positive = countSentiment(variant.thread, "positive");
  const total = Math.max(variant.thread.length, 1);
  return (hostile * 3 + negative * 1.5 - positive * 1.2) / total;
}

function percent(count: number, total: number) {
  return Math.round((count / Math.max(total, 1)) * 100);
}

function topArchetypeSummary(
  topArchetypes: Array<{ archetype: string; count: number }>
) {
  return topArchetypes
    .slice(0, 4)
    .map((item) => item.archetype)
    .join(", ");
}

function summariseReplies(thread: AgentMessage[]): string {
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

function deterministicAlternateSummary(
  loser: AnalyzeVariantInput,
  winner: AnalyzeVariantInput
) {
  const loserTotal = Math.max(loser.thread.length, 1);
  const winnerTotal = Math.max(winner.thread.length, 1);
  const loserBad = percent(
    countSentiment(loser.thread, "negative") + countSentiment(loser.thread, "hostile"),
    loserTotal
  );
  const winnerBad = percent(
    countSentiment(winner.thread, "negative") + countSentiment(winner.thread, "hostile"),
    winnerTotal
  );
  const loserPositive = percent(countSentiment(loser.thread, "positive"), loserTotal);
  const winnerPositive = percent(countSentiment(winner.thread, "positive"), winnerTotal);

  if (loserBad > winnerBad + 10) {
    return `This version triggered more pushback than the winner (${loserBad}% vs ${winnerBad}% negative + hostile), so the room read it as riskier and less clean to ship.`;
  }
  if (loserPositive + 6 < winnerPositive) {
    return `This version did not convert enough supporters (${loserPositive}% vs ${winnerPositive}% positive), so it created less upside even where it avoided outright hostility.`;
  }
  return "This version landed less cleanly overall, with weaker support and a messier reply mix than the recommended draft.";
}

function defaultAnalysis(input: AnalyzeChatInput): ChatAnalysis {
  const ranked = [...input.variants].sort((a, b) => badnessScore(a) - badnessScore(b));
  const winner = ranked[0];
  const audienceSummary = topArchetypeSummary(input.topArchetypes);
  const total = Math.max(winner?.thread.length ?? 0, 1);
  const positive = percent(countSentiment(winner?.thread ?? [], "positive"), total);
  const negative = percent(countSentiment(winner?.thread ?? [], "negative"), total);
  const hostile = percent(countSentiment(winner?.thread ?? [], "hostile"), total);
  const neutral = percent(countSentiment(winner?.thread ?? [], "neutral"), total);
  const bad = negative + hostile;

  const whyThisWins = winner
    ? `${winner.index === 0 ? "The original" : `Variant ${winner.index}`} produced the cleanest reply mix: ${bad}% negative + hostile with ${positive}% positive. ${audienceSummary ? `It reads best for the dominant audience pockets here (${audienceSummary}).` : "It leaves less surface area for easy dunking while still giving supporters something to agree with."}`
    : "This draft produced the cleanest reaction mix across the simulated audience.";

  const expectedReaction =
    positive >= bad
      ? `Expect a mostly neutral-to-positive thread. The core response pattern is agreement or curiosity first, with criticism present but not driving the conversation.`
      : `Expect a mixed thread. Most replies should stay neutral, but a visible minority will push back on the framing rather than the underlying claim.`;

  const risksToWatch: string[] = [];
  if (hostile > 0) {
    risksToWatch.push(`A small hostile pocket is still present (${hostile}% of replies), so quote-tweets and dunk-style replies are still plausible.`);
  }
  if (negative >= 30) {
    risksToWatch.push(`Negative replies are still material at ${negative}%, so the main risk is that the post reads as overclaiming or self-mythologising.`);
  }
  if (neutral >= 45) {
    risksToWatch.push(`A large neutral block means the post is safe enough to survive, but not obviously sharp enough to create strong advocacy on its own.`);
  }

  return {
    recommendedIndex: winner ? winner.index : 0,
    recommendedHeadline:
      winner && winner.index === 0
        ? "Ship the original"
        : `Ship Variant ${winner?.index ?? 0}`,
    whyThisWins,
    expectedReaction,
    risksToWatch: risksToWatch.slice(0, 3),
    alternateNotes: input.variants
      .filter((variant) => !winner || variant.index !== winner.index)
      .map((variant) => ({
        index: variant.index,
        summary: winner
          ? deterministicAlternateSummary(variant, winner)
          : "This version was not the strongest option in the room.",
      }))
      .slice(0, 6),
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
    max_tokens: 1500,
    temperature: 0.4,
  };

  if (structured) {
    payload.response_format = { type: "json_object" };
  }

  return getClient().chat.completions.create(payload as never);
}

export async function analyzeChat(
  input: AnalyzeChatInput
): Promise<ChatAnalysis> {
  if (input.variants.length === 0) return defaultAnalysis(input);

  const systemPrompt = `You are a senior comms strategist reading the results of a simulated social-media test. The user ran drafts of the same post against a simulated audience and got back synthetic replies. Your job is to tell them which draft to ship and why.

Be direct, specific, and grounded in what the audience actually said. Avoid fluff, avoid generic marketing language, avoid empty "data shows" phrasing.

Return JSON only, in this exact shape:
{
  "recommendedIndex": <integer index into the variants array>,
  "recommendedHeadline": "Ship the original" or "Ship Variant N — Label",
  "whyThisWins": "2-3 sentences explaining why this draft lands cleanest with this specific audience. Reference the audience composition + actual reactions.",
  "expectedReaction": "2-3 sentences predicting how the real audience will respond. Concrete: who will agree, who will pushback, what tone the conversation takes.",
  "risksToWatch": ["1 short sentence per risk", "another", "another"],
  "alternateNotes": [
    {"index": <int>, "summary": "1-2 sentences on why this variant came up short"}
  ]
}

Rules:
- recommendedIndex: pick the variant with the cleanest reaction. Lowest hostile+negative share usually wins, but break ties by who has the highest positive share or lowest aggression.
- whyThisWins: ground it in audience makeup + actual reply patterns.
- expectedReaction: write it like you're briefing a founder before they ship.
- risksToWatch: 2-4 entries, each one a specific failure mode.
- alternateNotes: include every non-winning variant with a concrete reason it lost.`;

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
    console.error("analyzeChat failed:", err instanceof Error ? err.message : err);
    return defaultAnalysis(input);
  }

  const text = response.choices[0]?.message?.content?.trim() ?? "";
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
      typeof obj.whyThisWins === "string" && obj.whyThisWins.trim().length > 0
        ? obj.whyThisWins.trim().slice(0, 1200)
        : defaultAnalysis(input).whyThisWins,
    expectedReaction:
      typeof obj.expectedReaction === "string" &&
      obj.expectedReaction.trim().length > 0
        ? obj.expectedReaction.trim().slice(0, 1200)
        : defaultAnalysis(input).expectedReaction,
    risksToWatch: Array.isArray(obj.risksToWatch)
      ? (obj.risksToWatch
          .filter((r) => typeof r === "string")
          .map((r) => (r as string).trim().slice(0, 240))
          .filter((r) => r.length > 0)
          .slice(0, 6) as string[])
      : defaultAnalysis(input).risksToWatch,
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
          .slice(0, 8))
      : defaultAnalysis(input).alternateNotes,
  };
}
