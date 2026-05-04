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
 * Convert one classified row into a Persona conforming to the existing schema.
 *
 * - reactivity_baseline: derived from offensive score (5-tier)
 * - sophistication: proxy from text length (longer = more analytical)
 * - brand_affinity: 2 × P(positive) − 1, mapped from sentiment positivity
 * - core_values: top non-stopword keywords from the row's own text
 * - persona_prompt: anchors the generator with the user's actual voice
 */
export function synthesizePersona(
  audienceId: string,
  row: ParsedRow,
  scores: RowScores
): Persona {
  const { archetype, reactivity } = tier(scores.offensive);
  const sophistication = clamp(row.text.length / 300, 0.2, 0.95);
  const brandAffinity = clamp(2 * scores.positive - 1, -1, 1);
  const keywords = topKeywords(row.text);
  const idSuffix = row.source_id
    ? row.source_id.slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, "")
    : `r${row.index}`;

  // Generator anchor — the user's actual voice, capped at 240 chars to keep
  // the system prompt manageable. Quotes are preserved so the model treats it
  // as an example rather than instruction.
  const voiceSnippet = row.text.slice(0, 240).trim();

  return {
    id: `upload-${audienceId.slice(0, 8)}-${idSuffix}`,
    archetype: row.source_id || archetype,
    reactivity_baseline: reactivity,
    sophistication,
    brand_affinity: brandAffinity,
    core_values: keywords.length > 0 ? keywords : ["candor"],
    persona_prompt: `You write things like: "${voiceSnippet}"`,
  };
}
