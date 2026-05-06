/**
 * Try hard to extract a structured reply object from the model's raw output.
 *
 * The model is *asked* for JSON in the form:
 *   { "reaction": string, "reasoning": string, "objection": string|null,
 *     "what_would_change_my_mind": string|null }
 *
 * but real models drift: they emit ```json fences, prose preambles, or fall
 * back to plain text entirely. We tolerate all of those — the worst-case
 * behaviour is the same as before reasoning capture existed: the full text
 * becomes the message and reasoning is null.
 */

export interface StructuredReply {
  reaction: string;
  reasoning: string | null;
  objection: string | null;
  what_would_change_my_mind: string | null;
}

const MAX_FIELD_CHARS = 800;

function clamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_FIELD_CHARS);
}

function tryParseJsonChunk(chunk: string): StructuredReply | null {
  try {
    const parsed = JSON.parse(chunk) as Record<string, unknown>;
    const reaction = clamp(parsed?.reaction);
    if (!reaction) return null;
    return {
      reaction,
      reasoning: clamp(parsed?.reasoning),
      objection: clamp(parsed?.objection),
      what_would_change_my_mind: clamp(parsed?.what_would_change_my_mind),
    };
  } catch {
    return null;
  }
}

/**
 * Find the largest substring that parses as JSON. Used when the model
 * wraps its JSON in prose or markdown fences.
 */
function extractJsonSpan(content: string): string | null {
  // First try a fenced block.
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Otherwise look for the outermost {...} span.
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return content.slice(start, end + 1).trim();
  }
  return null;
}

export function parseStructuredReply(content: string): StructuredReply {
  const raw = content?.trim() ?? "";
  if (raw.length === 0) {
    return {
      reaction: "(no response)",
      reasoning: null,
      objection: null,
      what_would_change_my_mind: null,
    };
  }

  // 1) Try the whole thing as JSON.
  const direct = tryParseJsonChunk(raw);
  if (direct) return direct;

  // 2) Try the largest JSON-shaped span.
  const span = extractJsonSpan(raw);
  if (span) {
    const fromSpan = tryParseJsonChunk(span);
    if (fromSpan) return fromSpan;
  }

  // 3) Fallback: treat the whole text as the reaction. We deliberately
  //    don't try to "guess" a reasoning field from prose — empty is
  //    safer than wrong.
  return {
    reaction: raw.slice(0, MAX_FIELD_CHARS),
    reasoning: null,
    objection: null,
    what_would_change_my_mind: null,
  };
}
