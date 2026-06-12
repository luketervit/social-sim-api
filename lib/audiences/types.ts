export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// LinkedIn's role strings are short ("CTO", "Founder") so allow shorter
// inputs than the generic 8-char floor.
export const MIN_TEXT_CHARS = 8;
export const LINKEDIN_MIN_TEXT_CHARS = 2;
export const MAX_TEXT_CHARS = 1500;

export interface ParsedRow {
  index: number;
  text: string;
  source_id?: string;
  /**
   * Raw column → value map, populated when the upload didn't have a
   * recognised text column. Downstream picks useful columns via AI and
   * re-derives `text` from those before classification.
   */
  fields?: Record<string, string>;
}

export interface ParsedUpload {
  rows: ParsedRow[];
  text_column: string;
  headers: string[];
  /** True when no recognised text column exists and AI selection is needed. */
  synthetic: boolean;
  total_rows_in_file: number;
  truncated: boolean;
}
