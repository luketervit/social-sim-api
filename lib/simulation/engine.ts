import type { Persona } from "@/lib/schemas";
import type { AgentMessage, SimulationState } from "./types";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { generateReply } from "./llm";

const ROUNDS = 10;

const HOSTILE_WORDS = [
  "trash", "garbage", "scam", "boycott", "terrible", "awful", "hate",
  "worst", "pathetic", "disgusting", "fraud", "joke", "clown", "rip off",
  "ripoff", "greed", "greedy", "predatory", "unacceptable", "outrage",
  "furious", "insulting", "shameful", "disaster", "ratio", "L ",
];

const POSITIVE_WORDS = [
  "love", "amazing", "great", "awesome", "excited", "fantastic", "incredible",
  "brilliant", "perfect", "can't wait", "hyped", "beautiful", "thank",
  "appreciate", "well done", "bravo", "impressive",
];

function analyzeSentiment(text: string): AgentMessage["sentiment"] {
  const lower = text.toLowerCase();
  const hostileCount = HOSTILE_WORDS.filter((w) => lower.includes(w)).length;
  const positiveCount = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;

  if (hostileCount >= 2) return "hostile";
  if (hostileCount > positiveCount) return "negative";
  if (positiveCount > hostileCount) return "positive";
  return "neutral";
}

function selectAgent(personas: Persona[], lastAgentId: string | null): Persona {
  // Weight by reactivity_baseline, exclude last agent to prevent repeats
  const eligible = personas.filter((p) => p.id !== lastAgentId);
  const weights = eligible.map((p) => p.reactivity_baseline);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < eligible.length; i++) {
    random -= weights[i];
    if (random <= 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

export async function* runSimulation(
  personas: Persona[],
  audienceId: string,
  platform: string,
  input: string
): AsyncGenerator<AgentMessage> {
  const state: SimulationState = {
    audience_id: audienceId,
    platform,
    input,
    personas,
    thread: [],
    round: 0,
    lastAgentId: null,
  };

  for (let round = 1; round <= ROUNDS; round++) {
    state.round = round;

    const agent = selectAgent(state.personas, state.lastAgentId);
    const systemPrompt = buildSystemPrompt(state.platform, agent);
    const userPrompt = buildUserPrompt(state.input, state.thread);

    const reply = await generateReply(systemPrompt, userPrompt);
    const sentiment = analyzeSentiment(reply);

    const message: AgentMessage = {
      round,
      agent_id: agent.id,
      archetype: agent.archetype,
      message: reply,
      sentiment,
      timestamp: new Date().toISOString(),
    };

    state.thread.push(message);
    state.lastAgentId = agent.id;

    yield message;
  }
}
