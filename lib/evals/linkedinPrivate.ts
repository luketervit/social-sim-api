import type { Persona } from "@/lib/schemas";
import type { LinkedInPostEvalRow } from "@/lib/audiences/linkedinExport";
import { scoreLinkedInDraftForAudience } from "@/lib/simulation/linkedinSignals";

export interface LinkedInPrivateEvalResult {
  evaluated_at: string;
  sample_size: number;
  spearman_rank_correlation: number | null;
  top_quartile_overlap: number | null;
  avg_actual_engagement_of_top_predicted: number | null;
  avg_actual_engagement_overall: number | null;
  median_actual_engagement_overall: number | null;
  median_actual_engagement_top_predicted: number | null;
  examples: Array<{
    post_urn: string;
    predicted_qes: number;
    actual_weighted_engagement: number;
    text_preview: string;
  }>;
  overpredicted_examples: Array<{
    post_urn: string;
    predicted_qes: number;
    actual_weighted_engagement: number;
    predicted_rank: number;
    actual_rank: number;
    text_preview: string;
  }>;
  underpredicted_examples: Array<{
    post_urn: string;
    predicted_qes: number;
    actual_weighted_engagement: number;
    predicted_rank: number;
    actual_rank: number;
    text_preview: string;
  }>;
}

interface RankedRow {
  post_urn: string;
  text: string;
  predicted: number;
  actual: number;
}

function rankPositions(
  rows: RankedRow[],
  selector: (row: RankedRow) => number
) {
  return new Map(
    [...rows]
      .sort((a, b) => selector(b) - selector(a))
      .map((row, index) => [row.post_urn, index + 1] as const)
  );
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
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

function topQuartileOverlap(rows: RankedRow[]) {
  if (rows.length < 4) return null;
  const k = Math.max(1, Math.ceil(rows.length * 0.25));
  const topPredicted = [...rows]
    .sort((a, b) => b.predicted - a.predicted)
    .slice(0, k)
    .map((row) => row.post_urn);
  const topActual = new Set(
    [...rows]
      .sort((a, b) => b.actual - a.actual)
      .slice(0, k)
      .map((row) => row.post_urn)
  );
  const overlap = topPredicted.filter((urn) => topActual.has(urn)).length;
  return overlap / k;
}

export function evaluateLinkedInPrivateDataset(
  personas: Persona[],
  posts: LinkedInPostEvalRow[]
): LinkedInPrivateEvalResult | null {
  const usablePosts = posts.filter((post) => post.text.trim().length >= 20);
  if (personas.length === 0 || usablePosts.length === 0) return null;

  const ranked: RankedRow[] = usablePosts.map((post) => ({
    post_urn: post.post_urn,
    text: post.text,
    predicted:
      scoreLinkedInDraftForAudience(personas, post.text).qualified_engagement,
    actual: post.weighted_engagement,
  }));

  const predictedRanks = rank(ranked.map((row) => row.predicted));
  const actualRanks = rank(ranked.map((row) => row.actual));
  const sortedPredicted = [...ranked].sort((a, b) => b.predicted - a.predicted);
  const topCount = Math.max(1, Math.ceil(sortedPredicted.length * 0.25));
  const topPredicted = sortedPredicted.slice(0, topCount);
  const predictedPositions = rankPositions(ranked, (row) => row.predicted);
  const actualPositions = rankPositions(ranked, (row) => row.actual);
  const rankDeltaRows = ranked.map((row) => ({
    ...row,
    predicted_rank: predictedPositions.get(row.post_urn) ?? ranked.length,
    actual_rank: actualPositions.get(row.post_urn) ?? ranked.length,
  }));
  const overpredicted = [...rankDeltaRows]
    .sort((a, b) => (a.predicted_rank - a.actual_rank) - (b.predicted_rank - b.actual_rank))
    .slice(0, 3);
  const underpredicted = [...rankDeltaRows]
    .sort((a, b) => (b.predicted_rank - b.actual_rank) - (a.predicted_rank - a.actual_rank))
    .slice(0, 3);

  return {
    evaluated_at: new Date().toISOString(),
    sample_size: ranked.length,
    spearman_rank_correlation: pearson(predictedRanks, actualRanks),
    top_quartile_overlap: topQuartileOverlap(ranked),
    avg_actual_engagement_of_top_predicted: average(
      topPredicted.map((row) => row.actual)
    ),
    avg_actual_engagement_overall: average(ranked.map((row) => row.actual)),
    median_actual_engagement_overall: median(ranked.map((row) => row.actual)),
    median_actual_engagement_top_predicted: median(
      topPredicted.map((row) => row.actual)
    ),
    examples: topPredicted.slice(0, 5).map((row) => ({
      post_urn: row.post_urn,
      predicted_qes: row.predicted,
      actual_weighted_engagement: row.actual,
      text_preview: row.text.slice(0, 180),
    })),
    overpredicted_examples: overpredicted.map((row) => ({
      post_urn: row.post_urn,
      predicted_qes: row.predicted,
      actual_weighted_engagement: row.actual,
      predicted_rank: row.predicted_rank,
      actual_rank: row.actual_rank,
      text_preview: row.text.slice(0, 180),
    })),
    underpredicted_examples: underpredicted.map((row) => ({
      post_urn: row.post_urn,
      predicted_qes: row.predicted,
      actual_weighted_engagement: row.actual,
      predicted_rank: row.predicted_rank,
      actual_rank: row.actual_rank,
      text_preview: row.text.slice(0, 180),
    })),
  };
}
