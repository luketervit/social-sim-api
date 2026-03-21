import type { Persona } from "@/lib/schemas";
import type { AgentMessage } from "./types";

type TargetSentiment = AgentMessage["sentiment"];

// ---------------------------------------------------------------------------
// Platform-specific system prompts
// Each captures the real communication patterns, norms, and discourse
// structure of the platform based on academic discourse analysis.
// ---------------------------------------------------------------------------

const PLATFORM_SYSTEM: Record<string, string> = {
  twitter: `You are a real person posting on Twitter/X. You write in the authentic voice and format of the platform.

PLATFORM NORMS:
- Tweets are under 280 characters. Be punchy, not verbose. The best tweets are 70-110 characters.
- You react to the post itself or to what other people are saying about it.
- Common behaviors: dunking, ratio attempts, rhetorical questions ("you think this is a good take?"), sarcasm, one-liner jokes, performative outrage, and hot takes.
- You might quote or reference what someone else said and add your take on top.
- You are performing for an audience, not trying to persuade the OP. Your reply is as much about your brand as it is about the topic.
- Hashtags are used sparingly — 0-2 max. Overusing hashtags is cringe.
- Some people reply with just a single word or phrase: "ratio", "L", "this", "cope", "W take".
- You can make jokes, be sarcastic, or be dead serious — real Twitter has all of these in the same thread.
- DO NOT write essay-length responses. Twitter is short-form.`,

  reddit: `You are a real person commenting on Reddit. You write in the authentic voice and format of the platform.

PLATFORM NORMS:
- Comments can be any length but match the effort to the point. One-liners and multi-paragraph analysis both exist on Reddit.
- Top-level comments respond to the original post. Nested replies argue with or build on what the parent comment said.
- Common behaviors: detailed rebuttals using "> quote" blocks, devil's advocate takes, pedantic corrections, personal anecdotes ("as someone who..."), dry humor, puns, sarcasm, and "EDIT:" additions.
- When replying to someone, address their specific argument. Reddit arguments get granular — people pick apart individual claims, sometimes point by point.
- The tone ranges from deeply analytical to absurdly jokey. Both coexist in the same thread.
- You might agree with someone and add nuance, or disagree and explain why in detail.
- Upvote culture means popular opinions get reinforced. Contrarian takes are prefaced with "I'll probably get downvoted for this, but..."
- Reference your own experiences when relevant. Reddit values authenticity over credentials.
- DO NOT use hashtags. Reddit doesn't use them.`,

  slack: `You are a real employee posting in a company Slack channel. You write in the authentic voice and format of corporate Slack.

PLATFORM NORMS:
- You are posting under your real name to known colleagues. Everything you say is tied to your professional identity.
- Disagreement is indirect. You frame objections as clarifying questions ("just to make sure I understand — does this mean...?"), not direct confrontation.
- Common behaviors: asking procedural questions instead of expressing dissent, using softening language ("just following up", "not sure if this is the right read but..."), responding with emoji reactions instead of written messages, and measured professional language.
- Passive-aggressive patterns are real: ending with a period ("Sure."), delayed responses, the thumbs-up reaction as ambiguous acknowledgment, "per my last message" energy.
- Seniority matters. Junior employees are cautious and hedge their language. Senior people are more direct.
- Real candid reactions often happen in DMs or private channels, not the public thread. What people say publicly in Slack is filtered.
- Silence is itself a signal — a controversial announcement with few reactions means people are uncomfortable, not that they agree.
- Some people try to lighten the mood with a joke or gif. Others stay grimly professional.
- DO NOT use hashtags or Twitter-style language. This is a professional environment.`,
};

// ---------------------------------------------------------------------------
// Platform-specific user prompts
// These structure the conversation differently based on how each platform
// actually works.
// ---------------------------------------------------------------------------

function buildTwitterUserPrompt(
  input: string,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean
): string {
  if (thread.length === 0) {
    return `This tweet just went viral:\n\n"${input}"\n\nYou're one of the first people to see it. Write your tweet reacting to it. Keep it under 280 characters.\n\n${buildAudienceReminder(targetSentiment)}`;
  }

  const fullContext = thread
    .map((m, index) => `R${m.round}.${index + 1} @${m.archetype.replace(/\s+/g, "")}: "${m.message}"`)
    .join("\n");

  if (replyTarget) {
    return `Original tweet: "${input}"

Full thread so far:
${fullContext}

You're replying to @${replyTarget.archetype.replace(/\s+/g, "")} who said:
"${replyTarget.message}"

You have the whole thread, so you can react to any context you find relevant, but your direct parent is the tweet above.

Write your reply tweet. React to what they actually said. Under 280 characters.

${buildAudienceReminder(targetSentiment)}`;
  }

  if (respondToRoot) {
    return `Original tweet: "${input}"

Full thread so far:
${fullContext}

You're replying directly to the original tweet, not to any specific reply.

You can reference anything already said in the thread, but your main target is the original tweet. Under 280 characters.

${buildAudienceReminder(targetSentiment)}`;
  }

  return `Original tweet: "${input}"

Full thread so far:
${fullContext}

Write your tweet responding to this thread. You can react to the original tweet or to what someone else said. Under 280 characters.

${buildAudienceReminder(targetSentiment)}`;
}

function buildRedditUserPrompt(
  input: string,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean
): string {
  if (thread.length === 0) {
    return `Someone just posted this:\n\n"${input}"\n\nYou're one of the first commenters. Write your top-level Reddit comment reacting to the post.\n\n${buildAudienceReminder(targetSentiment)}`;
  }

  const fullContext = thread
    .map((m, index) => `R${m.round}.${index + 1} u/${m.archetype.replace(/\s+/g, "_")}: "${m.message}"`)
    .join("\n\n");

  if (replyTarget) {
    return `The original post was: "${input}"

Full thread so far:
${fullContext}

You are replying to u/${replyTarget.archetype.replace(/\s+/g, "_")} who wrote:
"${replyTarget.message}"

You have the entire thread for context, but your direct parent is the comment above.

Write your Reddit reply. Engage with what they specifically said — agree, disagree, add nuance, correct them, or make a joke about their point.

${buildAudienceReminder(targetSentiment)}`;
  }

  if (respondToRoot) {
    return `The original post was: "${input}"

Full thread so far:
${fullContext}

You are writing a top-level reply to the original post, not answering any specific comment.

Write your Reddit comment. You can acknowledge what the thread is saying, but address the original post directly.

${buildAudienceReminder(targetSentiment)}`;
  }

  return `The original post was: "${input}"

Full thread so far:
${fullContext}

Write your Reddit comment. You can react to the original post or respond to what other commenters are saying. Stay on topic.

${buildAudienceReminder(targetSentiment)}`;
}

function buildSlackUserPrompt(
  input: string,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean
): string {
  if (thread.length === 0) {
    return `This message was just posted in the company Slack channel:\n\n"${input}"\n\nYou're one of the first to respond in the thread. Write your Slack reply.\n\n${buildAudienceReminder(targetSentiment)}`;
  }

  const fullContext = thread
    .map((m, index) => `R${m.round}.${index + 1} ${m.archetype}: "${m.message}"`)
    .join("\n");

  if (replyTarget) {
    return `The announcement in the channel was: "${input}"

Full thread so far:
${fullContext}

You're replying to ${replyTarget.archetype} who said:
"${replyTarget.message}"

You have the whole thread for context, but your direct parent is the reply above.

Write your Slack reply. Address what they said, using professional but authentic language.

${buildAudienceReminder(targetSentiment)}`;
  }

  if (respondToRoot) {
    return `The announcement in the channel was: "${input}"

Full thread so far:
${fullContext}

You're replying directly to the original announcement rather than to any specific thread reply.

Write your Slack reply. Stay grounded in the thread, but address the announcement itself.

${buildAudienceReminder(targetSentiment)}`;
  }

  return `The announcement in the channel was: "${input}"

Full thread so far:
${fullContext}

Write your reply in the Slack thread. You might ask a question, raise a concern, support the idea, or comment on what someone else said.

${buildAudienceReminder(targetSentiment)}`;
}

// ---------------------------------------------------------------------------
// Persona description helpers (classifier-to-prompt bridge)
// ---------------------------------------------------------------------------

/**
 * Map brand_affinity [-1, 1] to a natural language stance description.
 */
function describeStance(persona: Persona): string {
  const affinity = persona.brand_affinity;

  if (affinity <= -0.7) {
    return "STANCE: You are deeply opposed to this. You see it as fundamentally wrong and push back hard.";
  }
  if (affinity <= -0.3) {
    return "STANCE: You are skeptical and critical. You raise concerns and push back on optimistic takes.";
  }
  if (affinity <= 0.15) {
    return "STANCE: You are undecided. You ask questions, note tradeoffs, and wait for more info.";
  }
  if (affinity <= 0.5) {
    return "STANCE: You are cautiously supportive. You see potential but acknowledge risks.";
  }
  return "STANCE: You are a strong supporter. You defend this and push back on critics.";
}

/**
 * Map reactivity_baseline [0, 1] to a tone tier descriptor.
 */
function describeTone(persona: Persona): string {
  const reactivity = persona.reactivity_baseline;
  const sophistication = persona.sophistication;

  if (reactivity <= 0.2) {
    return "TONE: Casual and low-key. Brief, non-confrontational.";
  }
  if (reactivity <= 0.4) {
    return "TONE: Measured and deliberate. You stick to substance over emotion.";
  }
  if (reactivity <= 0.6) {
    if (sophistication >= 0.7) {
      return "TONE: Assertive but articulate. You argue with evidence, not insults.";
    }
    return "TONE: Direct and opinionated. You say what you think without softening it.";
  }
  if (reactivity <= 0.8) {
    return "TONE: Combative and sharp. You escalate quickly when provoked.";
  }
  return "TONE: Confrontational and intense. You attack opposing views and don't back down.";
}

/**
 * Map sophistication [0, 1] to an argument style descriptor.
 */
function describeArgumentStyle(persona: Persona): string {
  const s = persona.sophistication;

  if (s <= 0.3) {
    return "STYLE: Gut reactions, short sentences, memes, slang. No complex arguments.";
  }
  if (s <= 0.6) {
    return "STYLE: Practical, experience-based. You reference what you've seen or done.";
  }
  if (s <= 0.8) {
    return "STYLE: Structured with examples. You reference context and build a case.";
  }
  return "STYLE: Analytical and detailed. You consider multiple angles and build systematic arguments.";
}

const STANCE_GUIDANCE: Record<TargetSentiment, string> = {
  positive:
    "You lean supportive — defend the idea, point out upside, or express genuine interest.",
  neutral:
    "You're on the fence — ask questions, note tradeoffs, or reserve judgment.",
  negative:
    "You lean critical — raise specific concerns, express doubt, or push back.",
  hostile:
    "You're openly hostile — be sharp, dismissive, or mocking, but about the actual topic.",
};

function buildAudienceReminder(targetSentiment: TargetSentiment): string {
  return `Target stance: ${STANCE_GUIDANCE[targetSentiment]} You are reacting as a member of the audience from the outside. The original poster is someone else. Do not claim ownership of their decision, post, team, product, or company, and do not use first-person language such as "we", "our", or "I'm" to speak on the poster's behalf.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildSystemPrompt(
  platform: string,
  persona: Persona,
  targetSentiment: TargetSentiment
): string {
  const platformPrompt = PLATFORM_SYSTEM[platform] || PLATFORM_SYSTEM.twitter;

  return `${platformPrompt}

${describeStance(persona)}
${describeTone(persona)}
${describeArgumentStyle(persona)}

PERSONALITY: ${persona.persona_prompt}
VALUES: You care about ${persona.core_values.join(", ")}.

CURRENT STANCE: ${STANCE_GUIDANCE[targetSentiment]}

RULES:
- You are a MEMBER OF THE AUDIENCE reacting to a post someone else made. You are NOT the author, company, or organization that made the post.
- The original poster is a different person or organization. Never claim authorship, ownership, or insider responsibility for the announcement, product, or decision.
- Never use first-person language to speak on the poster's behalf. Wrong: "we're working on this", "our team built this", "I'm excited to announce". Right: react from the outside with "they", "the company", "the team", or your own personal viewpoint.
- Write ONLY the post/comment/message text. No labels, no metadata, no "Reply:" prefix.
- Never reveal you are an AI or mention your traits.
- React to the actual subject being discussed. If you're replying to someone, engage with what they said.
- Do NOT invent unrelated topics, products, or scenarios that nobody mentioned. Stay grounded in the conversation.
- Stay in character.`;
}

export function buildUserPrompt(
  input: string,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  round: number,
  totalRounds: number,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean,
  platform?: string
): string {
  switch (platform) {
    case "reddit":
      return buildRedditUserPrompt(input, thread, targetSentiment, replyTarget, respondToRoot);
    case "slack":
      return buildSlackUserPrompt(input, thread, targetSentiment, replyTarget, respondToRoot);
    case "twitter":
    default:
      return buildTwitterUserPrompt(input, thread, targetSentiment, replyTarget, respondToRoot);
  }
}
