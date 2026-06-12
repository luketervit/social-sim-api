import type { Persona } from "@/lib/schemas";
import type { ParsedRow } from "./types";
import type { RowScores } from "./classify";
import {
  defaultPrioritiesForRoleFamily,
  extractLinkedInExpertise,
  inferRoleFamilyFromText,
  inferSeniorityFromText,
} from "@/lib/simulation/linkedinSignals";

const ROLE_FIELD_KEYS = [
  "position",
  "title",
  "job title",
  "job_title",
  "headline",
  "role",
  "current position",
];

const SENIORITY = {
  exec: /(founder|ceo|cto|cmo|cfo|coo|cpo|chief|president|owner|managing partner|partner)\b/i,
  vp: /\b(vp|vice president|svp|evp)\b/i,
  director: /\b(director|head of)\b/i,
  manager: /\b(manager|lead|principal|staff)\b/i,
  senior: /\b(senior|sr\.?)\b/i,
  junior: /\b(junior|jr\.?|intern|trainee|graduate|entry[- ]level|associate)\b/i,
};

const VOICE = {
  loud:
    /\b(marketing|comms|communications|brand|content|advocate|evangelist|pr|product marketing|growth|founder|ceo|investor|venture|advisor)\b/i,
  technical:
    /\b(engineer|engineering|developer|software|data|machine learning|ml|ai|research|researcher|scientist|architect|infra|infrastructure|devops|sre)\b/i,
  ops: /\b(operations|finance|accounting|legal|compliance|hr|people|talent|recruiting)\b/i,
  design: /\b(design|designer|product designer|ux|ui|brand designer|illustrator)\b/i,
};

function pickField(
  fields: Record<string, string>,
  candidateKeys: string[]
): string | null {
  // Exact-key match first.
  for (const key of Object.keys(fields)) {
    if (candidateKeys.includes(key.toLowerCase().trim())) {
      const value = fields[key]?.trim();
      if (value && value.length > 1 && value.length < 200) return value;
    }
  }
  return null;
}

function anonymiseRole(rawRole: string): string {
  // Strip "Engineer at Acme" / "Engineer @ Acme" / "Engineer - Acme" /
  // "Engineer | Acme" → "Engineer". Whatever follows these separators is
  // almost always a company name and would leak identity.
  let cleaned = rawRole.replace(/\s+/g, " ").trim();
  cleaned = cleaned.split(/\s+(?:at|@)\s+/i)[0] ?? cleaned;
  cleaned = cleaned.split(/\s+[|·•—–-]\s+/)[0] ?? cleaned;
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  return cleaned.slice(0, 60);
}

function extractArchetypeFromFields(
  fields: Record<string, string> | undefined
): { label: string; role: string } | null {
  if (!fields) return null;
  const role = pickField(fields, ROLE_FIELD_KEYS);
  if (!role) return null;
  const cleanRole = anonymiseRole(role);
  if (cleanRole.length === 0) return null;
  return { label: cleanRole, role: cleanRole };
}

function reactivityFromRole(role: string): number {
  // Loud-and-senior = highest. Technical/quiet = lower. Junior = quietest.
  if (SENIORITY.exec.test(role) && VOICE.loud.test(role)) return 0.78;
  if (SENIORITY.exec.test(role)) return 0.6;
  if (SENIORITY.vp.test(role) && VOICE.loud.test(role)) return 0.65;
  if (SENIORITY.vp.test(role)) return 0.5;
  if (SENIORITY.director.test(role) && VOICE.loud.test(role)) return 0.6;
  if (SENIORITY.director.test(role)) return 0.45;
  if (VOICE.loud.test(role)) return 0.55;
  if (SENIORITY.junior.test(role)) return 0.2;
  if (VOICE.technical.test(role)) return 0.3;
  if (VOICE.design.test(role)) return 0.4;
  if (VOICE.ops.test(role)) return 0.3;
  if (SENIORITY.senior.test(role) || SENIORITY.manager.test(role)) return 0.5;
  return 0.4;
}

function sophisticationFromRole(role: string): number {
  let base = 0.5;
  if (SENIORITY.exec.test(role)) base = 0.88;
  else if (SENIORITY.vp.test(role)) base = 0.82;
  else if (SENIORITY.director.test(role)) base = 0.75;
  else if (SENIORITY.senior.test(role) || SENIORITY.manager.test(role)) base = 0.65;
  else if (SENIORITY.junior.test(role)) base = 0.32;
  if (VOICE.technical.test(role)) base = Math.min(0.95, base + 0.08);
  if (VOICE.ops.test(role)) base = Math.min(0.95, base + 0.04);
  return base;
}

function affinityFromRole(role: string, indexSeed: number): number {
  // Spread roles across a mild affinity range so the chat reflects diversity
  // even before classifier scores carry signal. Deterministic per-row.
  const roleSeed =
    role
      .toLowerCase()
      .split("")
      .reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) % 997, 7) /
    997;
  const indexNoise = (indexSeed * 0.137) % 1;
  // Map [0,1) to [-0.45, 0.45) baseline.
  let value = (roleSeed - 0.5) * 0.9;
  // Voicey marketing/founders skew slightly positive about novel products.
  if (VOICE.loud.test(role)) value += 0.1;
  // Engineers / scientists skew slightly skeptical by default.
  if (VOICE.technical.test(role)) value -= 0.1;
  // Compliance / legal skew negative on bold posts.
  if (VOICE.ops.test(role)) value -= 0.05;
  value += (indexNoise - 0.5) * 0.15;
  return Math.max(-0.85, Math.min(0.85, value));
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","of","in","on","for","to","with",
  "is","are","was","were","be","been","being","i","you","he","she","it","we",
  "they","them","my","your","our","their","this","that","these","those","at",
  "as","by","from","up","down","out","into","about","over","under","just",
  "really","very","so","not","no","yes","do","does","did","done","have","has",
  "had","will","would","can","could","should","might","may","what","when",
  "where","who","why","how","there","here","like","because","also","more","than",
  "too","much","get","got","go","going","one","some","any","all","every","much",
  "lot","still","even","only","most","such","own","other","another","new","first",
  "last","good","bad","im","ive","ill","its","dont","didnt","cant","wont","theyre",
  "youre","were","weve","theyll","thats","youll","ya","yall","oh","ok","yeah",
  "wow","huh","ugh","lmao","lol","rofl","tbh","fr","ngl","imo",
  "position","title","headline","role","bio","description","current","company",
]);

function pick(map: Record<string, number> | undefined, key: string): number {
  if (!map) return 0;
  return map[key.toLowerCase()] ?? 0;
}

function tier(score: number): { archetype: string; reactivity: number } {
  if (score < 0.15) return { archetype: "Quiet Voice", reactivity: 0.1 };
  if (score < 0.35) return { archetype: "Engaged", reactivity: 0.35 };
  if (score < 0.55) return { archetype: "Vocal", reactivity: 0.55 };
  if (score < 0.75) return { archetype: "Outspoken", reactivity: 0.75 };
  return { archetype: "Hostile", reactivity: 0.9 };
}

function topKeywords(text: string, limit = 3): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function uniqueProfessionalKeywords(
  roleHint: string | null,
  keywords: string[],
  roleFamily: Persona["role_family"] | undefined
) {
  const defaults = roleFamily ? defaultPrioritiesForRoleFamily(roleFamily) : [];
  const roleTokens = roleHint
    ? roleHint
        .toLowerCase()
        .replace(/[^a-z0-9\s/&+-]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
    : [];

  return Array.from(
    new Set([...keywords, ...roleTokens.slice(0, 2), ...defaults])
  ).slice(0, 5);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function topLabel(map: Record<string, number> | undefined): string | null {
  if (!map) return null;
  let bestLabel: string | null = null;
  let bestScore = -1;
  for (const [label, score] of Object.entries(map)) {
    if (score > bestScore) {
      bestLabel = label;
      bestScore = score;
    }
  }
  return bestLabel;
}

/**
 * Map dynamic classifier output to the existing Persona schema. Reads any
 * subset of {sentiment, emotion, offensive, hate, toxicity, political,
 * formality} that the router selected. Missing fields fall back to neutral
 * defaults.
 *
 * Aggression composite (matches dissertation §4.3 derivation):
 *   aggression = max(offensive, hate, toxicity)  // any one signals reactivity
 * Brand affinity composite:
 *   if political present and informative → political-derived
 *   else → 2 × sentiment.positive − 1
 */
export function synthesizePersona(
  audienceId: string,
  row: ParsedRow,
  scores: RowScores
): Persona {
  const sentimentMap = scores.sentiment;
  const offensiveScore = pick(scores.offensive, "offensive");
  const hateScore = pick(scores.hate, "hate");
  const toxicityScore = pick(scores.toxicity, "toxic");
  const aggression = Math.max(offensiveScore, hateScore, toxicityScore);

  // For synthetic uploads (LinkedIn exports, contact lists, etc.) the
  // classifier scores are uniformly low because the text is just a job
  // title, not a hot tweet. Fall back to the row's actual role/company
  // fields so personas come out differentiated instead of all "Quiet Voice".
  const fieldArchetype = extractArchetypeFromFields(row.fields);

  const { archetype: tierArchetype, reactivity: tierReactivity } = tier(aggression);
  const reactivity = fieldArchetype
    ? reactivityFromRole(fieldArchetype.role)
    : tierReactivity;
  const baseArchetype = fieldArchetype ? fieldArchetype.label : tierArchetype;

  const sophistication = fieldArchetype
    ? sophisticationFromRole(fieldArchetype.role)
    : clamp(row.text.length / 300, 0.2, 0.95);

  // Brand affinity: prefer political signal when meaningful, else sentiment.
  let brandAffinity = 0;
  const political = scores.political;
  const sentimentDelta = sentimentMap
    ? clamp(
        (sentimentMap["positive"] ?? 0) - (sentimentMap["negative"] ?? 0),
        -1,
        1
      )
    : 0;
  if (political) {
    const right = political["right"] ?? 0;
    const left = political["left"] ?? 0;
    if (right + left > 0.5) {
      // Heavily-leaning rows map to extremes; centre stays near 0.
      brandAffinity = clamp(right - left, -1, 1);
    } else {
      brandAffinity = sentimentDelta;
    }
  } else {
    brandAffinity = sentimentDelta;
  }

  // For synthetic uploads, real classifier signal is weak — derive affinity
  // from the role itself so the audience analysis shows genuine variation.
  if (fieldArchetype && Math.abs(brandAffinity) < 0.1) {
    brandAffinity = affinityFromRole(fieldArchetype.role, row.index);
  }

  // Emotion influences archetype label when present (more vivid than tier alone).
  let emotionLabel: string | null = null;
  if (scores.emotion) {
    let bestLabel = "";
    let bestScore = 0;
    for (const [label, score] of Object.entries(scores.emotion)) {
      if (score > bestScore) {
        bestLabel = label;
        bestScore = score;
      }
    }
    if (bestScore >= 0.4) emotionLabel = bestLabel;
  }

  const archetypeLabel = fieldArchetype
    ? baseArchetype
    : emotionLabel
      ? `${capitalize(emotionLabel)} ${baseArchetype}`
      : baseArchetype;

  const keywords = topKeywords(row.text);
  const roleHint = fieldArchetype?.role ?? null;
  const roleFamily = roleHint ? inferRoleFamilyFromText(roleHint) : undefined;
  const seniority = roleHint ? inferSeniorityFromText(roleHint) : undefined;
  const personaKeywords = uniqueProfessionalKeywords(roleHint, keywords, roleFamily);
  const expertise = extractLinkedInExpertise(roleHint, personaKeywords);
  const professionalVoice = roleHint ? describeVoice(roleHint) : null;
  const idSuffix = `r${row.index}`;

  const personaPrompt = buildAnonymousPersonaPrompt({
    role: roleHint,
    roleFamily,
    seniority,
    archetype: archetypeLabel,
    reactivity,
    sophistication,
    brandAffinity,
    keywords: personaKeywords,
    expertise,
    professionalVoice,
    aggression,
    sentiment: topLabel(scores.sentiment),
    emotion: emotionLabel,
    political: topLabel(scores.political),
    formality: topLabel(scores.formality),
  });

  return {
    id: `upload-${audienceId.slice(0, 8)}-${idSuffix}`,
    archetype: archetypeLabel,
    reactivity_baseline: reactivity,
    sophistication,
    brand_affinity: brandAffinity,
    core_values: personaKeywords.length > 0 ? personaKeywords : ["professional value"],
    persona_prompt: personaPrompt,
    role_hint: roleHint ?? undefined,
    seniority,
    role_family: roleFamily,
    topical_expertise: expertise.length > 0 ? expertise : undefined,
    professional_voice: professionalVoice ?? undefined,
  };
}

function describeReactivity(r: number): string {
  if (r >= 0.7) return "vocal and quick to react";
  if (r >= 0.5) return "engaged, willing to push back";
  if (r >= 0.3) return "thoughtful, replies when something matters";
  return "quiet, mostly observes";
}

function describeSophistication(s: number): string {
  if (s >= 0.8) return "speaks with depth and precision";
  if (s >= 0.6) return "speaks with practical authority";
  if (s >= 0.4) return "casual, plain-spoken";
  return "brief, surface-level";
}

function describeBrandAffinity(a: number): string {
  if (a >= 0.4) return "leans positive on bold or novel ideas";
  if (a <= -0.4) return "leans skeptical of bold or novel ideas";
  return "neutral until convinced";
}

function describeVoice(role: string | null): string | null {
  if (!role) return null;
  if (VOICE.loud.test(role)) return "punchy, narrative-driven";
  if (VOICE.technical.test(role)) return "evidence-driven, skeptical of hype";
  if (VOICE.design.test(role)) return "taste-driven, focused on craft";
  if (VOICE.ops.test(role)) return "risk-aware, pragmatic";
  return null;
}

function roleFamilyLabel(roleFamily: Persona["role_family"] | undefined): string {
  switch (roleFamily) {
    case "founder":
      return "commercial, narrative-aware, and sensitive to market signal";
    case "marketing":
      return "audience-aware, messaging-sensitive, and alert to distribution quality";
    case "sales":
      return "buyer-aware, conversion-minded, and quick to test credibility";
    case "product":
      return "user-centered, structured, and focused on tradeoffs";
    case "engineering":
      return "technical, skeptical of hype, and attentive to implementation detail";
    case "operations":
      return "process-minded, risk-aware, and practical";
    case "finance":
      return "economically disciplined and quick to ask about material impact";
    case "people":
      return "trust-sensitive, culture-aware, and alert to leadership signals";
    case "design":
      return "taste-aware and highly sensitive to clarity and craft";
    case "investor":
      return "signal-seeking, pattern-matching, and focused on leverage";
    default:
      return "professionally observant and selective about what feels worth engaging with";
  }
}

interface PersonaPromptInput {
  role: string | null;
  roleFamily?: Persona["role_family"];
  seniority?: Persona["seniority"];
  archetype: string;
  reactivity: number;
  sophistication: number;
  brandAffinity: number;
  keywords: string[];
  expertise: string[];
  professionalVoice: string | null;
  aggression: number;
  sentiment: string | null;
  emotion: string | null;
  political: string | null;
  formality: string | null;
}

function buildAnonymousPersonaPrompt(input: PersonaPromptInput): string {
  const lines: string[] = [];
  lines.push(`You are a ${input.archetype}.`);

  const voice = input.professionalVoice ?? describeVoice(input.role);
  if (voice) lines.push(`Voice: ${voice}.`);
  if (input.role) lines.push(`Work context: ${input.role}.`);
  if (input.roleFamily) lines.push(`Professional lens: ${roleFamilyLabel(input.roleFamily)}.`);
  if (input.seniority) lines.push(`Seniority: ${input.seniority}.`);

  lines.push(`Tone: ${describeReactivity(input.reactivity)}.`);
  lines.push(`${capitalize(describeSophistication(input.sophistication))}.`);
  lines.push(`Disposition: ${describeBrandAffinity(input.brandAffinity)}.`);
  lines.push(`Conflict style: ${describeAggression(input.aggression)}.`);

  const emotion = describeEmotion(input.emotion);
  if (emotion) lines.push(`Emotional register: ${emotion}.`);

  const politics = describePolitical(input.political);
  if (politics) lines.push(`Worldview: ${politics}.`);

  const sentiment = describeSentiment(input.sentiment);
  if (sentiment) lines.push(`Default reaction pattern: ${sentiment}.`);

  const formality = describeFormality(input.formality);
  if (formality) lines.push(`Register: ${formality}.`);

  if (input.expertise.length > 0) {
    lines.push(`Professional topics you naturally clock: ${input.expertise.slice(0, 4).join(", ")}.`);
  }

  if (input.keywords.length > 0) {
    lines.push(`You care about: ${input.keywords.slice(0, 3).join(", ")}.`);
  }

  lines.push(
    "You react like a real professional whose name and reputation are attached to every comment. You do not sound like an internet caricature."
  );

  lines.push(
    "Stay anonymous. Never invent or mention real names, companies, products, or your own identity."
  );

  return lines.join(" ");
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function describeAggression(a: number): string {
  if (a >= 0.75) return "quick to escalate, mocking, and openly combative";
  if (a >= 0.55) return "sharp, willing to argue, and not especially polite";
  if (a >= 0.35) return "firm but selective about picking fights";
  if (a >= 0.15) return "mostly measured unless something really irritates you";
  return "low-drama and rarely looking for conflict";
}

function describeEmotion(label: string | null): string | null {
  if (!label) return null;
  switch (label.toLowerCase()) {
    case "anger":
      return "easily irritated and inclined to read posts as provocation";
    case "optimism":
      return "energized by momentum and willing to give ideas the benefit of the doubt";
    case "joy":
      return "warm, approving, and happy to reward things that feel smart or generous";
    case "sadness":
      return "somber, wary, and sensitive to harm, loss, or neglect";
    default:
      return `${label.toLowerCase()}-tinged in how you react`;
  }
}

function describePolitical(label: string | null): string | null {
  if (!label) return null;
  switch (label.toLowerCase()) {
    case "left":
      return "skeptical of concentrated power, alert to fairness, labor, and harm";
    case "right":
      return "sensitive to status, competence, order, and overreach";
    case "center":
      return "pragmatic, incremental, and suspicious of ideological overstatement";
    default:
      return null;
  }
}

function describeSentiment(label: string | null): string | null {
  if (!label) return null;
  switch (label.toLowerCase()) {
    case "positive":
      return "you naturally look for upside before you look for flaws";
    case "negative":
      return "you instinctively notice weaknesses, inconsistencies, and hidden costs";
    case "neutral":
      return "you hold judgment until enough specifics are on the table";
    default:
      return null;
  }
}

function describeFormality(label: string | null): string | null {
  if (!label) return null;
  switch (label.toLowerCase()) {
    case "formal":
      return "more polished than chatty; you phrase things deliberately";
    case "informal":
      return "plain-spoken, casual, and comfortable with internet shorthand";
    default:
      return null;
  }
}
