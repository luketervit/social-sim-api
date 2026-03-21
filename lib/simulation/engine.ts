import { randomUUID } from "node:crypto";
import type { Persona } from "@/lib/schemas";
import { SIMULATION_ROUNDS } from "@/lib/credits";
import type { AgentMessage, SimulationState, TokenUsage } from "./types";
import { getMessageId } from "./threading";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { generateReply } from "./llm";

type TargetSentiment = AgentMessage["sentiment"];

interface PlannedTurn {
  persona: Persona;
  targetSentiment: TargetSentiment;
  replyTarget: AgentMessage | null;
  respondToRoot: boolean;
}

interface RunSimulationOptions {
  onBeforeMessage?: (turn: PlannedTurn, round: number) => Promise<void>;
  onAfterMessage?: (turn: PlannedTurn, round: number, usage: TokenUsage) => Promise<void>;
}

const TOPIC_HEAT_WORDS = [
  "nft", "crypto", "blockchain", "ai", "layoff", "paywall",
  "microtransaction", "drm", "ads", "tracking", "privacy",
  "battle pass", "price increase", "exclusive", "premium",
  "monetization", "subscription", "ownership",
];

const HOSTILE_WORDS = [
  "trash", "garbage", "scam", "boycott", "terrible", "awful",
  "hate", "worst", "pathetic", "disgusting", "fraud", "joke",
  "clown", "rip off", "ripoff", "greed", "greedy", "predatory",
  "unacceptable", "outrage", "furious", "insulting", "shameful",
  "disaster", "ratio", "L ",
];

const POSITIVE_WORDS = [
  "love", "amazing", "great", "awesome", "excited", "fantastic",
  "incredible", "brilliant", "perfect", "can't wait", "hyped",
  "beautiful", "thank", "appreciate", "well done", "bravo",
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

// ---------------------------------------------------------------------------
// Response pressure
// Participation follows the dissertation model: every agent in the audience
// independently decides whether to speak each round via a Bernoulli draw.
// ---------------------------------------------------------------------------

function computeAggressionScore(persona: Persona, input: string, thread: AgentMessage[]): number {
  const topicHeat = scoreTopicHeat(input);
  const energy = summarizeThreadEnergy(thread);

  // Aggression combines reactivity baseline with environmental factors
  const aggression =
    persona.reactivity_baseline * 0.6 +
    Math.abs(persona.brand_affinity) * 0.15 +
    topicHeat * 0.1 +
    energy.hostility * 0.15;

  return clamp(aggression, 0, 1);
}

function replyProbability(persona: Persona, input: string, thread: AgentMessage[]): number {
  const aggression = computeAggressionScore(persona, input, thread);
  return Math.min(0.25, 0.05 + 0.15 * aggression);
}

// ---------------------------------------------------------------------------
// Reply targeting — dissertation §3.5.2
// Agents pick a specific message to reply to, weighted by:
// - Recency (recent messages boosted)
// - Persona distance (bounded confidence, threshold 0.3)
// - Controversy bonus for high-aggression targeting distant opponents
// - Depth penalty for deep reply chains
// ---------------------------------------------------------------------------

const BOUNDED_CONFIDENCE_THRESHOLD = 0.3;

function personaDistance(persona: Persona, message: AgentMessage, personas: Persona[]): number {
  // Approximate distance via brand_affinity as a proxy for ideological position
  const targetPersona = personas.find((p) => p.id === message.agent_id);
  if (!targetPersona) return 0.5;
  return Math.abs(persona.brand_affinity - targetPersona.brand_affinity);
}

function selectReplyTarget(
  persona: Persona,
  thread: AgentMessage[],
  allPersonas: Persona[]
): AgentMessage | null {
  if (thread.length === 0) return null;

  const aggression = persona.reactivity_baseline;
  const candidates = [...thread];
  const latestRound = candidates.at(-1)?.round ?? 1;
  const replyCountByMessageId = new Map<string, number>();

  for (let index = 0; index < candidates.length; index += 1) {
    const message = candidates[index];
    if (!message.reply_to) continue;
    replyCountByMessageId.set(
      message.reply_to,
      (replyCountByMessageId.get(message.reply_to) ?? 0) + 1
    );
  }

  const scored = candidates.map((msg, index) => {
    const messageId = getMessageId(msg, index);
    const roundAge = Math.max(0, latestRound - msg.round);
    const recencyWeight = 0.45 + 0.55 * Math.exp(-roundAge * 0.35);

    // Distance: bounded confidence model
    const distance = personaDistance(persona, msg, allPersonas);
    let distanceWeight: number;

    if (distance <= BOUNDED_CONFIDENCE_THRESHOLD) {
      // Within confidence threshold — moderate attraction (agreement or slight disagreement)
      distanceWeight = 0.5 + distance;
    } else if (aggression >= 0.7 && distance > 0.6) {
      // High-aggression agents get a controversy bonus for targeting distant opponents
      distanceWeight = 0.8 + distance * 0.3;
    } else if (aggression < 0.4 && distance > 0.6) {
      // Low-aggression agents penalised for targeting extreme opponents
      distanceWeight = 0.2;
    } else {
      // Moderate distance — moderate attraction
      distanceWeight = 0.4;
    }

    // Don't reply to yourself
    if (msg.agent_id === persona.id) return { msg, score: 0 };

    const sameRoundBoost = msg.round === latestRound ? 1.2 : 1;
    const depthPenalty = msg.reply_to ? 0.94 : 1;
    const crowdPenalty = 1 / (1 + (replyCountByMessageId.get(messageId) ?? 0) * 0.45);
    const score =
      recencyWeight *
      distanceWeight *
      sameRoundBoost *
      depthPenalty *
      crowdPenalty *
      (0.9 + Math.random() * 0.2);

    return { msg, score };
  });

  const viableCandidates = scored.filter((candidate) => candidate.score > 0);
  if (viableCandidates.length === 0) return null;

  const totalScore = viableCandidates.reduce((sum, candidate) => sum + candidate.score, 0);
  let threshold = Math.random() * totalScore;

  for (const candidate of viableCandidates) {
    threshold -= candidate.score;
    if (threshold <= 0) {
      return candidate.msg;
    }
  }

  return viableCandidates.at(-1)?.msg ?? null;
}

function chooseReplyContext(
  persona: Persona,
  input: string,
  thread: AgentMessage[],
  allPersonas: Persona[]
): Pick<PlannedTurn, "replyTarget" | "respondToRoot"> {
  if (thread.length === 0) {
    return {
      replyTarget: null,
      respondToRoot: true,
    };
  }

  const latestRound = thread.at(-1)?.round ?? 1;
  const latestRoundCount = thread.filter((message) => message.round === latestRound).length;
  const aggression = computeAggressionScore(persona, input, thread);
  const energy = summarizeThreadEnergy(thread);
  const replyTarget = selectReplyTarget(persona, thread, allPersonas);

  if (!replyTarget) {
    return {
      replyTarget: null,
      respondToRoot: true,
    };
  }

  const rootScore = clamp(
    0.9 + (1 - aggression) * 0.15 - Math.min(thread.length, 24) * 0.015,
    0.35,
    0.95
  );
  const threadReplyBias = clamp(
    0.7 + aggression * 0.22 + energy.negativity * 0.06 + Math.min(latestRoundCount, 10) * 0.03,
    0.7,
    1.35
  );

  const shouldReplyToThread = Math.random() < threadReplyBias / (threadReplyBias + rootScore);
  return {
    replyTarget: shouldReplyToThread ? replyTarget : null,
    respondToRoot: !shouldReplyToThread,
  };
}

// ---------------------------------------------------------------------------
// Round participant selection
// Every persona takes an independent Bernoulli draw. If selected, they then
// decide whether to reply to the root post or to a prior tweet.
// ---------------------------------------------------------------------------

function chooseRoundParticipants(
  personas: Persona[],
  input: string,
  thread: AgentMessage[],
  allPersonas: Persona[]
): PlannedTurn[] {
  const selected = personas.flatMap((persona) => {
    if (Math.random() > replyProbability(persona, input, thread)) {
      return [];
    }

    const targetSentiment = inferRoundSentiment(persona, thread);
    const { replyTarget, respondToRoot } = chooseReplyContext(persona, input, thread, allPersonas);

    return [{
      persona,
      targetSentiment,
      replyTarget,
      respondToRoot,
    }];
  });

  selected.sort(() => Math.random() - 0.5);
  return selected;
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
    const roundParticipants = chooseRoundParticipants(
      state.personas,
      state.input,
      state.thread,
      state.personas
    );

    if (roundParticipants.length === 0) {
      continue;
    }

    // Simultaneous activation: all agents in this round see the same thread snapshot
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
          SIMULATION_ROUNDS,
          turn.replyTarget,
          turn.respondToRoot,
          state.platform
        );

        const reply = await generateReply(systemPrompt, userPrompt);
        await options?.onAfterMessage?.(turn, round, reply.usage);
        const sentiment = analyzeSentiment(reply.content, turn.targetSentiment);

        return {
          id: randomUUID(),
          round,
          agent_id: turn.persona.id,
          archetype: turn.persona.archetype,
          message: reply.content,
          sentiment,
          reply_to: turn.replyTarget?.id ?? null,
          reply_to_agent_id: turn.replyTarget?.agent_id ?? null,
          timestamp: new Date().toISOString(),
        } satisfies AgentMessage;
      })
    );

    // Commit stage: all messages from this round committed synchronously
    state.thread.push(...roundMessages);
    state.lastAgentId = roundMessages.at(-1)?.agent_id ?? state.lastAgentId;

    for (const message of roundMessages) {
      yield message;
    }
  }
}
