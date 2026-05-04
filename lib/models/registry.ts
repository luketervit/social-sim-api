// Curated model registry — the menu Claude routes over.
//
// Why curated, not "every OpenRouter model": with 300+ available, raw catalog
// dilutes routing quality with novelty fine-tunes and irrelevant models. We
// keep the strongest candidates for the specific tasks Atharias does, with
// metadata Claude can reason about (cost tier, language, strengths, refusal
// posture) without us hard-coding rules.

export type GeneratorTask = "discourse" | "long_form" | "professional" | "fast";

export interface GeneratorModel {
  id: string;
  display_name: string;
  provider: "openrouter";
  /** Stable OpenRouter model id used at request time. */
  openrouter_id: string;
  task_strengths: GeneratorTask[];
  /** Approximate price per 1M output tokens, USD. 0 = free tier. */
  output_cost_per_million: number;
  /** Languages where this model performs well (ISO 639-1). */
  languages: string[];
  /** Refusal posture: 'aligned' (RLHF, polite), 'permissive' (mild), 'uncensored'. */
  refusal_posture: "aligned" | "permissive" | "uncensored";
  /** Short note for the routing prompt. */
  notes: string;
}

export const GENERATORS: GeneratorModel[] = [
  {
    id: "hermes-4-70b",
    display_name: "Hermes 4 70B",
    provider: "openrouter",
    openrouter_id: "nousresearch/hermes-4-70b",
    task_strengths: ["discourse", "long_form"],
    output_cost_per_million: 0.4,
    languages: ["en"],
    refusal_posture: "permissive",
    notes:
      "Steerable Llama-3.1-70B fine-tune by NousResearch. Low refusal rate, no production rate limits. Default for hostile/community/political/gaming/Reddit discourse. ~$0.06/sim.",
  },
  {
    id: "hermes-4-405b",
    display_name: "Hermes 4 405B",
    provider: "openrouter",
    openrouter_id: "nousresearch/hermes-4-405b",
    task_strengths: ["discourse", "long_form"],
    output_cost_per_million: 3.0,
    languages: ["en"],
    refusal_posture: "permissive",
    notes:
      "Premium Hermes 4 at frontier scale. Use for high-stakes brand demos where output realism justifies higher cost (~$0.45/sim). Same refusal posture as 70B but more nuanced.",
  },
  {
    id: "hermes-3-70b",
    display_name: "Hermes 3 Llama 3.1 70B",
    provider: "openrouter",
    openrouter_id: "nousresearch/hermes-3-llama-3.1-70b",
    task_strengths: ["discourse", "long_form"],
    output_cost_per_million: 0.3,
    languages: ["en"],
    refusal_posture: "permissive",
    notes:
      "Older Hermes 3 generation. Cheaper than Hermes 4 70B, similar steerability. Good budget pick.",
  },
  {
    id: "dolphin-mistral-24b-venice-budget",
    display_name: "Dolphin-Mistral 24B Venice (free, rate-limited)",
    provider: "openrouter",
    openrouter_id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    task_strengths: ["discourse"],
    output_cost_per_million: 0,
    languages: ["en"],
    refusal_posture: "uncensored",
    notes:
      "Most uncensored model available, but FREE TIER ONLY on OpenRouter — capped at ~8 RPM. DO NOT use for live demos with 100-persona audiences; the engine bursts 20 calls/round and gets blocked. OK for tiny tests.",
  },
  {
    id: "dolphin-llama3-8b",
    display_name: "Dolphin-Llama3 8B",
    provider: "openrouter",
    openrouter_id: "cognitivecomputations/dolphin-llama-3.1-8b",
    task_strengths: ["discourse", "fast"],
    output_cost_per_million: 0.2,
    languages: ["en"],
    refusal_posture: "uncensored",
    notes:
      "Dissertation-validated 92.3% accuracy on political X discourse. Cheaper than 24B, less fluent but holds tone.",
  },
  {
    id: "claude-haiku-4-5",
    display_name: "Claude Haiku 4.5",
    provider: "openrouter",
    openrouter_id: "anthropic/claude-haiku-4.5",
    task_strengths: ["professional", "fast", "long_form"],
    output_cost_per_million: 4.0,
    languages: ["en", "es", "fr", "de", "pt", "it", "ja", "ko", "zh"],
    refusal_posture: "aligned",
    notes:
      "Best for corporate/Slack/email/internal-comms simulations where measured RLHF tone is realistic. Strong multilingual. Refuses overt hostility — do NOT use for crisis/community/gaming.",
  },
  {
    id: "claude-sonnet-4-6",
    display_name: "Claude Sonnet 4.6",
    provider: "openrouter",
    openrouter_id: "anthropic/claude-sonnet-4.6",
    task_strengths: ["professional", "long_form"],
    output_cost_per_million: 15.0,
    languages: ["en", "es", "fr", "de", "pt", "it", "ja", "ko", "zh"],
    refusal_posture: "aligned",
    notes:
      "Premium professional generation. Use sparingly: financial PR, IR, executive comms. Same refusal tradeoff as Haiku.",
  },
  {
    id: "llama-3.3-70b",
    display_name: "Llama 3.3 70B Instruct",
    provider: "openrouter",
    openrouter_id: "meta-llama/llama-3.3-70b-instruct",
    task_strengths: ["long_form", "professional"],
    output_cost_per_million: 0.85,
    languages: ["en", "es", "de", "fr", "it", "pt", "hi", "th"],
    refusal_posture: "aligned",
    notes:
      "Strong long-form Reddit-style writing. Aligned but less restrictive than Claude. Good middle ground when output needs to feel detailed but not corporate.",
  },
  {
    id: "qwen-3-32b",
    display_name: "Qwen 3 32B",
    provider: "openrouter",
    openrouter_id: "qwen/qwen-3-32b",
    task_strengths: ["fast", "long_form"],
    output_cost_per_million: 0.2,
    languages: ["en", "zh", "es", "de", "fr", "ja", "ko", "ar", "ru"],
    refusal_posture: "permissive",
    notes:
      "Fast and broadly multilingual. Slightly weaker on English-only sentiment calibration vs Llama (per dissertation cross-model). Best for non-English audiences.",
  },
  {
    id: "mistral-small-3-2-24b",
    display_name: "Mistral Small 3.2 24B Instruct",
    provider: "openrouter",
    openrouter_id: "mistralai/mistral-small-3.2-24b-instruct",
    task_strengths: ["long_form", "professional", "fast"],
    output_cost_per_million: 0.6,
    languages: ["en", "fr", "de", "es", "it", "pt", "nl"],
    refusal_posture: "permissive",
    notes:
      "European multilingual workhorse. Good for European brand/comms simulations.",
  },
  {
    id: "gemini-2.5-flash",
    display_name: "Gemini 2.5 Flash",
    provider: "openrouter",
    openrouter_id: "google/gemini-2.5-flash",
    task_strengths: ["fast", "professional"],
    output_cost_per_million: 0.6,
    languages: ["en", "es", "fr", "de", "pt", "it", "ja", "ko", "zh", "ar", "hi"],
    refusal_posture: "aligned",
    notes:
      "Very fast first-token latency. Use when sim must feel instant in a live demo.",
  },
  {
    id: "deepseek-r1",
    display_name: "DeepSeek R1",
    provider: "openrouter",
    openrouter_id: "deepseek/deepseek-r1",
    task_strengths: ["long_form"],
    output_cost_per_million: 2.5,
    languages: ["en", "zh"],
    refusal_posture: "permissive",
    notes:
      "Strong reasoning. Good when simulated agents need to construct multi-step arguments (Reddit long-form takedowns).",
  },
];

// ---------------------------------------------------------------------------
// Classifiers
// ---------------------------------------------------------------------------

export type ClassifierField =
  | "sentiment"
  | "emotion"
  | "offensive"
  | "hate"
  | "political"
  | "toxicity"
  | "formality";

export interface ClassifierModel {
  id: string;
  display_name: string;
  provider: "huggingface";
  hf_model: string;
  /** Persona field this classifier feeds into. */
  field: ClassifierField;
  /** Languages the classifier handles well. */
  languages: string[];
  /** When to choose this over alternatives. */
  notes: string;
}

export const CLASSIFIERS: ClassifierModel[] = [
  {
    id: "sentiment_en_twitter",
    display_name: "CardiffNLP Twitter sentiment (EN)",
    provider: "huggingface",
    hf_model: "cardiffnlp/twitter-roberta-base-sentiment-latest",
    field: "sentiment",
    languages: ["en"],
    notes:
      "Industry standard for short-form English social text. Use when source data looks like tweets / Discord messages / chat.",
  },
  {
    id: "sentiment_multilingual_twitter",
    display_name: "CardiffNLP Twitter sentiment (multilingual)",
    provider: "huggingface",
    hf_model: "cardiffnlp/twitter-xlm-roberta-base-sentiment",
    field: "sentiment",
    languages: ["en", "ar", "fr", "de", "hi", "it", "es", "pt"],
    notes:
      "Multilingual short-form sentiment. Use for non-English or mixed-language audiences.",
  },
  {
    id: "sentiment_long_form_multilingual",
    display_name: "BERT multilingual long-form sentiment",
    provider: "huggingface",
    hf_model: "nlptown/bert-base-multilingual-uncased-sentiment",
    field: "sentiment",
    languages: ["en", "fr", "de", "es", "it", "nl"],
    notes:
      "5-star scale, longer text. Use for Reddit posts, support tickets, reviews.",
  },
  {
    id: "emotion_twitter",
    display_name: "CardiffNLP Twitter emotion",
    provider: "huggingface",
    hf_model: "cardiffnlp/twitter-roberta-base-emotion",
    field: "emotion",
    languages: ["en"],
    notes:
      "Anger/joy/optimism/sadness label. Adds emotional register to personas.",
  },
  {
    id: "offensive_twitter",
    display_name: "CardiffNLP Twitter offensive",
    provider: "huggingface",
    hf_model: "cardiffnlp/twitter-roberta-base-offensive",
    field: "offensive",
    languages: ["en"],
    notes:
      "Offensive-language probability. Drives reactivity for community/gaming/political audiences.",
  },
  {
    id: "hate_twitter",
    display_name: "CardiffNLP Twitter hate",
    provider: "huggingface",
    hf_model: "cardiffnlp/twitter-roberta-base-hate-latest",
    field: "hate",
    languages: ["en"],
    notes:
      "Hate-speech probability. Adds aggression nuance vs offensive alone. Skip for corporate/Slack data — almost always 0.",
  },
  {
    id: "political_leaning",
    display_name: "Political leaning (Left/Centre/Right)",
    provider: "huggingface",
    hf_model: "matous-volf/political-leaning-politics",
    field: "political",
    languages: ["en"],
    notes:
      "Use when the audience is politically inflected (US politics, ideology-driven topics). DO NOT use for product/brand/community data — produces noise.",
  },
  {
    id: "toxicity_long_form",
    display_name: "Long-form toxicity (Jigsaw)",
    provider: "huggingface",
    hf_model: "s-nlp/roberta_toxicity_classifier",
    field: "toxicity",
    languages: ["en"],
    notes:
      "Long-form toxicity. Use for Reddit posts, blog comments, forums where messages exceed 280 chars.",
  },
  {
    id: "formality",
    display_name: "Formality classifier",
    provider: "huggingface",
    hf_model: "s-nlp/roberta-base-formality-ranker",
    field: "formality",
    languages: ["en"],
    notes:
      "Formal vs informal register. Use for corporate Slack, internal comms, professional email simulations.",
  },
];

// ---------------------------------------------------------------------------
// Defaults (used when Claude routing fails or env unset)
// ---------------------------------------------------------------------------

export const DEFAULT_GENERATOR_ID = "hermes-4-70b";
export const DEFAULT_CLASSIFIER_IDS: string[] = [
  "sentiment_en_twitter",
  "offensive_twitter",
];

export function findGenerator(id: string): GeneratorModel | null {
  return GENERATORS.find((m) => m.id === id) ?? null;
}

export function findClassifier(id: string): ClassifierModel | null {
  return CLASSIFIERS.find((m) => m.id === id) ?? null;
}

export function generatorById(id: string): GeneratorModel {
  return findGenerator(id) ?? GENERATORS.find((m) => m.id === DEFAULT_GENERATOR_ID)!;
}

export function classifiersByIds(ids: string[]): ClassifierModel[] {
  return ids
    .map((id) => findClassifier(id))
    .filter((c): c is ClassifierModel => c !== null);
}
