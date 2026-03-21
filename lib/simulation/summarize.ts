import OpenAI from "openai";
import { getEnv } from "@/lib/env";
import type { AgentMessage } from "./types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  _client = new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: getEnv().DEEPSEEK_API_KEY,
  });
  return _client;
}

export interface SimulationSummary {
  title: string;
  summary: string;
}

export async function generateSimulationSummary(
  input: string,
  platform: string,
  audienceId: string,
  aggressionScore: string | null,
  thread: AgentMessage[]
): Promise<SimulationSummary> {
  const sampleMessages = thread.slice(0, 40).map((m) => `[${m.sentiment}] ${m.archetype}: ${m.message}`);
  const sentimentCounts = {
    hostile: thread.filter((m) => m.sentiment === "hostile").length,
    negative: thread.filter((m) => m.sentiment === "negative").length,
    neutral: thread.filter((m) => m.sentiment === "neutral").length,
    positive: thread.filter((m) => m.sentiment === "positive").length,
  };

  const response = await getClient().chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: `You generate titles and summaries for social discourse simulations. These are AI agent-based simulations that predict how online communities react to announcements or posts.

Return JSON only, no markdown. Format: {"title": "...", "summary": "..."}

Title rules:
- Max 80 characters
- Punchy, descriptive, like a news headline
- Reference the topic and outcome (e.g. "Gaming Community Erupts Over NFT Announcement")

Summary rules:
- 2-3 sentences, max 280 characters
- Describe what was simulated, the audience reaction, and the key takeaway
- Be specific about sentiment shifts and notable patterns`,
      },
      {
        role: "user",
        content: `Simulation details:
- Original post: "${input}"
- Platform: ${platform}
- Audience: ${audienceId}
- Aggression score: ${aggressionScore ?? "unknown"}
- Total messages: ${thread.length}
- Sentiment breakdown: ${JSON.stringify(sentimentCounts)}
- Rounds: ${thread.length > 0 ? thread[thread.length - 1].round : 0}

Sample messages:
${sampleMessages.join("\n")}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";

  try {
    const parsed = JSON.parse(raw);
    return {
      title: String(parsed.title || "Untitled Simulation").slice(0, 120),
      summary: String(parsed.summary || "").slice(0, 500),
    };
  } catch {
    return {
      title: `${audienceId.replace(/_/g, " ")} reacts to: ${input.slice(0, 60)}`,
      summary: `A ${platform} simulation with ${thread.length} messages. Aggression: ${aggressionScore ?? "unknown"}.`,
    };
  }
}
