import type { Persona } from "@/lib/schemas";
import { SIMULATION_ROUNDS } from "@/lib/credits";
import type { AgentMessage, SimulationState, TokenUsage } from "./types";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { generateReply } from "./llm";

type TargetSentiment = AgentMessage["sentiment"];

interface PlannedTurn {
  persona: Persona;
  targetSentiment: TargetSentiment;
}

interface RunSimulationOptions {
  onBeforeMessage?: (turn: PlannedTurn, round: number) => Promise<void>;
  onAfterMessage?: (turn: PlannedTurn, round: number, usage: TokenUsage) => Promise<void>;
}

const TOPIC_HEAT_WORDS = [
  "nft",
  "crypto",
  "blockchain",
  "ai",
  "layoff",
  "paywall",
  "microtransaction",
  "drm",
  "ads",
  "tracking",
  "privacy",
  "battle pass",
  "price increase",
  "exclusive",
  "premium",
  "monetization",
  "subscription",
  "ownership",
];

const HOSTILE_WORDS = [
  "trash",
  "garbage",
  "scam",
  "boycott",
  "terrible",
  "awful",
  "hate",
  "worst",
  "pathetic",
  "disgusting",
  "fraud",
  "joke",
  "clown",
  "rip off",
  "ripoff",
  "greed",
  "greedy",
  "predatory",
  "unacceptable",
  "outrage",
  "furious",
  "insulting",
  "shameful",
  "disaster",
  "ratio",
  "L ",
];

const POSITIVE_WORDS = [
  "love",
  "amazing",
  "great",
  "awesome",
  "excited",
  "fantastic",
  "incredible",
  "brilliant",
  "perfect",
  "can't wait",
  "hyped",
  "beautiful",
  "thank",
  "appreciate",
  "well done",
  "bravo",
  "impressive",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function analyzeSentiment(
  text: string,
  fallback: TargetSentiment
): AgentMessage["sentiment"] {
  const lower = text.toLowerCase();
  const hostileCount = HOSTILE_WORDS.filter((word) => lower.includes(word)).length;
  const positiveCount = POSITIVE_WORDS.filter((word) => lower.includes(word)).length;

  if (hostileCount >= 2 || (fallback === "hostile" && hostileCount >= 1)) return "hostile";
  if (hostileCount > positiveCount) return "negative";
  if (positiveCount > hostileCount) return "positive";
  return fallback;
}

function baseTargetSentiment(persona: Persona): TargetSentiment {
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

function scoreTopicHeat(input: string) {
  const lower = input.toLowerCase();
  const matches = TOPIC_HEAT_WORDS.filter((word) => lower.includes(word)).length;
  return clamp(0.18 + matches * 0.12, 0, 1);
}

function summarizeThreadEnergy(thread: AgentMessage[]) {
  const recent = thread.slice(-24);
  if (recent.length === 0) {
    return { negativity: 0, positivity: 0, hostility: 0 };
  }

  const hostility = recent.filter((message) => message.sentiment === "hostile").length / recent.length;
  const negative = recent.filter((message) => message.sentiment === "negative").length / recent.length;
  const positivity = recent.filter((message) => message.sentiment === "positive").length / recent.length;

  return {
    negativity: clamp(hostility + negative, 0, 1),
    positivity: clamp(positivity, 0, 1),
    hostility: clamp(hostility, 0, 1),
  };
}

function inferRoundSentiment(persona: Persona, thread: AgentMessage[]): TargetSentiment {
  const base = baseTargetSentiment(persona);
  const energy = summarizeThreadEnergy(thread);

  if (energy.negativity >= 0.62) {
    if (base === "positive" && persona.brand_affinity < 0.55) return "neutral";
    if (base === "neutral" && persona.brand_affinity < 0) return "negative";
    if (base === "negative" && persona.reactivity_baseline >= 0.7) return "hostile";
  }

  if (energy.positivity >= 0.55) {
    if (base === "hostile" && persona.brand_affinity > -0.55) return "negative";
    if (base === "negative" && persona.brand_affinity > -0.15) return "neutral";
  }

  return base;
}

function speakingProbability(
  persona: Persona,
  input: string,
  thread: AgentMessage[],
  round: number,
  targetSentiment: TargetSentiment
) {
  const topicHeat = scoreTopicHeat(input);
  const energy = summarizeThreadEnergy(thread);
  const roundDecay = Math.max(0, 0.22 - (round - 1) * 0.04);

  let probability =
    0.06 +
    persona.reactivity_baseline * 0.34 +
    Math.abs(persona.brand_affinity) * 0.18 +
    topicHeat * 0.18 +
    energy.negativity * 0.12 +
    roundDecay;

  if (targetSentiment === "hostile") probability += 0.12;
  if (targetSentiment === "negative") probability += 0.05;
  if (targetSentiment === "neutral") probability -= 0.05;
  if (targetSentiment === "positive") probability -= 0.02;
  if (persona.sophistication >= 0.8) probability -= 0.04;
  if (energy.hostility >= 0.3 && persona.brand_affinity >= 0.45) probability += 0.08;

  return clamp(probability, 0.08, 0.9);
}

function chooseRoundParticipants(
  personas: Persona[],
  input: string,
  thread: AgentMessage[],
  round: number
): PlannedTurn[] {
  const candidates = personas
    .map((persona) => {
      const targetSentiment = inferRoundSentiment(persona, thread);
      const probability = speakingProbability(persona, input, thread, round, targetSentiment);

      return {
        persona,
        targetSentiment,
        probability,
        score: probability + persona.reactivity_baseline * 0.1 + Math.random() * 0.08,
      };
    })
    .sort((left, right) => right.score - left.score);

  const selected = candidates.filter((candidate) => Math.random() < candidate.probability);
  const minimumParticipants = Math.max(8, Math.ceil(personas.length * 0.18));

  if (selected.length < minimumParticipants) {
    const selectedIds = new Set(selected.map((candidate) => candidate.persona.id));
    for (const candidate of candidates) {
      if (selectedIds.has(candidate.persona.id)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.persona.id);
      if (selected.length >= minimumParticipants) break;
    }
  }

  return selected
    .sort((left, right) => right.score - left.score)
    .map(({ persona, targetSentiment }) => ({ persona, targetSentiment }));
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

  for (let round = 1; round <= SIMULATION_ROUNDS; round++) {
    state.round = round;
    const roundParticipants = chooseRoundParticipants(state.personas, state.input, state.thread, round);

    if (roundParticipants.length === 0) {
      continue;
    }

    const priorThread = [...state.thread];
    const roundMessages = await Promise.all(
      roundParticipants.map(async (turn) => {
        await options?.onBeforeMessage?.(turn, round);

        const systemPrompt = buildSystemPrompt(state.platform, turn.persona, turn.targetSentiment);
        const userPrompt = buildUserPrompt(
          state.input,
          priorThread,
          turn.targetSentiment,
          round,
          SIMULATION_ROUNDS
        );

        const reply = await generateReply(systemPrompt, userPrompt);
        await options?.onAfterMessage?.(turn, round, reply.usage);
        const sentiment = analyzeSentiment(reply.content, turn.targetSentiment);

        return {
          round,
          agent_id: turn.persona.id,
          archetype: turn.persona.archetype,
          message: reply.content,
          sentiment,
          timestamp: new Date().toISOString(),
        } satisfies AgentMessage;
      })
    );

    state.thread.push(...roundMessages);
    state.lastAgentId = roundMessages.at(-1)?.agent_id ?? state.lastAgentId;

    for (const message of roundMessages) {
      yield message;
    }
  }
}
