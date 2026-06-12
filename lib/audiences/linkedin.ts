import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * LinkedIn export ingest.
 *
 * Treats the user's own data and their connections' data as two separate
 * streams. The connection stream is anonymized at ingest:
 *
 *  - Names are dropped before any persona is generated.
 *  - Email addresses are dropped (after hashing for dedup, see below).
 *  - Company names are dropped from the role string (existing
 *    `anonymiseRole` step already does this; we additionally drop the
 *    Company column from the row before passing to the persona pipeline).
 *  - LinkedIn profile URLs are not stored. They are hashed once with a
 *    per-application secret salt so we can deduplicate the same person
 *    across multiple uploaders, but the original URL is discarded.
 *
 * The output of this module is plain `ParsedRow` objects with `text` set
 * to a role-only descriptor and `fields` containing only role/seniority
 * derivatives. Downstream `processAudienceUpload` runs the existing
 * column-selection + classifier + persona-synthesis pipeline against this
 * stripped row set.
 */

import type { ParsedRow } from "./types";

const LINKEDIN_REQUIRED_HEADERS = [
  "First Name",
  "Last Name",
  "URL",
  "Email Address",
  "Company",
  "Position",
];

interface RawLinkedInRow {
  firstName: string;
  lastName: string;
  url: string;
  email: string;
  company: string;
  position: string;
  connectedOn?: string;
}

export interface LinkedInIngestRow extends ParsedRow {
  /**
   * Stable per-app hash of the connection's LinkedIn URL slug. Used to
   * deduplicate the same connection across multiple uploaders and to
   * compute graph density. Never decryptable back to the URL.
   */
  profile_hash?: string;
}

export interface LinkedInIngestResult {
  rows: LinkedInIngestRow[];
  total_input_rows: number;
  dropped_rows: number;
  unique_profile_hashes: number;
}

/**
 * Detect whether the parsed CSV looks like LinkedIn's `Connections.csv`
 * by checking for the canonical header set. Lenient: accepts any header
 * that contains the expected column name (case-insensitive).
 */
export function isLinkedInConnectionsCsv(headers: string[]): boolean {
  const lowered = headers.map((h) => h.toLowerCase().trim());
  return LINKEDIN_REQUIRED_HEADERS.every((req) =>
    lowered.some((h) => h === req.toLowerCase())
  );
}

/**
 * Per-application stable hash. Truncated to 16 hex chars (64 bits) — enough
 * to dedup at the scale we'll see in beta without bloating the row.
 */
export function hashProfile(rawValue: string): string {
  const env = getEnv();
  const normalized = rawValue.trim().toLowerCase();
  if (normalized.length === 0) return "";
  const digest = createHash("sha256")
    .update(env.PROFILE_HASH_SALT)
    .update("|")
    .update(normalized)
    .digest("hex");
  return digest.slice(0, 16);
}

function pick(record: Record<string, string>, key: string): string {
  // case-insensitive lookup
  const target = key.toLowerCase();
  for (const k of Object.keys(record)) {
    if (k.toLowerCase().trim() === target) {
      return (record[k] ?? "").trim();
    }
  }
  return "";
}

function toRawRow(record: Record<string, string>): RawLinkedInRow {
  return {
    firstName: pick(record, "First Name"),
    lastName: pick(record, "Last Name"),
    url: pick(record, "URL"),
    email: pick(record, "Email Address"),
    company: pick(record, "Company"),
    position: pick(record, "Position"),
    connectedOn: pick(record, "Connected On"),
  };
}

/**
 * Build the role text we'll pass into persona synthesis. Deliberately
 * does NOT include the connection's name, email, or company — only role
 * + (loosely) industry derived from the role text itself.
 */
function buildAnonymizedRoleText(row: RawLinkedInRow): string {
  // Position alone is the only field that gets persisted as text.
  // anonymiseRole() in synthesize.ts strips trailing "@ Company" patterns.
  return row.position;
}

/**
 * Convert raw LinkedIn `Connections.csv` records into anonymized
 * `ParsedRow` entries. Names/emails/company never leave this function.
 */
export function ingestLinkedInConnections(
  records: Record<string, string>[]
): LinkedInIngestResult {
  const rows: LinkedInIngestRow[] = [];
  const seenHashes = new Set<string>();
  let dropped = 0;

  for (let i = 0; i < records.length; i++) {
    const raw = toRawRow(records[i]);
    const roleText = buildAnonymizedRoleText(raw);

    if (!roleText || roleText.length < 2) {
      dropped += 1;
      continue;
    }

    const profileHash = raw.url ? hashProfile(raw.url) : "";
    if (profileHash) seenHashes.add(profileHash);

    rows.push({
      index: rows.length,
      text: roleText,
      // Pass only role-derived fields downstream. Note: "position" is the
      // canonical role column for our persona synthesizer.
      fields: {
        position: roleText,
      },
      profile_hash: profileHash || undefined,
    });
  }

  return {
    rows,
    total_input_rows: records.length,
    dropped_rows: dropped,
    unique_profile_hashes: seenHashes.size,
  };
}
