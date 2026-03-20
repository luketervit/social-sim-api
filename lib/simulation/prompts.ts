import type { Persona } from "@/lib/schemas";
import type { AgentMessage } from "./types";

type TargetSentiment = AgentMessage["sentiment"];

const PLATFORM_CONTEXT: Record<string, string> = {
  twitter: `You are posting on Twitter/X. Keep responses under 280 characters. Be direct, punchy, and opinionated. Use hashtags and internet slang naturally. The culture is hostile and fast-paced.`,
  slack: `You are posting in a corporate Slack channel. Be passive-aggressive when disagreeing. Use professional language but let frustration show through tone. Reference meetings, deadlines, and team dynamics.`,
  reddit: `You are posting on Reddit. Write longer-form responses. Be anonymous and unfiltered. Reference subreddit culture. Use "EDIT:" for additions. Upvote/downvote dynamics matter.`,
};

const STANCE_GUIDANCE: Record<TargetSentiment, string> = {
  positive:
    "Your stance is broadly supportive. Point out upside, defend the idea, or express excitement, but stay believable and specific.",
  neutral:
    "Your stance is mixed or undecided. Ask questions, note tradeoffs, or reserve judgment until more details are available.",
  negative:
    "Your stance is skeptical. Raise concrete concerns or doubts, but do not automatically join a pile-on unless it fits your persona.",
  hostile:
    "Your stance is openly hostile. Be sharp, dismissive, or mocking, but stay on-topic and in character.",
};

export function buildSystemPrompt(
  platform: string,
  persona: Persona,
  targetSentiment: TargetSentiment
): string {
  return `${PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.twitter}

You are roleplaying as the following persona:
- Archetype: ${persona.archetype}
- Brand affinity: ${persona.brand_affinity.toFixed(2)}
- Core values: ${persona.core_values.join(", ")}
- Personality: ${persona.persona_prompt}

Reaction guidance:
- Target stance: ${targetSentiment}
- ${STANCE_GUIDANCE[targetSentiment]}
- Your reaction should come from your own worldview and brand affinity, not from blindly copying the majority of the thread.

Stay fully in character. Do not break character or mention that you are an AI. Respond naturally as this person would on this platform.`;
}

export function buildUserPrompt(
  input: string,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  round: number,
  totalRounds: number
): string {
  if (thread.length === 0) {
    return `A brand/company just posted the following:\n\n"${input}"\n\nYou are reacting in round ${round} of ${totalRounds}. Other agents in this same round have not posted yet. Write your reaction as your character would naturally respond on this platform. Stay aligned with a ${targetSentiment} stance without sounding robotic or repetitive.`;
  }

  const context = thread
    .slice(-10)
    .map((m) => `[${m.archetype}]: ${m.message}`)
    .join("\n");

  return `Original post: "${input}"\n\nYou are reacting in round ${round} of ${totalRounds}. The messages below are from earlier rounds only. Other agents in your current round have not posted yet.\n\nRecent thread:\n${context}\n\nWrite your next response reacting to the conversation. You can respond to the original post or to other comments in the thread. Maintain your own ${targetSentiment} stance and avoid simply echoing the last speaker.`;
}
