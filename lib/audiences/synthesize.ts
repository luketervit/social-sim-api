import type { Persona } from "@/lib/schemas";
import type { ParsedRow } from "./parse";
import type { RowScores } from "./classify";

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

  const { archetype, reactivity } = tier(aggression);
  const sophistication = clamp(row.text.length / 300, 0.2, 0.95);

  // Brand affinity: prefer political signal when meaningful, else sentiment.
  let brandAffinity = 0;
  const political = scores.political;
  if (political) {
    const right = political["right"] ?? 0;
    const left = political["left"] ?? 0;
    if (right + left > 0.5) {
      // Heavily-leaning rows map to extremes; centre stays near 0.
      brandAffinity = clamp(right - left, -1, 1);
    } else {
      brandAffinity = sentimentMap
        ? clamp(2 * (sentimentMap["positive"] ?? 0) - 1, -1, 1)
        : 0;
    }
  } else if (sentimentMap) {
    brandAffinity = clamp(2 * (sentimentMap["positive"] ?? 0) - 1, -1, 1);
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

  const archetypeLabel = row.source_id
    ? row.source_id
    : emotionLabel
      ? `${capitalize(emotionLabel)} ${archetype}`
      : archetype;

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
