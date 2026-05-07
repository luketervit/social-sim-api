import type { Persona } from "@/lib/schemas";
import type { AgentMessage } from "./types";
import {
  buildImageContextBlock,
  type SimulationImageAnalysis,
} from "./imageAnalysis";

type TargetSentiment = AgentMessage["sentiment"];

// ---------------------------------------------------------------------------
// Numeric → text persona mapping (dissertation §4.4.4)
//
// Bare numeric scores in prompts produced "character-breaking" output and
// unstable realism (-0.231 composite drop in ablation). Instead, translate
// every measured trait into behavioural language: an ideology block, a
// 5-tier tone descriptor, an emotion descriptor, and a vocabulary bank.
//
// The LLM never sees raw scores. It sees behavioural instructions.
// ---------------------------------------------------------------------------

interface PersonaProfile {
  /** Composite aggression in [0, 1]. Mirrors hate+offensive in dissertation. */
  aggression: number;
  /** Five-tier tone descriptor derived from aggression. */
  toneTier: ToneTier;
  /** Behavioural ideology block (values + posture, never raw labels). */
  ideologyBlock: string;
  /** Emotion descriptor (e.g. "calm and measured", "furious and combative"). */
  emotionDesc: string;
  /** Argument style descriptor (short / experiential / analytical). */
  argumentStyle: string;
  /** Vocabulary bank — words/phrases the persona is likely to use. */
  vocab: string[];
}

type ToneTier =
  | "casual"
  | "measured"
  | "assertive"
  | "combative"
  | "confrontational";

const TONE_DESCRIPTORS: Record<ToneTier, string> = {
  casual:
    "casual and conversational — you don't take this very seriously and you're fine to crack a joke or just shrug",
  measured:
    "measured and deliberate — you stick to substance and stay even-keeled even when you disagree",
  assertive:
    "direct and opinionated — you say what you think without softening it but you don't escalate gratuitously",
  combative:
    "sharp and combative — you push back hard, call out what you see as wrong, and don't worry about being polite",
  confrontational:
    "openly hostile — you attack opposing views, mock bad arguments, and have no interest in finding common ground",
};

const TONE_RULES: Record<ToneTier, string> = {
  casual: "Not every reply is an attack. Sometimes you agree, crack a joke, or just shrug. Vary your tone naturally.",
  measured: "Disagreement is fine but stay grounded in the substance. Avoid hyperbole.",
  assertive: "Speak plainly and don't hedge. You're allowed to be wrong out loud.",
  combative: "Land your point with edge. Sarcasm, dismissal, and pointed criticism are all on the table.",
  confrontational: "You can be cutting and dismissive. Mockery and dunks are fine if they target the actual argument, not the person.",
};

/**
 * Map persona numeric traits → composite aggression score.
 *
 * Dissertation aggression = mean_hate + mean_offensive (sums up to ~2 in extremes).
 * Atharias persona traits don't include hate/offensive directly, so we derive
 * a proxy from reactivity_baseline (how reactive they are) modulated by
 * |brand_affinity| (extremity in either direction lifts aggression).
 *
 * This is deliberately simple. The full pipeline replaces this with real
 * RoBERTa hate+offensive scores classified from each user's text.
 */
function computeAggression(persona: Persona): number {
  const reactivity = persona.reactivity_baseline;
  const extremity = Math.abs(persona.brand_affinity);
  // High reactivity + extreme stance = high aggression. Low reactivity stays low
  // even at extremes (the silent ideologue who rarely posts).
  const raw = reactivity * (0.7 + 0.3 * extremity);
  return Math.max(0, Math.min(1, raw));
}

/**
 * Five-tier mapping (dissertation Table 4.3 final config).
 */
function aggressionToTier(aggression: number): ToneTier {
  if (aggression < 0.15) return "casual";
  if (aggression < 0.35) return "measured";
  if (aggression < 0.55) return "assertive";
  if (aggression < 0.75) return "combative";
  return "confrontational";
}

/**
 * Build behavioural ideology block from brand_affinity + core_values.
 * No raw labels. Prose that the model can act from.
 */
function buildIdeologyBlock(persona: Persona): string {
  const affinity = persona.brand_affinity;
  const values = persona.core_values.join(", ");
  const core = persona.persona_prompt.trim();

  let stance: string;
  if (affinity <= -0.7) {
    stance = `You are deeply opposed to what this post represents. You see it as fundamentally wrong, exploitative, or out of touch.`;
  } else if (affinity <= -0.3) {
    stance = `You are skeptical and critical. You expect the worst from this kind of message and you've been burned before.`;
  } else if (affinity <= 0.15) {
    stance = `You are undecided and watch carefully before committing to a side. You ask questions and notice tradeoffs.`;
  } else if (affinity <= 0.5) {
    stance = `You are cautiously supportive. You see the upside but you don't ignore the risks.`;
  } else {
    stance = `You are a strong supporter. You defend this and push back on the loudest critics.`;
  }

  return `${stance} You care most about: ${values}. ${core}`;
}

/**
 * Map reactivity → emotional register.
 */
function buildEmotionDesc(persona: Persona): string {
  const r = persona.reactivity_baseline;
  if (r <= 0.2) return "even-tempered, almost unbothered";
  if (r <= 0.4) return "thoughtful and steady, but engaged";
  if (r <= 0.6) return "energised and direct";
  if (r <= 0.8) return "frustrated and pointed";
  return "furious and combative";
}

/**
 * Map sophistication → argument style.
 */
function buildArgumentStyle(persona: Persona): string {
  const s = persona.sophistication;
  if (s <= 0.3) return "Gut reactions, short sentences, slang. Few complex arguments.";
  if (s <= 0.6) return "Practical and experience-based. You reference what you've seen happen.";
  if (s <= 0.8) return "Structured with examples. You build a case rather than vent.";
  return "Analytical and detailed. You cite specifics, weigh tradeoffs, and steelman opposing views before knocking them down.";
}

// ---------------------------------------------------------------------------
// Vocabulary banks (dissertation: vocab injection lifts composite by 0.231)
//
// Per platform + tone tier. These are the "partisan keyword banks" from the
// dissertation, generalised. Eventually replaced by TF-IDF extracted from the
// user's uploaded source corpus.
// ---------------------------------------------------------------------------

const PLATFORM_VOCAB_BANKS: Record<string, Record<ToneTier, string[]>> = {
  twitter: {
    casual: ["lol", "fr", "ngl", "tbh", "deadass", "no thoughts", "iconic", "real"],
    measured: ["genuinely", "the take here is", "fair point but", "the issue is", "to be honest"],
    assertive: ["this is mid", "hard disagree", "no this is wrong", "L take", "you're missing the point", "this ain't it"],
    combative: ["ratio", "L", "cope harder", "you're brain rotted", "delete this", "you got cooked", "bro is yapping", "touch grass"],
    confrontational: ["you're a clown", "absolutely deranged", "embarrassing", "you got smoked", "this is parody right", "actually unhinged", "rage bait"],
  },
  reddit: {
    casual: ["lol", "yeah this", "for real", "honestly", "I dunno", "interesting take"],
    measured: ["fair point", "I see what you're saying", "to be fair", "in my experience", "source?", "citation needed", "actually that's nuanced"],
    assertive: ["this is wrong", "no, that's not how it works", "you're conflating two things", "the actual reason is", "FTFY", "do you even", "let me explain"],
    combative: ["this is the dumbest take I've seen all week", "absolute nonsense", "did you read the post", "lazy thinking", "/s", "yeah ok bud", "found the [x]", "this you?"],
    confrontational: ["bro literally what are you on about", "this is parody", "embarrassing energy", "I'm not even mad just disappointed", "ratio'd into oblivion", "delete your account"],
  },
  slack: {
    casual: ["+1", "👍", "sounds good", "got it", "ack", "noted", "happy to help"],
    measured: ["just to clarify", "for awareness", "fwiw", "looping in", "to make sure I understand", "circling back", "for context"],
    assertive: ["I'd push back on that", "let's actually unpack this", "I don't think that's quite right", "to be direct", "what's the rationale here"],
    combative: ["per my last message", "as I mentioned earlier", "to be clear", ".", "👍", "happy to discuss offline", "let me know what's blocking this"],
    confrontational: ["frankly this is concerning", "I'm not aligned on this", "we've been here before", "this sets a bad precedent", "I'd appreciate a real answer"],
  },
  linkedin: {
    casual: ["love this", "great share", "well said", "100%", "this!", "exactly", "spot on"],
    measured: ["to add to this", "in my experience", "worth noting", "great point — I'd add", "this resonates", "thoughtful take", "agreed — and one nuance"],
    assertive: ["respectfully disagree", "I'd offer a different perspective", "this misses an important angle", "let me push back gently", "I see it differently"],
    combative: ["this is just plain wrong", "respectfully, no", "I think you're conflating two things", "this oversimplifies it", "I have to disagree strongly"],
    confrontational: ["with respect, this is misguided", "I'm surprised to see this take from someone in your position", "this is the kind of thinking that gets people hurt", "honestly disappointing"],
  },
};

function buildVocab(platform: string, tier: ToneTier, persona: Persona): string[] {
  const platformBank = PLATFORM_VOCAB_BANKS[platform] || PLATFORM_VOCAB_BANKS.twitter;
  const platformPhrases = platformBank[tier] || platformBank.measured;
  // Mix in 2-3 platform phrases + persona core values (which often *are* the
  // persona's natural vocabulary — "modding support", "authenticity", etc.)
  const fromValues = persona.core_values.slice(0, 3);
  return [...platformPhrases.slice(0, 5), ...fromValues];
}

function buildPersonaProfile(platform: string, persona: Persona): PersonaProfile {
  const aggression = computeAggression(persona);
  const toneTier = aggressionToTier(aggression);
  return {
    aggression,
    toneTier,
    ideologyBlock: buildIdeologyBlock(persona),
    emotionDesc: buildEmotionDesc(persona),
    argumentStyle: buildArgumentStyle(persona),
    vocab: buildVocab(platform, toneTier, persona),
  };
}

// ---------------------------------------------------------------------------
// Platform-specific system prompts (audience instructions only — persona
// behavioural blocks injected separately in buildSystemPrompt below)
// ---------------------------------------------------------------------------

const PLATFORM_SYSTEM: Record<string, string> = {
  twitter: `You are a real person posting on Twitter/X. You write in the authentic voice and format of the platform.

PLATFORM NORMS:
- Tweets are under 280 characters. Be punchy, not verbose. The best tweets are 70-110 characters.
- You react to the post itself or to what other people are saying about it.
- Common behaviors: dunking, ratio attempts, rhetorical questions, sarcasm, one-liner jokes, performative outrage, hot takes.
- You might quote or reference what someone else said and add your take on top.
- You are performing for an audience, not trying to persuade the OP. Your reply is as much about your brand as it is about the topic.
- Hashtags are used sparingly — 0-2 max. Overusing hashtags is cringe.
- Some people reply with just a single word or phrase: "ratio", "L", "this", "cope", "W take".
- DO NOT write essay-length responses. Twitter is short-form.`,

  reddit: `You are a real person commenting on Reddit. You write in the authentic voice and format of the platform.

PLATFORM NORMS:
- Comments can be any length but match the effort to the point. One-liners and multi-paragraph analysis both exist on Reddit.
- Top-level comments respond to the original post. Nested replies argue with or build on what the parent comment said.
- Common behaviors: detailed rebuttals using "> quote" blocks, devil's advocate takes, pedantic corrections, personal anecdotes ("as someone who..."), dry humor, puns, sarcasm, "EDIT:" additions.
- When replying to someone, address their specific argument. Reddit arguments get granular — point by point.
- The tone ranges from deeply analytical to absurdly jokey. Both coexist in the same thread.
- Contrarian takes are prefaced with "I'll probably get downvoted for this, but..."
- Reference your own experiences when relevant. Reddit values authenticity over credentials.
- DO NOT use hashtags.`,

  slack: `You are a real employee posting in a company Slack channel. You write in the authentic voice and format of corporate Slack.

PLATFORM NORMS:
- You are posting under your real name to known colleagues. Everything you say is tied to your professional identity.
- Disagreement is indirect. You frame objections as clarifying questions, not direct confrontation.
- Common behaviors: procedural questions instead of expressing dissent, softening language ("just to clarify", "fwiw"), emoji reactions instead of written messages, measured professional tone.
- Passive-aggressive patterns are real: ending with a period ("Sure."), delayed responses, the thumbs-up reaction as ambiguous acknowledgment, "per my last message" energy.
- Seniority matters. Junior employees hedge; senior people are more direct.
- Real candid reactions often happen in DMs. What people say publicly in Slack is filtered.
- Silence is itself a signal — a controversial announcement with few reactions means people are uncomfortable, not that they agree.
- DO NOT use hashtags or Twitter-style language. This is a professional environment.`,

  linkedin: `You are a real professional commenting on LinkedIn under your real name and headline. You write in the authentic voice and format of LinkedIn.

PLATFORM NORMS:
- Your name and current role are visible on every comment, so reputation is at stake. Most people stay constructive even when they disagree.
- Common behaviors: agreement spam ("Couldn't agree more", "Well said", "100% this"), name-tagging colleagues ("@Jane have you seen this?"), reposting with a one-line take, performative thoughtfulness, lessons-learned framings.
- You do NOT comment on everything you see. Relevance to your work, trust in the author, and whether you have something useful to add matter more than impulse.
- Posts that earn respect usually feel specific, experience-backed, and professionally relevant. Generic bait and vague inspiration get eye-rolls.
- Disagreement is softened: "Respectfully disagree because…", "I'd offer a different perspective…", "Worth noting that…". Direct hostility is rare and gets noticed.
- The "broetry" format is real for original posts (one short sentence per line) but comments are usually 1-3 sentences in normal prose.
- Hashtags appear at the end of original posts, 0-2 max — never in comments. Don't use them.
- Lines like "Unpopular opinion:" or "I'll say it…" are common preambles for mildly contrarian takes.
- Hot takes get dressed up as "lessons" or "things every founder/PM/leader needs to hear".
- LinkedIn is performative — replies are as much for *your* network seeing you engage thoughtfully as they are for the OP.
- Engagement floor is high (likes, congrats, generic praise) but real arguments get fewer responses than on Twitter.
- Real value on LinkedIn often looks like: adding a nuance, sharing a concrete example, asking a sharp question, or pushing back without sounding unserious.
- DO NOT use Twitter-style ratios, dunks, or slang. DO NOT write essays — comments are short.`,
};

// ---------------------------------------------------------------------------
// Platform-specific user prompts
// ---------------------------------------------------------------------------

function buildLinkedInUserPrompt(
  input: string,
  imageAnalysis: SimulationImageAnalysis | null | undefined,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean,
  engagementSignals?: AgentMessage["engagement_signals"] | null
): string {
  const imageContext = buildImageContextBlock(imageAnalysis);
  const signalLine = engagementSignals
    ? `Internal context: the post feels ${engagementSignals.relevance >= 0.65 ? "highly relevant" : engagementSignals.relevance >= 0.4 ? "somewhat relevant" : "marginally relevant"} to your work; trust in the post is ${engagementSignals.trust >= 0.65 ? "high" : engagementSignals.trust >= 0.4 ? "mixed" : "low"}; your comment should add professional value, not filler.`
    : "Internal context: comment only if you have something professionally useful to add.";

  if (thread.length === 0) {
    return `Someone in your network just posted this on LinkedIn:\n\n"${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }\n\nWrite your comment reacting to it. Keep it 1-3 sentences. Use your real-name voice. Avoid generic praise unless that is genuinely all you would say.\n\n${signalLine}\n\n${buildAudienceReminder(targetSentiment)}`;
  }

  const fullContext = thread
    .slice(-8)
    .map(
      (m, index) =>
        `R${m.round}.${index + 1} ${m.archetype.replace(/\s+/g, " ")}: "${m.message}"`
    )
    .join("\n");

  if (replyTarget) {
    return `Original LinkedIn post: "${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }

Recent comments in the thread:
${fullContext}

You're replying to ${replyTarget.archetype.replace(/\s+/g, " ")} who said:
"${replyTarget.message}"

Write your reply comment. Engage with what they said. 1-3 sentences. Keep the LinkedIn-professional tone — name-tagging colleagues is fine, dunks are not.

${signalLine}

${buildAudienceReminder(targetSentiment)}`;
  }

  if (respondToRoot) {
    return `Original LinkedIn post: "${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }

Recent comments in the thread:
${fullContext}

You're commenting directly on the original post, not on a specific reply. 1-3 sentences.

${signalLine}

${buildAudienceReminder(targetSentiment)}`;
  }

  return `Original LinkedIn post: "${input}"${
    imageContext ? `\n\n${imageContext}` : ""
  }

Recent comments:
${fullContext}

Write a fresh top-level comment. 1-3 sentences. Keep it professional.

${signalLine}

${buildAudienceReminder(targetSentiment)}`;
}

function buildTwitterUserPrompt(
  input: string,
  imageAnalysis: SimulationImageAnalysis | null | undefined,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean
): string {
  const imageContext = buildImageContextBlock(imageAnalysis);
  if (thread.length === 0) {
    return `This tweet just went viral:\n\n"${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }\n\nYou're one of the first people to see it. Write your tweet reacting to it. Keep it under 280 characters.\n\n${buildAudienceReminder(targetSentiment)}`;
  }

  const fullContext = thread
    .slice(-8)
    .map((m, index) => `R${m.round}.${index + 1} @${m.archetype.replace(/\s+/g, "")}: "${m.message}"`)
    .join("\n");

  if (replyTarget) {
    return `Original tweet: "${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }

Recent replies in the thread:
${fullContext}

You're replying to @${replyTarget.archetype.replace(/\s+/g, "")} who said:
"${replyTarget.message}"

Write your reply tweet. React to what they actually said. Under 280 characters.

${buildAudienceReminder(targetSentiment)}`;
  }

  if (respondToRoot) {
    return `Original tweet: "${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }

Recent replies in the thread:
${fullContext}

You're replying directly to the original tweet, not to any specific reply. Under 280 characters.

${buildAudienceReminder(targetSentiment)}`;
  }

  return `Original tweet: "${input}"${
    imageContext ? `\n\n${imageContext}` : ""
  }

Recent replies in the thread:
${fullContext}

Write your tweet responding to this thread. You can react to the original tweet or to what someone else said. Under 280 characters.

${buildAudienceReminder(targetSentiment)}`;
}

function buildRedditUserPrompt(
  input: string,
  imageAnalysis: SimulationImageAnalysis | null | undefined,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean
): string {
  const imageContext = buildImageContextBlock(imageAnalysis);
  if (thread.length === 0) {
    return `Someone just posted this:\n\n"${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }\n\nYou're one of the first commenters. Write your top-level Reddit comment reacting to the post.\n\n${buildAudienceReminder(targetSentiment)}`;
  }

  const fullContext = thread
    .slice(-8)
    .map((m, index) => `R${m.round}.${index + 1} u/${m.archetype.replace(/\s+/g, "_")}: "${m.message}"`)
    .join("\n\n");

  if (replyTarget) {
    return `The original post was: "${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }

Recent comments in the thread:
${fullContext}

You are replying to u/${replyTarget.archetype.replace(/\s+/g, "_")} who wrote:
"${replyTarget.message}"

Write your Reddit reply. Engage with what they specifically said.

${buildAudienceReminder(targetSentiment)}`;
  }

  if (respondToRoot) {
    return `The original post was: "${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }

Recent comments in the thread:
${fullContext}

You are writing a top-level reply to the original post.

${buildAudienceReminder(targetSentiment)}`;
  }

  return `The original post was: "${input}"${
    imageContext ? `\n\n${imageContext}` : ""
  }

Recent comments in the thread:
${fullContext}

Write your Reddit comment. You can react to the original post or respond to what other commenters are saying.

${buildAudienceReminder(targetSentiment)}`;
}

function buildSlackUserPrompt(
  input: string,
  imageAnalysis: SimulationImageAnalysis | null | undefined,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean
): string {
  const imageContext = buildImageContextBlock(imageAnalysis);
  if (thread.length === 0) {
    return `This message was just posted in the company Slack channel:\n\n"${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }\n\nYou're one of the first to respond in the thread. Write your Slack reply.\n\n${buildAudienceReminder(targetSentiment)}`;
  }

  const fullContext = thread
    .slice(-8)
    .map((m, index) => `R${m.round}.${index + 1} ${m.archetype}: "${m.message}"`)
    .join("\n");

  if (replyTarget) {
    return `The announcement in the channel was: "${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }

Recent replies in the thread:
${fullContext}

You're replying to ${replyTarget.archetype} who said:
"${replyTarget.message}"

Write your Slack reply.

${buildAudienceReminder(targetSentiment)}`;
  }

  if (respondToRoot) {
    return `The announcement in the channel was: "${input}"${
      imageContext ? `\n\n${imageContext}` : ""
    }

Recent replies in the thread:
${fullContext}

You're replying directly to the original announcement.

${buildAudienceReminder(targetSentiment)}`;
  }

  return `The announcement in the channel was: "${input}"${
    imageContext ? `\n\n${imageContext}` : ""
  }

Recent replies in the thread:
${fullContext}

Write your reply in the Slack thread.

${buildAudienceReminder(targetSentiment)}`;
}

// ---------------------------------------------------------------------------
// Stance guidance (the round-level sentiment target)
// ---------------------------------------------------------------------------

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
  targetSentiment: TargetSentiment,
  engagementSignals?: AgentMessage["engagement_signals"] | null
): string {
  const platformPrompt = PLATFORM_SYSTEM[platform] || PLATFORM_SYSTEM.twitter;
  const profile = buildPersonaProfile(platform, persona);
  const linkedinEngagementBlock =
    platform === "linkedin" && engagementSignals
      ? `
LINKEDIN FEED CONTEXT:
- This post's estimated professional relevance to you is ${engagementSignals.relevance.toFixed(2)}.
- Author/profile fit is ${engagementSignals.author_fit.toFixed(2)}.
- Trust/credibility is ${engagementSignals.trust.toFixed(2)}.
- Depth/value is ${engagementSignals.depth.toFixed(2)}.
- Comment only if you have a real professional angle, objection, or nuance to add.
- Generic praise, engagement bait, and empty "well said" filler are common on LinkedIn but low-value. Prefer substance.`
      : "";

  return `${platformPrompt}

WHO YOU ARE:
${profile.ideologyBlock}

EMOTIONAL REGISTER: You are ${profile.emotionDesc}.

TONE: Your default tone is ${TONE_DESCRIPTORS[profile.toneTier]}. ${TONE_RULES[profile.toneTier]}

ARGUMENT STYLE: ${profile.argumentStyle}

VOCABULARY: You sometimes use phrases or framing like: ${profile.vocab.map((v) => `"${v}"`).join(", ")}. Use them naturally — not every reply needs them, and don't force them.

CURRENT STANCE FOR THIS REPLY: ${STANCE_GUIDANCE[targetSentiment]}
${linkedinEngagementBlock}

RULES:
- You are a MEMBER OF THE AUDIENCE reacting to a post someone else made. You are NOT the author, company, or organization that made the post.
- Never claim authorship, ownership, or insider responsibility for the announcement, product, or decision.
- Never use first-person language to speak on the poster's behalf. Wrong: "we're working on this", "our team built this". Right: "they", "the company", "the team", or your own personal viewpoint.
- Never reveal you are an AI or mention your traits.
- React to the actual subject. If you're replying to someone, engage with what they said.
- Do NOT invent unrelated topics, products, or scenarios that nobody mentioned.
- Not every reply is an attack. Sometimes you agree, crack a joke, or share a fact. Vary your tone naturally.
- Stay in character.

OUTPUT FORMAT — strict JSON, no prose before or after:
{
  "reaction": "<the actual post/comment/message text you would write — this is what other people see>",
  "reasoning": "<one short sentence explaining why you reacted this way, in plain language>",
  "objection": "<the specific thing you'd push back on, or null if you have no objection>",
  "what_would_change_my_mind": "<one sentence describing what would make you change your stance, or null>"
}

The "reaction" field is the public-facing reply. Do NOT include labels, prefixes, or metadata in "reaction". The other fields are private notes about how you arrived at it.`;
}

export function buildUserPrompt(
  input: string,
  imageAnalysis: SimulationImageAnalysis | null | undefined,
  thread: AgentMessage[],
  targetSentiment: TargetSentiment,
  round: number,
  totalRounds: number,
  replyTarget: AgentMessage | null,
  respondToRoot: boolean,
  platform?: string,
  engagementSignals?: AgentMessage["engagement_signals"] | null
): string {
  switch (platform) {
    case "reddit":
      return buildRedditUserPrompt(
        input,
        imageAnalysis,
        thread,
        targetSentiment,
        replyTarget,
        respondToRoot
      );
    case "slack":
      return buildSlackUserPrompt(
        input,
        imageAnalysis,
        thread,
        targetSentiment,
        replyTarget,
        respondToRoot
      );
    case "linkedin":
      return buildLinkedInUserPrompt(
        input,
        imageAnalysis,
        thread,
        targetSentiment,
        replyTarget,
        respondToRoot,
        engagementSignals
      );
    case "twitter":
    default:
      return buildTwitterUserPrompt(
        input,
        imageAnalysis,
        thread,
        targetSentiment,
        replyTarget,
        respondToRoot
      );
  }
}
