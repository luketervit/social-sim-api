import OpenAI from "openai";
import { getEnv } from "@/lib/env";

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
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 300,
    temperature: 0.9,
  });

  return response.choices[0]?.message?.content?.trim() || "(no response)";
}
