import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";

export interface LinkedInPostEvalRow {
  post_urn: string;
  share_link: string;
  shared_at: string;
  visibility: string | null;
  text: string;
  shared_url: string | null;
  media_url: string | null;
  comment_count: number;
  reaction_count: number;
  repost_count: number;
  vote_count: number;
  weighted_engagement: number;
  reaction_breakdown: Record<string, number>;
  comment_samples: string[];
}

export interface LinkedInExportAttachment {
  source: "linkedin_complete_export";
  export_kind: "complete";
  attached_at: string;
  summary: {
    post_count: number;
    comment_count: number;
    reaction_count: number;
    repost_count: number;
    vote_count: number;
    latest_post_at: string | null;
  };
  posts: LinkedInPostEvalRow[];
}

interface RawRecord {
  [key: string]: string;
}

function parseCsv(content: string): RawRecord[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    ltrim: false,
    rtrim: false,
    relax_quotes: true,
    relax_column_count: true,
  }) as RawRecord[];
}

function normaliseWhitespace(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function cleanLinkedInExportText(value: string | null | undefined) {
  return normaliseWhitespace(value)
    .replace(/"{2,}/g, " ")
    .replace(/\s*"\s*/g, " ")
    .replace(/\\+"/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function maybeDoubleDecode(value: string) {
  try {
    const once = decodeURIComponent(value);
    try {
      return decodeURIComponent(once);
    } catch {
      return once;
    }
  } catch {
    return value;
  }
}

function extractPostUrn(link: string): string | null {
  const decoded = maybeDoubleDecode(link);
  const match = decoded.match(/urn:li:(ugcPost|activity):\d+/i);
  return match?.[0] ?? null;
}

function canonicalPostKey(link: string): string | null {
  const urn = extractPostUrn(link);
  if (urn) return urn;
  const cleaned = normaliseWhitespace(link).split("?")[0];
  return cleaned.length > 0 ? cleaned : null;
}

function parseDate(value: string | null | undefined) {
  const raw = normaliseWhitespace(value);
  return raw.length > 0 ? raw : null;
}

function weightedEngagementScore(input: {
  comment_count: number;
  reaction_count: number;
  repost_count: number;
  vote_count: number;
}) {
  return (
    input.comment_count * 4 +
    input.repost_count * 5 +
    input.reaction_count * 1 +
    input.vote_count * 2
  );
}

function findEntryKey(entries: Record<string, Uint8Array>, name: string) {
  return Object.keys(entries).find((key) => new RegExp(`(^|/)${name}$`, "i").test(key)) ?? null;
}

function csvFromZip(entries: Record<string, Uint8Array>, name: string) {
  const key = findEntryKey(entries, name);
  if (!key) return null;
  return strFromU8(entries[key]);
}

export function parseLinkedInCompleteExportAttachment(
  zipBytes: Uint8Array
): {
  connections_csv: string | null;
  attachment: LinkedInExportAttachment | null;
} {
  const entries = unzipSync(zipBytes);
  const connectionsCsv = csvFromZip(entries, "Connections.csv");
  const sharesCsv = csvFromZip(entries, "Shares.csv");

  if (!sharesCsv) {
    return {
      connections_csv: connectionsCsv,
      attachment: null,
    };
  }

  const commentsCsv = csvFromZip(entries, "Comments.csv");
  const reactionsCsv = csvFromZip(entries, "Reactions.csv");
  const repostsCsv = csvFromZip(entries, "InstantReposts.csv");
  const votesCsv = csvFromZip(entries, "Votes.csv");

  const shares = parseCsv(sharesCsv);
  const comments = commentsCsv ? parseCsv(commentsCsv) : [];
  const reactions = reactionsCsv ? parseCsv(reactionsCsv) : [];
  const reposts = repostsCsv ? parseCsv(repostsCsv) : [];
  const votes = votesCsv ? parseCsv(votesCsv) : [];

  const commentMap = new Map<string, string[]>();
  for (const row of comments) {
    const key = canonicalPostKey(row.Link ?? "");
    if (!key) continue;
    const items = commentMap.get(key) ?? [];
    const message = cleanLinkedInExportText(row.Message);
    if (message) items.push(message);
    commentMap.set(key, items);
  }

  const reactionMap = new Map<string, Record<string, number>>();
  for (const row of reactions) {
    const key = canonicalPostKey(row.Link ?? "");
    if (!key) continue;
    const type = normaliseWhitespace(row.Type || "LIKE") || "LIKE";
    const bucket = reactionMap.get(key) ?? {};
    bucket[type] = (bucket[type] ?? 0) + 1;
    reactionMap.set(key, bucket);
  }

  const repostMap = new Map<string, number>();
  for (const row of reposts) {
    const key = canonicalPostKey(row.Link ?? "");
    if (!key) continue;
    repostMap.set(key, (repostMap.get(key) ?? 0) + 1);
  }

  const voteMap = new Map<string, number>();
  for (const row of votes) {
    const key = canonicalPostKey(row.Link ?? "");
    if (!key) continue;
    voteMap.set(key, (voteMap.get(key) ?? 0) + 1);
  }

  const posts: LinkedInPostEvalRow[] = shares
    .map((row) => {
      const shareLink = normaliseWhitespace(row.ShareLink);
      const postKey = canonicalPostKey(shareLink);
      const text = cleanLinkedInExportText(row.ShareCommentary);
      if (!postKey || !text) return null;

      const commentSamples = (commentMap.get(postKey) ?? []).slice(0, 8);
      const reactionBreakdown = reactionMap.get(postKey) ?? {};
      const commentCount = (commentMap.get(postKey) ?? []).length;
      const reactionCount = Object.values(reactionBreakdown).reduce((sum, count) => sum + count, 0);
      const repostCount = repostMap.get(postKey) ?? 0;
      const voteCount = voteMap.get(postKey) ?? 0;

      return {
        post_urn: postKey,
        share_link: shareLink,
        shared_at: parseDate(row.Date) ?? "",
        visibility: normaliseWhitespace(row.Visibility) || null,
        text,
        shared_url: normaliseWhitespace(row.SharedUrl) || null,
        media_url: normaliseWhitespace(row.MediaUrl) || null,
        comment_count: commentCount,
        reaction_count: reactionCount,
        repost_count: repostCount,
        vote_count: voteCount,
        weighted_engagement: weightedEngagementScore({
          comment_count: commentCount,
          reaction_count: reactionCount,
          repost_count: repostCount,
          vote_count: voteCount,
        }),
        reaction_breakdown: reactionBreakdown,
        comment_samples: commentSamples,
      } satisfies LinkedInPostEvalRow;
    })
    .filter((row): row is LinkedInPostEvalRow => row !== null)
    .sort((a, b) => {
      const aTime = Date.parse(a.shared_at);
      const bTime = Date.parse(b.shared_at);
      return Number.isFinite(bTime) && Number.isFinite(aTime) ? bTime - aTime : 0;
    });

  return {
    connections_csv: connectionsCsv,
    attachment: {
      source: "linkedin_complete_export",
      export_kind: "complete",
      attached_at: new Date().toISOString(),
      summary: {
        post_count: posts.length,
        comment_count: comments.length,
        reaction_count: reactions.length,
        repost_count: reposts.length,
        vote_count: votes.length,
        latest_post_at: posts[0]?.shared_at ?? null,
      },
      posts,
    },
  };
}
