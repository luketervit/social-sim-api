import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicEnv } from "@/lib/env";

const MODEL = "claude-haiku-4-5-20251001";
const SAMPLE_ROWS = 5;
const MAX_VALUE_CHARS = 200;

export interface ColumnSelectionInput {
  headers: string[];
  /** Each entry is one row's column→value map. Limit to a small sample. */
  sampleRows: Array<Record<string, string>>;
}

export interface ColumnSelection {
  useful: string[];
  reasoning: string;
  source: "ai" | "fallback";
}

const SYSTEM_PROMPT = `You help decide which columns of an arbitrary CSV carry meaningful signal about a person's identity, behaviour, or voice — versus columns that are noise (URLs, emails, internal IDs, timestamps, raw counts).

You will receive:
- The list of column headers.
- A handful of sample rows.

Return JSON only, in this exact shape:
{"useful": ["Column A", "Column B"], "reasoning": "one short sentence"}

Rules:
- Personas are fully anonymised. Pick columns that describe what KIND of person this row is — job title, role, seniority, industry, function, bio/about copy, free-text messages, gripes, location.
- ALWAYS drop personally identifying columns: full names, first/last names, usernames, handles, screen names, emails, phone numbers, company / employer / organisation names, URLs, raw timestamps, and internal IDs. These leak identity even when other columns are anonymised.
- A column whose values are mostly proper nouns (people, companies, places-as-employer) is identifying — drop it.
- Use the EXACT header strings from the input (preserving case + punctuation).
- Reasoning must be one sentence, under 140 characters.`;

function truncateValue(v: string): string {
  if (v.length <= MAX_VALUE_CHARS) return v;
  return `${v.slice(0, MAX_VALUE_CHARS)}…`;
}

function buildUserMessage(input: ColumnSelectionInput): string {
  const lines: string[] = [];
  lines.push(`Headers: ${JSON.stringify(input.headers)}`);
  lines.push("");
  lines.push("Sample rows:");
  const trimmed = input.sampleRows.slice(0, SAMPLE_ROWS);
  for (let i = 0; i < trimmed.length; i++) {
    const row = trimmed[i];
    const compact: Record<string, string> = {};
    for (const header of input.headers) {
      const value = row[header];
      if (typeof value !== "string" || value.length === 0) continue;
      compact[header] = truncateValue(value);
    }
    lines.push(`${i + 1}. ${JSON.stringify(compact)}`);
  }
  return lines.join("\n");
}

function safeParseJSON(text: string): unknown {
  const fenced = text.trim().replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(fenced);
  } catch {
    const match = fenced.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function fallback(headers: string[], reason: string): ColumnSelection {
  return {
    useful: headers.slice(),
    reasoning: reason,
    source: "fallback",
  };
}

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const env = getAnthropicEnv();
  if (!env) return null;
  _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

export async function selectUsefulColumns(
  input: ColumnSelectionInput
): Promise<ColumnSelection> {
  if (input.headers.length === 0) {
    return fallback([], "No headers in upload.");
  }
  if (input.sampleRows.length === 0) {
    return fallback(input.headers, "No sample rows available.");
  }

  const client = getClient();
  if (!client) {
    return fallback(input.headers, "ANTHROPIC_API_KEY not configured.");
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("\n");

    const parsed = safeParseJSON(text);
    if (!parsed || typeof parsed !== "object") {
      return fallback(input.headers, "Column selector returned non-JSON.");
    }

    const obj = parsed as { useful?: unknown; reasoning?: unknown };
    const useful = Array.isArray(obj.useful)
      ? (obj.useful.filter((v) => typeof v === "string") as string[])
      : [];

    // Only trust columns that exist in the original headers.
    const headerSet = new Set(input.headers);
    const validated = useful.filter((c) => headerSet.has(c));

    if (validated.length === 0) {
      return fallback(input.headers, "Column selector returned no valid columns.");
    }

    const reasoning =
      typeof obj.reasoning === "string"
        ? obj.reasoning.slice(0, 200)
        : "AI picked these columns as the meaningful signal.";

    return {
      useful: validated,
      reasoning,
      source: "ai",
    };
  } catch (err) {
    console.error(
      "Column selector call failed:",
      err instanceof Error ? err.message : err
    );
    return fallback(input.headers, "Column selector call failed.");
  }
}
