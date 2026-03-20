import type { Persona } from "@/lib/schemas";
import type { AgentMessage, SimulationState } from "./types";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { generateReply } from "./llm";

type TargetSentiment = AgentMessage["sentiment"];

interface PlannedTurn {
  persona: Persona;
  targetSentiment: TargetSentiment;
}

interface RunSimulationOptions {
  onBeforeMessage?: (turn: PlannedTurn, round: number) => Promise<void>;
}

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

function analyzeSentiment(
  text: string,
  fallback: TargetSentiment
): AgentMessage["sentiment"] {
  const lower = text.toLowerCase();
  const hostileCount = HOSTILE_WORDS.filter((w) => lower.includes(w)).length;
  const positiveCount = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;

  if (hostileCount >= 2 || (fallback === "hostile" && hostileCount >= 1)) return "hostile";
  if (hostileCount > positiveCount) return "negative";
  if (positiveCount > hostileCount) return "positive";
  return fallback;
}

function inferTargetSentiment(persona: Persona): TargetSentiment {
  const affinity = persona.brand_affinity;
  const reactivity = persona.reactivity_baseline;
  const sophistication = persona.sophistication;

  if (affinity <= -0.55) {
    return reactivity >= 0.6 ? "hostile" : "negative";
  }

  if (affinity <= -0.15) {
    return reactivity >= 0.85 && sophistication < 0.45 ? "hostile" : "negative";
  }

  if (affinity < 0.15) {
    return reactivity >= 0.8 && affinity < -0.05 ? "negative" : "neutral";
  }

  if (affinity < 0.45) {
    return sophistication >= 0.72 ? "neutral" : "positive";
  }

  return "positive";
}

function rankBucket(personas: Persona[]): Persona[] {
  return [...personas]
    .map((persona) => ({
      persona,
      score:
        persona.reactivity_baseline * 0.7 +
        (1 - persona.sophistication) * 0.2 +
        Math.random() * 0.1,
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ persona }) => persona);
}

function buildTurnPlan(personas: Persona[]): PlannedTurn[] {
  const buckets: Record<TargetSentiment, Persona[]> = {
    positive: [],
    neutral: [],
    negative: [],
    hostile: [],
  };

  for (const persona of personas) {
    buckets[inferTargetSentiment(persona)].push(persona);
  }

  const queues: Record<TargetSentiment, Persona[]> = {
    positive: rankBucket(buckets.positive),
    neutral: rankBucket(buckets.neutral),
    negative: rankBucket(buckets.negative),
    hostile: rankBucket(buckets.hostile),
  };

  const pattern: TargetSentiment[] = [
    "positive",
    "negative",
    "neutral",
    "positive",
    "hostile",
    "neutral",
    "negative",
    "positive",
  ];

  const planned: PlannedTurn[] = [];

  while (planned.length < personas.length) {
    for (const sentiment of pattern) {
      const nextPersona = queues[sentiment].shift();
      if (!nextPersona) continue;
      planned.push({ persona: nextPersona, targetSentiment: sentiment });
      if (planned.length === personas.length) break;
    }
  }

  return planned;
}

export async function* runSimulation(
  personas: Persona[],
  audienceId: string,
  platform: string,
  input: string,
  options?: RunSimulationOptions
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

  const plan = buildTurnPlan(personas);

  for (let round = 1; round <= plan.length; round++) {
    state.round = round;
    const turn = plan[round - 1];
    await options?.onBeforeMessage?.(turn, round);

    const systemPrompt = buildSystemPrompt(state.platform, turn.persona, turn.targetSentiment);
    const userPrompt = buildUserPrompt(state.input, state.thread, turn.targetSentiment);

    const reply = await generateReply(systemPrompt, userPrompt);
    const sentiment = analyzeSentiment(reply, turn.targetSentiment);

    const message: AgentMessage = {
      round,
      agent_id: turn.persona.id,
      archetype: turn.persona.archetype,
      message: reply,
      sentiment,
      timestamp: new Date().toISOString(),
    };

    state.thread.push(message);
    state.lastAgentId = turn.persona.id;

    yield message;
  }
}
