import type { Persona } from "@/lib/schemas";
import type { AgentEngagementSignals, AgentMessage } from "./types";

type PersonaRoleFamily =
  | "founder"
  | "marketing"
  | "sales"
  | "product"
  | "engineering"
  | "operations"
  | "finance"
  | "people"
  | "design"
  | "investor"
  | "generalist";

type PersonaSeniority =
  | "junior"
  | "mid"
  | "senior"
  | "director"
  | "executive";

const LINKEDIN_STOPWORDS = new Set([
  "about", "after", "again", "also", "always", "because", "before", "being",
  "below", "between", "building", "could", "every", "first", "great", "have",
  "here", "just", "like", "made", "make", "more", "most", "need", "next",
  "over", "really", "share", "should", "some", "than", "that", "their",
  "there", "these", "they", "this", "those", "through", "today", "want",
  "when", "with", "would", "your", "from", "into", "onto", "under", "across",
  "been", "were", "what", "where", "which", "while", "still", "then", "them",
  "will", "dont", "youre", "weve", "ive", "im", "our", "ours", "we're",
  "weve", "we", "i", "me", "my", "mine", "you", "yours", "the", "and", "for",
  "are", "not", "but", "all", "any", "its", "it's", "too", "got", "why",
  "how", "use", "used", "using", "gets", "getting", "good", "best", "better",
  "people", "teams", "team", "leaders", "founders", "operators",
]);

const ROLE_FAMILY_PATTERNS: Array<[PersonaRoleFamily, RegExp]> = [
  ["founder", /\b(founder|co-?founder|owner|ceo|chief executive|managing partner)\b/i],
  ["marketing", /\b(marketing|growth|demand gen|brand|content|comms|communications|social media|community|pr)\b/i],
  ["sales", /\b(sales|account executive|account manager|sdr|bdr|revenue|gtm|customer success|partnerships)\b/i],
  ["product", /\b(product|pm\b|product manager|product lead|ux research)\b/i],
  ["engineering", /\b(engineer|engineering|developer|software|platform|infra|infrastructure|data|ml|machine learning|ai|architect|devops|sre)\b/i],
  ["operations", /\b(operations|ops|program manager|program management|bizops|strategy|supply chain|support)\b/i],
  ["finance", /\b(finance|financial|accounting|controller|fp&a|procurement)\b/i],
  ["people", /\b(people|hr\b|human resources|talent|recruiting|recruiter|learning and development)\b/i],
  ["design", /\b(design|designer|ux\b|ui\b|research|creative|brand designer)\b/i],
  ["investor", /\b(investor|venture|vc\b|principal|associate|analyst)\b/i],
];

const SENIORITY_PATTERNS: Array<[PersonaSeniority, RegExp]> = [
  ["executive", /\b(founder|ceo|cto|cmo|cfo|coo|cpo|chief|president|partner|owner)\b/i],
  ["director", /\b(vp|vice president|svp|evp|director|head of)\b/i],
  ["senior", /\b(principal|staff|lead|senior|sr\.?)\b/i],
  ["junior", /\b(junior|jr\.?|intern|assistant|associate|coordinator|entry)\b/i],
];

const ROLE_FAMILY_PRIORITIES: Record<PersonaRoleFamily, string[]> = {
  founder: ["growth", "distribution", "market signal", "speed", "category narrative"],
  marketing: ["audience fit", "distribution", "brand clarity", "shareability", "positioning"],
  sales: ["buyer trust", "pipeline", "commercial proof", "objection handling", "conversion"],
  product: ["user adoption", "roadmap clarity", "tradeoffs", "retention", "feature value"],
  engineering: ["technical depth", "reliability", "systems thinking", "implementation detail", "credibility"],
  operations: ["execution", "efficiency", "process clarity", "risk management", "follow-through"],
  finance: ["unit economics", "forecasting", "cost discipline", "return on investment", "material impact"],
  people: ["culture", "hiring signal", "trust", "retention", "manager credibility"],
  design: ["craft", "clarity", "user experience", "taste", "communication quality"],
  investor: ["signal", "market timing", "narrative quality", "founder credibility", "durability"],
  generalist: ["clarity", "professional value", "signal", "credibility", "practicality"],
};

const BAIT_PATTERNS = [
  /comment\s+["']?[a-z0-9_-]+["']?/i,
  /\bcomment below\b/i,
  /\bdrop\b.+\b(comment|word)\b/i,
  /\bfollow for\b/i,
  /\blike if\b/i,
  /\bshare if\b/i,
  /\btag someone\b/i,
  /\bdm me\b/i,
  /\bdouble tap\b/i,
];

const GENERIC_PATTERNS = [
  /\b3 lessons\b/i,
  /\b5 things\b/i,
  /\bunpopular opinion\b/i,
  /\bgame[- ]changer\b/i,
  /\bin today's world\b/i,
  /\blet that sink in\b/i,
  /\bthrilled to announce\b/i,
  /\bexcited to announce\b/i,
  /\bhumbled to share\b/i,
  /\bleadership is\b/i,
  /\bevery leader needs to\b/i,
  /\bai is changing everything\b/i,
  /\bthe winners will adapt\b/i,
  /\bthe losers will complain\b/i,
  /\bnow is the time to build\b/i,
];

const ANNOUNCEMENT_PATTERNS = [
  /\bthrilled to announce\b/i,
  /\bexcited to share\b/i,
  /\bhappy to share\b/i,
  /\bproud to share\b/i,
  /\bi'?ll be joining\b/i,
  /\bstarted my\b/i,
  /\bwe'?re going to\b/i,
  /\bgoing to sweden\b/i,
  /\bspace is limited\b/i,
  /\bapply in the comments\b/i,
];

const CONFLICT_PATTERNS = [
  /\bstole\b/i,
  /\bcop(?:y|ied)\b/i,
  /\bwild part\b/i,
  /\bfor real\b/i,
  /\blevel 0\b/i,
  /\bbut\b.+\b(?:didn'?t|wouldn'?t|wasn'?t)\b/i,
  /\bhomework\b/i,
  /\bwith worse\b/i,
];

const MOMENTUM_PATTERNS = [
  /\bhour\s+\d+\b/i,
  /\bby \d+(?:am|pm)\b/i,
  /\bby tomorrow\b/i,
  /\b48 hours\b/i,
  /\bjust sold\b/i,
  /\bhit\s+[£$€]?\d[\dkm,.]*\s*(?:drr|mrr|arr|revenue)?\b/i,
  /\bmultiple sponsors\b/i,
  /\bsponsored by\b/i,
  /\bthis saturday\b/i,
  /\bthis summer\b/i,
];

const FUTURE_HYPE_PATTERNS = [
  /\bwe'?re going to\b/i,
  /\bgoing to\b/i,
  /\bthis summer\b/i,
  /\bon monday\b/i,
  /\bapply in the comments\b/i,
  /\bspace is limited\b/i,
  /\bjoin(?:ing)?\b/i,
];

const PROOF_PATTERNS = [
  /\bbuilt\b/i,
  /\bshipped\b/i,
  /\bwon\b/i,
  /\blaunched\b/i,
  /\bhit\s+[£$€]?\d[\dkm,.]*/i,
  /\bsold\b/i,
  /\bdemo\b/i,
  /\bprototype\b/i,
  /\bsponsors?\b/i,
  /\bcustomers?\b/i,
  /\busers?\b/i,
  /\brevenue\b/i,
  /\bdrr\b/i,
  /\bmrr\b/i,
];

const GENERIC_ACHIEVEMENT_PATTERNS = [
  /\bwinner!?$/i,
  /\bwon\b/i,
  /\b2nd place\b/i,
  /\bprize\b/i,
  /\bhackathon win\b/i,
];

const B2B_KEYWORDS = [
  "arr", "pipeline", "demand gen", "attribution", "retention", "churn", "onboarding",
  "enterprise", "icp", "messaging", "positioning", "ops", "sales cycle", "revenue",
  "activation", "pricing", "rollout", "hiring", "infra", "roadmap", "conversion",
  "founder", "operators", "procurement", "implementation", "margin", "ltv", "cac",
  "linkedin", "revops", "handoffs", "forecast", "friction", "distribution", "saves",
  "drr", "mrr", "sponsors", "launch", "demo", "cohort", "fellow", "funded",
];

const GENERIC_PRAISE_PATTERNS = [
  /^great share[.!]?$/i,
  /^well said[.!]?$/i,
  /^this!$/i,
  /^100%[.!]?$/i,
  /^love this[.!]?$/i,
];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function unique(items: string[], limit?: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(item.trim());
    if (typeof limit === "number" && out.length >= limit) break;
  }
  return out;
}

function normalizeToken(token: string) {
  return token
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9&+-]/g, "")
    .replace(/(?:ing|ed|es|s)$/g, "");
}

function keywordTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9#&+\-.\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 3 && !LINKEDIN_STOPWORDS.has(token));
}

function overlaps(a: string[], b: string[]) {
  const right = new Set(b.map(normalizeToken).filter(Boolean));
  if (right.size === 0) return 0;
  const left = unique(a.map(normalizeToken).filter(Boolean));
  const matchCount = left.filter((token) => right.has(token)).length;
  return clamp(matchCount / Math.max(3, Math.min(left.length, right.size)));
}

export function inferRoleFamilyFromText(text: string | null | undefined): PersonaRoleFamily {
  const source = text ?? "";
  for (const [family, pattern] of ROLE_FAMILY_PATTERNS) {
    if (pattern.test(source)) return family;
  }
  return "generalist";
}

export function inferSeniorityFromText(text: string | null | undefined): PersonaSeniority {
  const source = text ?? "";
  for (const [seniority, pattern] of SENIORITY_PATTERNS) {
    if (pattern.test(source)) return seniority;
  }
  return "mid";
}

export function defaultPrioritiesForRoleFamily(roleFamily: PersonaRoleFamily) {
  return ROLE_FAMILY_PRIORITIES[roleFamily] ?? ROLE_FAMILY_PRIORITIES.generalist;
}

export function extractLinkedInExpertise(
  roleHint: string | null | undefined,
  keywords: string[] = []
) {
  return unique([
    ...buildRoleTokens(roleHint),
    ...keywords,
  ], 8);
}

function buildRoleTokens(roleHint: string | null | undefined) {
  if (!roleHint) return [];
  return keywordTokens(roleHint)
    .filter((token) => !["manager", "director", "senior", "junior", "associate"].includes(token))
    .slice(0, 4);
}

function sentenceCount(text: string) {
  return text
    .split(/[.!?]\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
}

export interface LinkedInPostSignals {
  topics: string[];
  hashtag_count: number;
  link_count: number;
  specificity: number;
  depth: number;
  professional_relevance: number;
  personal_voice: number;
  company_broadcast: number;
  engagement_bait: number;
  generic_leadership: number;
  announcement_slop: number;
  conflict_novelty: number;
  momentum_signal: number;
  proof_density: number;
  future_hype: number;
  achievement_broadcast: number;
  hashtag_precision: number;
  inferred_surface: "personal" | "company";
}

export interface LinkedInPersonaLens {
  role_family: PersonaRoleFamily;
  seniority: PersonaSeniority;
  expertise: string[];
  priorities: string[];
  voice: string;
}

export function analyzeLinkedInPost(input: string): LinkedInPostSignals {
  const lower = input.toLowerCase();
  const hashtags = input.match(/#[a-z0-9_]+/gi) ?? [];
  const linkCount = (input.match(/https?:\/\/|www\./gi) ?? []).length;
  const tokens = keywordTokens(input);
  const topics = unique([
    ...hashtags.map((tag) => tag.replace(/^#/, "")),
    ...tokens,
  ], 10);
  const numbers = (input.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).length;
  const acronyms = (input.match(/\b[A-Z]{2,6}\b/g) ?? []).length;
  const b2bHits = B2B_KEYWORDS.filter((keyword) => lower.includes(keyword)).length;
  const sentences = sentenceCount(input);
  const baitMatches = countMatches(lower, BAIT_PATTERNS);
  const genericMatches = countMatches(lower, GENERIC_PATTERNS);
  const announcementMatches = countMatches(lower, ANNOUNCEMENT_PATTERNS);
  const conflictMatches = countMatches(lower, CONFLICT_PATTERNS);
  const momentumMatches = countMatches(lower, MOMENTUM_PATTERNS);
  const futureHypeMatches = countMatches(lower, FUTURE_HYPE_PATTERNS);
  const proofMatches = countMatches(lower, PROOF_PATTERNS);
  const achievementMatches = countMatches(lower, GENERIC_ACHIEVEMENT_PATTERNS);
  const personalPronouns = (lower.match(/\b(i|i've|i’d|my|me)\b/g) ?? []).length;
  const companyPronouns = (lower.match(/\b(we|we've|we’re|our|us)\b/g) ?? []).length;
  const listStyle = /\n[-*•]|\n\d+\./.test(input) ? 1 : 0;
  const topicDensity = clamp(topics.length / 8);
  const currencyMentions = (input.match(/[£$€]\s?\d[\dkm,.]*/g) ?? []).length;
  const exclamations = (input.match(/!/g) ?? []).length;

  const specificity = clamp(
    0.18 +
      numbers * 0.08 +
      acronyms * 0.05 +
      b2bHits * 0.07 +
      topicDensity * 0.15 -
      genericMatches * 0.08 -
      announcementMatches * 0.05,
  );

  const depth = clamp(
    0.15 +
      Math.min(sentences, 6) * 0.08 +
      listStyle * 0.12 +
      numbers * 0.05 +
      Math.min(input.length, 1200) / 2400,
  );

  const professionalRelevance = clamp(
    0.18 +
      b2bHits * 0.08 +
      topicDensity * 0.2 +
      specificity * 0.22 +
      momentumMatches * 0.05,
  );

  const personalVoice = clamp(
    0.1 +
      personalPronouns * 0.08 +
      (/\bin my experience\b|\bi learned\b|\bi was wrong\b/i.test(input) ? 0.15 : 0),
  );

  const companyBroadcast = clamp(
    0.15 +
      companyPronouns * 0.08 +
      (/\bexcited to announce\b|\bproud to share\b|\bofficially\b|\blaunching\b|\bpress release\b/i.test(input)
        ? 0.22
        : 0),
  );

  const hashtagPrecision = hashtags.length === 0
    ? 0.5
    : clamp(
        unique(hashtags.map((tag) => tag.replace(/^#/, "").toLowerCase())).length /
          Math.max(hashtags.length, 1),
      );

  const announcementSlop = clamp(
    announcementMatches * 0.22 +
      (/\bjoin(?:ing)?\b/i.test(input) ? 0.08 : 0) +
      (/\bstarted my\b/i.test(input) ? 0.1 : 0) +
      (/\bexcited\b/i.test(input) && numbers === 0 ? 0.08 : 0),
  );

  const conflictNovelty = clamp(
    conflictMatches * 0.24 +
      (/\b(?:yc|y combinator)\b/i.test(input) ? 0.14 : 0) +
      (/\bhackathon\b/i.test(input) && /sauna|naked/i.test(input) ? 0.16 : 0) +
      Math.min(exclamations, 3) * 0.03,
  );

  const momentumSignal = clamp(
    momentumMatches * 0.2 +
      currencyMentions * 0.14 +
      (/\b(?:today|now|this week|seven hours ago)\b/i.test(input) ? 0.08 : 0) +
      (numbers >= 2 ? 0.08 : 0),
  );

  const proofDensity = clamp(
    proofMatches * 0.16 +
      numbers * 0.04 +
      currencyMentions * 0.08 +
      (/\b(?:because|how|behind the scenes|we built|i built)\b/i.test(input) ? 0.1 : 0),
  );

  const futureHype = clamp(
    futureHypeMatches * 0.16 +
      Math.max(0, futureHypeMatches - proofMatches) * 0.12 +
      (/\bgoing to\b/i.test(input) && proofMatches === 0 ? 0.12 : 0),
  );

  const achievementBroadcast = clamp(
    achievementMatches * 0.14 +
      (/\bwinner\b/i.test(input) && proofDensity < 0.24 ? 0.12 : 0) +
      (/\bcongrats?\b|\bgrateful\b|\bthrilled\b/i.test(input) && proofMatches <= 1 ? 0.08 : 0),
  );

  return {
    topics,
    hashtag_count: hashtags.length,
    link_count: linkCount,
    specificity,
    depth,
    professional_relevance: professionalRelevance,
    personal_voice: personalVoice,
    company_broadcast: companyBroadcast,
    engagement_bait: clamp(baitMatches * 0.35),
    generic_leadership: clamp(genericMatches * 0.25),
    announcement_slop: announcementSlop,
    conflict_novelty: conflictNovelty,
    momentum_signal: momentumSignal,
    proof_density: proofDensity,
    future_hype: futureHype,
    achievement_broadcast: achievementBroadcast,
    hashtag_precision: hashtagPrecision,
    inferred_surface: companyPronouns > personalPronouns + 1 ? "company" : "personal",
  };
}

export function buildLinkedInPersonaLens(persona: Persona): LinkedInPersonaLens {
  const roleHint = persona.role_hint ?? persona.archetype ?? persona.persona_prompt ?? "";
  const roleFamily = persona.role_family ?? inferRoleFamilyFromText(roleHint);
  const seniority = persona.seniority ?? inferSeniorityFromText(roleHint);
  const expertise = unique([
    ...(persona.topical_expertise ?? []),
    ...buildRoleTokens(persona.role_hint),
    ...buildRoleTokens(persona.archetype),
    ...persona.core_values,
  ], 8);

  return {
    role_family: roleFamily,
    seniority,
    expertise,
    priorities: ROLE_FAMILY_PRIORITIES[roleFamily] ?? ROLE_FAMILY_PRIORITIES.generalist,
    voice: persona.professional_voice ?? "professional, reputation-aware",
  };
}

function surfaceFit(lens: LinkedInPersonaLens, post: LinkedInPostSignals) {
  if (post.inferred_surface === "company") {
    if (lens.role_family === "marketing" || lens.role_family === "investor") return 0.58;
    if (lens.seniority === "executive" || lens.seniority === "director") return 0.5;
    return 0.34;
  }

  if (lens.role_family === "founder" || lens.role_family === "marketing") return 0.72;
  if (lens.seniority === "executive" || lens.seniority === "director") return 0.65;
  return 0.56;
}

function seniorityWeight(seniority: PersonaSeniority) {
  switch (seniority) {
    case "executive":
      return 0.78;
    case "director":
      return 0.68;
    case "senior":
      return 0.56;
    case "mid":
      return 0.48;
    case "junior":
      return 0.36;
  }
}

function baitPenalty(post: LinkedInPostSignals) {
  const hashtagPenalty =
    post.hashtag_count <= 3
      ? 0
      : clamp((post.hashtag_count - 3) * 0.08);
  const linkPenalty =
    post.link_count === 0
      ? 0
      : clamp(0.08 + post.link_count * 0.06 + (post.inferred_surface === "personal" ? 0.06 : 0));

  return clamp(
    post.engagement_bait * 0.58 +
      post.generic_leadership * 0.34 +
      post.announcement_slop * 0.46 +
      post.future_hype * 0.34 +
      post.achievement_broadcast * 0.18 +
      hashtagPenalty +
      linkPenalty,
  );
}

export function inferLinkedInEngagementSignals(
  persona: Persona,
  input: string,
  thread: AgentMessage[],
  round: number
): AgentEngagementSignals {
  const lens = buildLinkedInPersonaLens(persona);
  const post = analyzeLinkedInPost(input);
  const topicMatch = Math.max(
    overlaps(post.topics, lens.expertise),
    overlaps(post.topics, lens.priorities),
  );
  const fit = surfaceFit(lens, post);
  const penalty = baitPenalty(post);
  const priorThread = thread.filter((message) => message.engagement_signals);
  const avgSave = priorThread.length === 0
    ? 0.5
    : priorThread.reduce((sum, message) => sum + (message.engagement_signals?.save_intent ?? 0), 0) / priorThread.length;
  const avgDepth = priorThread.length === 0
    ? 0.45
    : priorThread.reduce((sum, message) => sum + (message.engagement_signals?.depth ?? 0), 0) / priorThread.length;
  const negativity = priorThread.length === 0
    ? 0
    : priorThread.filter((message) => message.sentiment === "negative" || message.sentiment === "hostile").length / priorThread.length;
  const replyDepth = priorThread.length === 0
    ? 0
    : priorThread.filter((message) => message.reply_to).length / priorThread.length;

  const relevance = clamp(
    topicMatch * 0.42 +
      post.professional_relevance * 0.14 +
      fit * 0.14 +
      seniorityWeight(lens.seniority) * 0.05 +
      persona.sophistication * 0.07 +
      post.momentum_signal * 0.08 +
      post.conflict_novelty * 0.08 +
      post.proof_density * 0.08 +
      post.personal_voice * 0.08 -
      penalty * 0.22,
  );

  const trust = clamp(
      post.specificity * 0.3 +
      post.depth * 0.16 +
      fit * 0.16 +
      post.momentum_signal * 0.08 +
      post.proof_density * 0.12 +
      (1 - post.company_broadcast) * 0.08 +
      (1 - post.engagement_bait) * 0.18 +
      post.hashtag_precision * 0.05 -
      penalty * 0.16,
  );

  const depth = clamp(
      post.depth * 0.4 +
      post.specificity * 0.25 +
      post.momentum_signal * 0.08 +
      post.proof_density * 0.08 +
      topicMatch * 0.15 +
      persona.sophistication * 0.15,
  );

  const saveIntent = clamp(
    depth * 0.36 +
      trust * 0.26 +
      relevance * 0.18 +
      post.momentum_signal * 0.08 +
      post.conflict_novelty * 0.06 +
      post.proof_density * 0.08 +
      persona.sophistication * 0.12 -
      penalty * 0.18,
  );

  const earlyMomentum = clamp(
    0.28 + avgSave * 0.26 + avgDepth * 0.18 + replyDepth * 0.12 - negativity * 0.12,
  );
  const tailMomentum = clamp(
    0.24 + saveIntent * 0.26 + depth * 0.22 + relevance * 0.16 - negativity * 0.08,
  );
  const roundWeight =
    round <= 2 ? 1 :
    round <= 5 ? earlyMomentum :
    tailMomentum;

  const commentIntent = clamp(
    (relevance * 0.32 +
      trust * 0.18 +
      depth * 0.16 +
      post.conflict_novelty * 0.08 +
      persona.reactivity_baseline * 0.18 +
      Math.max(0, -persona.brand_affinity) * 0.08 +
      roundWeight * 0.1) -
      penalty * 0.18,
  );

  return {
    relevance,
    author_fit: fit,
    trust,
    depth,
    save_intent: saveIntent,
    comment_intent: commentIntent,
  };
}

export function inferLinkedInTargetSentiment(
  persona: Persona,
  signals: AgentEngagementSignals
): AgentMessage["sentiment"] {
  const skepticism = clamp(Math.max(0, -persona.brand_affinity));
  const support = clamp(Math.max(0, persona.brand_affinity));
  const criticism = clamp(
    skepticism * 0.38 +
      (1 - signals.trust) * 0.24 +
      (1 - signals.author_fit) * 0.16 +
      (1 - signals.relevance) * 0.12 +
      (persona.reactivity_baseline * 0.1),
  );

  if (signals.relevance < 0.22 && signals.comment_intent < 0.18) {
    return "neutral";
  }
  if (support * 0.42 + signals.trust * 0.28 + signals.save_intent * 0.2 >= criticism + 0.08) {
    return "positive";
  }
  if (criticism >= 0.68 && persona.reactivity_baseline >= 0.82 && skepticism >= 0.55) {
    return "hostile";
  }
  if (criticism >= 0.42) {
    return "negative";
  }
  return signals.relevance >= 0.45 ? "positive" : "neutral";
}

export function replyProbabilityForLinkedIn(
  persona: Persona,
  signals: AgentEngagementSignals,
  round: number
): number {
  const phaseBoost =
    round <= 2 ? 1 :
    round <= 5 ? 0.82 :
    0.62;

  const raw =
    0.008 +
    signals.comment_intent * 0.085 * phaseBoost +
    signals.relevance * 0.018 +
    Math.max(0, -persona.brand_affinity) * 0.01;

  return clamp(raw, 0.004, 0.16);
}

export function shouldPreferRootComment(
  signals: AgentEngagementSignals,
  thread: AgentMessage[]
): boolean {
  const replyRate = thread.length === 0
    ? 0
    : thread.filter((message) => message.reply_to).length / thread.length;
  const rootBias = clamp(0.72 + (1 - replyRate) * 0.18 + signals.depth * 0.05 - signals.comment_intent * 0.06);
  return Math.random() < rootBias;
}

export function scoreLinkedInDraftForAudience(personas: Persona[], input: string) {
  const post = analyzeLinkedInPost(input);
  if (personas.length === 0) {
    return {
      qualified_engagement: 0,
      avg_relevance: 0,
      avg_save_intent: 0,
      avg_trust: 0,
      avg_comment_intent: 0,
      likely_commenters: 0,
      draft_signals: {
        proof_density: post.proof_density,
        momentum_signal: post.momentum_signal,
        conflict_novelty: post.conflict_novelty,
        future_hype: post.future_hype,
        announcement_slop: post.announcement_slop,
      },
    };
  }

  const syntheticThread: AgentMessage[] = [];
  const signals = personas.map((persona) =>
    inferLinkedInEngagementSignals(persona, input, syntheticThread, 1)
  );

  const avg = (selector: (signal: AgentEngagementSignals) => number) =>
    signals.reduce((sum, signal) => sum + selector(signal), 0) / signals.length;

  const likelyCommenters = signals.filter((signal) => signal.comment_intent >= 0.42).length;
  const qualifiedEngagement = clamp(
    avg((signal) => signal.depth) * 0.18 +
      avg((signal) => signal.save_intent) * 0.28 +
      avg((signal) => signal.trust) * 0.22 +
      avg((signal) => signal.relevance) * 0.22 +
      avg((signal) => signal.comment_intent) * 0.1,
  );

  return {
    qualified_engagement: qualifiedEngagement,
    avg_relevance: avg((signal) => signal.relevance),
    avg_save_intent: avg((signal) => signal.save_intent),
    avg_trust: avg((signal) => signal.trust),
    avg_comment_intent: avg((signal) => signal.comment_intent),
    likely_commenters: likelyCommenters / personas.length,
    draft_signals: {
      proof_density: post.proof_density,
      momentum_signal: post.momentum_signal,
      conflict_novelty: post.conflict_novelty,
      future_hype: post.future_hype,
      announcement_slop: post.announcement_slop,
    },
  };
}

export function inferGenericLinkedInCommentQuality(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return 0;
  if (GENERIC_PRAISE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return 0.18;
  }

  const specifics =
    (trimmed.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).length +
    (/\b(because|specifically|for example|in practice|tradeoff|nuance)\b/i.test(trimmed) ? 1 : 0);

  return clamp(
    0.22 +
      Math.min(trimmed.length, 220) / 360 +
      specifics * 0.12,
  );
}
