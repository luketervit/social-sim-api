import type { LinkedInPostEvalRow } from "@/lib/audiences/linkedinExport";
import { analyzeLinkedInPost } from "@/lib/simulation/linkedinSignals";

interface AudienceEvalInput {
  owner_user_id?: string | null;
  metadata?: unknown;
}

interface RankedPost {
  actual: number;
  features: ReturnType<typeof analyzeLinkedInPost>;
}

export interface LinkedInGlobalEvalSummary {
  evaluated_at: string;
  account_count: number;
  audience_count: number;
  post_count: number;
  weighted_mean_spearman_rank_correlation: number | null;
  mean_spearman_rank_correlation: number | null;
  weighted_mean_top_quartile_overlap: number | null;
  mean_top_quartile_overlap: number | null;
  strongest_positive_signals: Array<{
    signal: string;
    correlation: number;
    interpretation: string;
  }>;
  strongest_negative_signals: Array<{
    signal: string;
    correlation: number;
    interpretation: string;
  }>;
}

const SIGNAL_LABELS: Record<string, string> = {
  specificity: "concrete specifics",
  depth: "depth and developed argument",
  professional_relevance: "clear professional relevance",
  personal_voice: "personal voice",
  company_broadcast: "company-broadcast tone",
  engagement_bait: "engagement bait",
  generic_leadership: "generic thought leadership",
  announcement_slop: "generic announcement framing",
  conflict_novelty: "tension and novelty hooks",
  momentum_signal: "live momentum and progress",
  proof_density: "proof and evidence density",
  future_hype: "future-tense hype",
  achievement_broadcast: "empty achievement broadcasting",
};

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rank(values: number[]) {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i + 1;
    while (j < indexed.length && indexed[j].value === indexed[i].value) j += 1;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k += 1) {
      ranks[indexed[k].index] = avgRank;
    }
    i = j;
  }
  return ranks;
}

function pearson(a: number[], b: number[]) {
  if (a.length !== b.length || a.length < 2) return null;
  const meanA = average(a);
  const meanB = average(b);
  if (meanA === null || meanB === null) return null;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  if (denomA === 0 || denomB === 0) return null;
  return numerator / Math.sqrt(denomA * denomB);
}

function extractPosts(metadata: unknown): LinkedInPostEvalRow[] {
  if (!metadata || typeof metadata !== "object") return [];
  const linkedInExport = (metadata as Record<string, unknown>).linkedin_export;
  if (!linkedInExport || typeof linkedInExport !== "object") return [];
  const posts = (linkedInExport as Record<string, unknown>).posts;
  return Array.isArray(posts) ? (posts as LinkedInPostEvalRow[]) : [];
}

function extractEval(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const linkedInExport = (metadata as Record<string, unknown>).linkedin_export;
  if (!linkedInExport || typeof linkedInExport !== "object") return null;
  const evalResult = (linkedInExport as Record<string, unknown>).eval;
  return evalResult && typeof evalResult === "object"
    ? (evalResult as Record<string, unknown>)
    : null;
}

function featureCorrelation(posts: RankedPost[], selector: (post: RankedPost) => number) {
  if (posts.length < 4) return null;
  return pearson(
    rank(posts.map((post) => selector(post))),
    rank(posts.map((post) => post.actual))
  );
}

export function computeLinkedInGlobalEval(
  audiences: AudienceEvalInput[]
): LinkedInGlobalEvalSummary | null {
  const uniqueOwners = new Set<string>();
  const usableAudiences = audiences
    .map((audience) => {
      const posts = extractPosts(audience.metadata).filter(
        (post) => post.text.trim().length >= 20
      );
      const evalResult = extractEval(audience.metadata);
      if (audience.owner_user_id) uniqueOwners.add(audience.owner_user_id);
      return { posts, evalResult };
    })
    .filter((audience) => audience.posts.length > 0);

  if (usableAudiences.length === 0) return null;

  const postCount = usableAudiences.reduce(
    (sum, audience) => sum + audience.posts.length,
    0
  );

  const spearmanValues = usableAudiences
    .map((audience) => {
      const value = audience.evalResult?.spearman_rank_correlation;
      return typeof value === "number" ? value : null;
    })
    .filter((value): value is number => value !== null);

  const weightedSpearmanValues = usableAudiences
    .map((audience) => {
      const value = audience.evalResult?.spearman_rank_correlation;
      return typeof value === "number"
        ? { value, weight: audience.posts.length }
        : null;
    })
    .filter(
      (value): value is { value: number; weight: number } => value !== null
    );

  const topQuartileValues = usableAudiences
    .map((audience) => {
      const value = audience.evalResult?.top_quartile_overlap;
      return typeof value === "number" ? value : null;
    })
    .filter((value): value is number => value !== null);

  const weightedTopQuartileValues = usableAudiences
    .map((audience) => {
      const value = audience.evalResult?.top_quartile_overlap;
      return typeof value === "number"
        ? { value, weight: audience.posts.length }
        : null;
    })
    .filter(
      (value): value is { value: number; weight: number } => value !== null
    );

  const signalBuckets = new Map<string, Array<{ value: number; weight: number }>>();
  for (const audience of usableAudiences) {
    const rankedPosts: RankedPost[] = audience.posts.map((post) => ({
      actual: post.weighted_engagement,
      features: analyzeLinkedInPost(post.text),
    }));

    const correlations: Record<string, number | null> = {
      specificity: featureCorrelation(rankedPosts, (post) => post.features.specificity),
      depth: featureCorrelation(rankedPosts, (post) => post.features.depth),
      professional_relevance: featureCorrelation(
        rankedPosts,
        (post) => post.features.professional_relevance
      ),
      personal_voice: featureCorrelation(
        rankedPosts,
        (post) => post.features.personal_voice
      ),
      company_broadcast: featureCorrelation(
        rankedPosts,
        (post) => post.features.company_broadcast
      ),
      engagement_bait: featureCorrelation(
        rankedPosts,
        (post) => post.features.engagement_bait
      ),
      generic_leadership: featureCorrelation(
        rankedPosts,
        (post) => post.features.generic_leadership
      ),
      announcement_slop: featureCorrelation(
        rankedPosts,
        (post) => post.features.announcement_slop
      ),
      conflict_novelty: featureCorrelation(
        rankedPosts,
        (post) => post.features.conflict_novelty
      ),
      momentum_signal: featureCorrelation(
        rankedPosts,
        (post) => post.features.momentum_signal
      ),
      proof_density: featureCorrelation(
        rankedPosts,
        (post) => post.features.proof_density
      ),
      future_hype: featureCorrelation(
        rankedPosts,
        (post) => post.features.future_hype
      ),
      achievement_broadcast: featureCorrelation(
        rankedPosts,
        (post) => post.features.achievement_broadcast
      ),
    };

    for (const [signal, value] of Object.entries(correlations)) {
      if (typeof value !== "number") continue;
      const bucket = signalBuckets.get(signal) ?? [];
      bucket.push({ value, weight: audience.posts.length });
      signalBuckets.set(signal, bucket);
    }
  }

  const signalSummary = Array.from(signalBuckets.entries())
    .map(([signal, values]) => {
      const weighted =
        values.reduce((sum, item) => sum + item.value * item.weight, 0) /
        values.reduce((sum, item) => sum + item.weight, 0);
      return {
        signal,
        correlation: weighted,
        interpretation: SIGNAL_LABELS[signal] ?? signal,
      };
    })
    .sort((a, b) => b.correlation - a.correlation);

  return {
    evaluated_at: new Date().toISOString(),
    account_count: uniqueOwners.size || usableAudiences.length,
    audience_count: usableAudiences.length,
    post_count: postCount,
    weighted_mean_spearman_rank_correlation:
      weightedSpearmanValues.length === 0
        ? null
        : weightedSpearmanValues.reduce(
            (sum, item) => sum + item.value * item.weight,
            0
          ) /
          weightedSpearmanValues.reduce((sum, item) => sum + item.weight, 0),
    mean_spearman_rank_correlation: average(spearmanValues),
    weighted_mean_top_quartile_overlap:
      weightedTopQuartileValues.length === 0
        ? null
        : weightedTopQuartileValues.reduce(
            (sum, item) => sum + item.value * item.weight,
            0
          ) /
          weightedTopQuartileValues.reduce((sum, item) => sum + item.weight, 0),
    mean_top_quartile_overlap: average(topQuartileValues),
    strongest_positive_signals: signalSummary
      .filter((item) => item.correlation > 0)
      .slice(0, 4),
    strongest_negative_signals: [...signalSummary]
      .reverse()
      .filter((item) => item.correlation < 0)
      .slice(0, 4),
  };
}
