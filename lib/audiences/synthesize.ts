import type { Persona } from "@/lib/schemas";
import type { ParsedRow } from "./parse";
import type { RowScores } from "./classify";

const ROLE_FIELD_KEYS = [
  "position",
  "title",
  "job title",
  "job_title",
  "headline",
  "role",
  "current position",
];

const COMPANY_FIELD_KEYS = [
  "company",
  "organization",
  "organisation",
  "employer",
  "current company",
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

function extractArchetypeFromFields(
  fields: Record<string, string> | undefined
): { label: string; role: string } | null {
  if (!fields) return null;
  const role = pickField(fields, ROLE_FIELD_KEYS);
  if (!role) return null;
  const company = pickField(fields, COMPANY_FIELD_KEYS);
  // Trim role to ~50 chars so the chip layout stays clean.
  const cleanRole = role.replace(/\s+/g, " ").trim().slice(0, 60);
  const label = company
    ? `${cleanRole} · ${company.replace(/\s+/g, " ").trim().slice(0, 40)}`
    : cleanRole;
  return { label, role: cleanRole };
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
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
    ? clamp(2 * (sentimentMap["positive"] ?? 0) - 1, -1, 1)
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
    : row.source_id
      ? row.source_id
      : emotionLabel
        ? `${capitalize(emotionLabel)} ${baseArchetype}`
        : baseArchetype;

  const keywords = topKeywords(row.text);
  const idSuffix = row.source_id
    ? row.source_id.slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, "")
    : `r${row.index}`;

  const voiceSnippet = row.text.slice(0, 240).trim();

  return {
    id: `upload-${audienceId.slice(0, 8)}-${idSuffix}`,
    archetype: archetypeLabel,
    reactivity_baseline: reactivity,
    sophistication,
    brand_affinity: brandAffinity,
    core_values: keywords.length > 0 ? keywords : ["candor"],
    persona_prompt: `You write things like: "${voiceSnippet}"`,
  };
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
