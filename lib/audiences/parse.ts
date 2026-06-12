import { parse } from "csv-parse/sync";
import {
  LINKEDIN_MIN_TEXT_CHARS,
  MAX_TEXT_CHARS,
  MIN_TEXT_CHARS,
  type ParsedRow,
  type ParsedUpload,
} from "./types";
import {
  ingestLinkedInConnections,
  isLinkedInConnectionsCsv,
} from "./linkedin";

export { MAX_UPLOAD_BYTES } from "./types";

const TEXT_COLUMN_CANDIDATES = [
  "text",
  "message",
  "tweet",
  "comment",
  "body",
  "content",
  "post",
  "headline",
  "bio",
  "description",
];

const ID_COLUMN_CANDIDATES = [
  "id",
  "user_id",
  "userid",
  "username",
  "handle",
  "author",
];

interface RawRecord {
  [key: string]: string;
}

function pickColumn(headers: string[], candidates: string[]): string | null {
  const lowered = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lowered.indexOf(candidate);
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function normaliseText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length < MIN_TEXT_CHARS) return null;
  return trimmed.slice(0, MAX_TEXT_CHARS);
}

/**
 * Concat every non-empty string field on a row. Used as a placeholder text
 * value when no column has been selected yet — process.ts overwrites with
 * an AI-chosen subset before classification runs.
 */
function concatAllFields(record: RawRecord, headers: string[]): string {
  const parts: string[] = [];
  for (const header of headers) {
    const raw = record[header];
    if (typeof raw !== "string") continue;
    const trimmed = raw.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    parts.push(`${header}: ${trimmed}`);
  }
  return parts.join(" · ").slice(0, MAX_TEXT_CHARS);
}

function buildRowsForKnownColumn(
  records: RawRecord[],
  textColumn: string,
  idColumn: string | null,
  headers: string[]
): ParsedUpload {
  const rows: ParsedRow[] = [];
  for (let i = 0; i < records.length; i++) {
    const text = normaliseText(records[i]?.[textColumn]);
    if (!text) continue;
    const sourceId = idColumn
      ? String(records[i]?.[idColumn] ?? "").trim()
      : undefined;
    rows.push({
      index: rows.length,
      text,
      source_id: sourceId && sourceId.length > 0 ? sourceId : undefined,
    });
  }

  return {
    rows,
    text_column: textColumn,
    headers,
    synthetic: false,
    total_rows_in_file: records.length,
    truncated: records.length > rows.length,
  };
}

function buildRowsForSynthetic(
  records: RawRecord[],
  idColumn: string | null,
  headers: string[]
): ParsedUpload {
  const rows: ParsedRow[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    const concat = concatAllFields(record, headers);
    if (concat.length < MIN_TEXT_CHARS) continue;

    // Stash the raw row so the background job can re-synthesise text from
    // only the AI-selected columns.
    const fields: Record<string, string> = {};
    for (const header of headers) {
      const raw = record[header];
      if (typeof raw !== "string") continue;
      const trimmed = raw.replace(/\s+/g, " ").trim();
      if (!trimmed) continue;
      fields[header] = trimmed.slice(0, MAX_TEXT_CHARS);
    }

    const sourceId = idColumn
      ? String(record[idColumn] ?? "").trim()
      : undefined;

    rows.push({
      index: rows.length,
      text: concat,
      source_id: sourceId && sourceId.length > 0 ? sourceId : undefined,
      fields,
    });
  }

  return {
    rows,
    text_column: "(synthesized)",
    headers,
    synthetic: true,
    total_rows_in_file: records.length,
    truncated: records.length > rows.length,
  };
}

/**
 * LinkedIn's connections export prepends a "Notes:" disclaimer block before
 * the real header row. Detect it and return the line index where parsing
 * should start.
 */
function findHeaderLine(content: string): number {
  const firstLine = content.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (!firstLine.toLowerCase().startsWith("notes:")) return 0;
  const lines = content.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.split(",").length < 2) continue;
    const fields = line.split(",").map((f) => f.replace(/^"|"$/g, "").trim());
    const looksLikeHeader =
      fields.length >= 2 &&
      fields.every((f) => f.length > 0 && f.length < 80 && !/^https?:/i.test(f));
    if (looksLikeHeader) return i;
  }
  return 0;
}

function parseCSV(content: string): ParsedUpload {
  const headerLine = findHeaderLine(content);
  const sliced =
    headerLine > 0
      ? content.split(/\r?\n/).slice(headerLine).join("\n")
      : content;

  const records = parse(sliced, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as RawRecord[];

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("CSV is empty or has no header row.");
  }

  const headers = Object.keys(records[0]);

  // LinkedIn `Connections.csv` is a special case: detect it explicitly and
  // run the anonymization pipeline before any downstream code sees a name,
  // email, or company.
  if (isLinkedInConnectionsCsv(headers)) {
    const ingested = ingestLinkedInConnections(records);
    return {
      rows: ingested.rows,
      // The canonical text column for persona synthesis. We deliberately
      // do not expose the original column name (which would leak format
      // metadata like "Position") — it's normalized to "position".
      text_column: "position",
      // Headers exposed downstream are the anonymized subset, not the
      // raw LinkedIn headers (which include First Name / Last Name / URL
      // / Email Address / Company).
      headers: ["position"],
      // Synthetic = true so the AI column-selector treats this as a
      // role-only row set; it will pick "position" as the useful column.
      synthetic: true,
      total_rows_in_file: ingested.total_input_rows,
      truncated: ingested.dropped_rows > 0,
    };
  }

  const textColumn = pickColumn(headers, TEXT_COLUMN_CANDIDATES);
  const idColumn = pickColumn(headers, ID_COLUMN_CANDIDATES);

  if (textColumn) {
    return buildRowsForKnownColumn(records, textColumn, idColumn, headers);
  }
  return buildRowsForSynthetic(records, idColumn, headers);
}

function parseJSON(content: string): ParsedUpload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON.");
  }

  let arr: unknown;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    arr = obj.rows ?? obj.data ?? obj.items;
  }

  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("JSON must be an array of objects (or {rows:[...]}).");
  }

  if (typeof arr[0] === "string") {
    const records = (arr as string[]).map((t) => ({ text: t }));
    return buildRowsForKnownColumn(
      records as RawRecord[],
      "text",
      null,
      ["text"]
    );
  }

  if (typeof arr[0] !== "object" || arr[0] === null) {
    throw new Error("JSON array must contain objects with a text field.");
  }

  const records = arr as RawRecord[];
  const headers = Object.keys(records[0]);
  const textColumn = pickColumn(headers, TEXT_COLUMN_CANDIDATES);
  const idColumn = pickColumn(headers, ID_COLUMN_CANDIDATES);

  if (textColumn) {
    return buildRowsForKnownColumn(records, textColumn, idColumn, headers);
  }
  return buildRowsForSynthetic(records, idColumn, headers);
}

export function parseUpload(content: string, filename: string): ParsedUpload {
  const trimmedName = filename.toLowerCase();
  if (trimmedName.endsWith(".json") || trimmedName.endsWith(".ndjson")) {
    return parseJSON(content);
  }
  return parseCSV(content);
}
