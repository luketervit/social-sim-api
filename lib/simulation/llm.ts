import OpenAI from "openai";
import { getEnv } from "@/lib/env";
import type { TokenUsage } from "./types";

const MODEL = "meta-llama/llama-3.1-8b-instruct";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  _client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: getEnv().OPENROUTER_API_KEY,
  });
  return _client;
}

export async function generateReply(
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; usage: TokenUsage }> {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 300,
    temperature: 0.9,
  });

  return {
    content: response.choices[0]?.message?.content?.trim() || "(no response)",
    usage: {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    },
  };
}
