import type { Persona } from "@/lib/schemas";
import type { AgentMessage } from "./types";

const PLATFORM_CONTEXT: Record<string, string> = {
  twitter: `You are posting on Twitter/X. Keep responses under 280 characters. Be direct, punchy, and opinionated. Use hashtags and internet slang naturally. The culture is hostile and fast-paced.`,
  slack: `You are posting in a corporate Slack channel. Be passive-aggressive when disagreeing. Use professional language but let frustration show through tone. Reference meetings, deadlines, and team dynamics.`,
  reddit: `You are posting on Reddit. Write longer-form responses. Be anonymous and unfiltered. Reference subreddit culture. Use "EDIT:" for additions. Upvote/downvote dynamics matter.`,
};

export function buildSystemPrompt(platform: string, persona: Persona): string {
  return `${PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.twitter}

You are roleplaying as the following persona:
- Archetype: ${persona.archetype}
- Core values: ${persona.core_values.join(", ")}
- Personality: ${persona.persona_prompt}

Stay fully in character. Do not break character or mention that you are an AI. Respond naturally as this person would on this platform.`;
}

export function buildUserPrompt(input: string, thread: AgentMessage[]): string {
  if (thread.length === 0) {
    return `A brand/company just posted the following:\n\n"${input}"\n\nWrite your reaction as your character would naturally respond on this platform.`;
  }

  const context = thread
    .slice(-5)
    .map((m) => `[${m.archetype}]: ${m.message}`)
    .join("\n");

  return `Original post: "${input}"\n\nRecent thread:\n${context}\n\nWrite your next response reacting to the conversation. You can respond to the original post or to other comments in the thread.`;
}
