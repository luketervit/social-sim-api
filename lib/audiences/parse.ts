import { parse } from "csv-parse/sync";

export const MAX_AUDIENCE_ROWS = 500;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MIN_TEXT_CHARS = 8;
export const MAX_TEXT_CHARS = 1500;

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
  "position",
  "title",
  "role",
];

export interface ParsedRow {
  index: number;
  text: string;
  source_id?: string;
}

export interface ParsedUpload {
  rows: ParsedRow[];
  text_column: string;
  total_rows_in_file: number;
  truncated: boolean;
}

interface RawRecord {
  [key: string]: string;
}

function pickTextColumn(headers: string[]): string | null {
  const lowered = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of TEXT_COLUMN_CANDIDATES) {
    const idx = lowered.indexOf(candidate);
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function pickIdColumn(headers: string[]): string | null {
  const lowered = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of ["id", "user_id", "userid", "username", "handle", "author"]) {
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

function buildRows(
  records: RawRecord[],
  textColumn: string,
  idColumn: string | null
): ParsedUpload {
  const rows: ParsedRow[] = [];
  for (let i = 0; i < records.length; i++) {
    const text = normaliseText(records[i]?.[textColumn]);
    if (!text) continue;
    const sourceId = idColumn ? String(records[i]?.[idColumn] ?? "").trim() : undefined;
    rows.push({
      index: rows.length,
      text,
      source_id: sourceId && sourceId.length > 0 ? sourceId : undefined,
    });
    if (rows.length >= MAX_AUDIENCE_ROWS) break;
  }

  return {
    rows,
    text_column: textColumn,
    total_rows_in_file: records.length,
    truncated: records.length > rows.length,
  };
}

function parseCSV(content: string): ParsedUpload {
  const records = parse(content, {
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
  const textColumn = pickTextColumn(headers);
  if (!textColumn) {
    throw new Error(
      `Could not find a text column. Add one named: ${TEXT_COLUMN_CANDIDATES.join(", ")}.`
    );
  }
  const idColumn = pickIdColumn(headers);
  return buildRows(records, textColumn, idColumn);
}

function parseJSON(content: string): ParsedUpload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON.");
  }

  // Accept either an array of objects, or { rows: [...] }, or { data: [...] }
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

  // Special case: array of plain strings
  if (typeof arr[0] === "string") {
    const records = (arr as string[]).map((t) => ({ text: t }));
    return buildRows(records as RawRecord[], "text", null);
  }

  if (typeof arr[0] !== "object" || arr[0] === null) {
    throw new Error("JSON array must contain objects with a text field.");
  }

  const records = arr as RawRecord[];
  const headers = Object.keys(records[0]);
  const textColumn = pickTextColumn(headers);
  if (!textColumn) {
    throw new Error(
      `Could not find a text field. Add one named: ${TEXT_COLUMN_CANDIDATES.join(", ")}.`
    );
  }
  const idColumn = pickIdColumn(headers);
  return buildRows(records, textColumn, idColumn);
}

export function parseUpload(content: string, filename: string): ParsedUpload {
  const trimmedName = filename.toLowerCase();
  if (trimmedName.endsWith(".json") || trimmedName.endsWith(".ndjson")) {
    return parseJSON(content);
  }
  return parseCSV(content);
}
