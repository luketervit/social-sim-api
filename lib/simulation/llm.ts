import OpenAI from "openai";
import { getOpenRouterEnv } from "@/lib/env";
import type { TokenUsage } from "./types";

// Dolphin-Mistral 24B Venice Edition — uncensored Mistral-Small fine-tune.
// 2.20% refusal rate (lowest in industry as of Apr 2026), 32K context.
//
// IMPORTANT: do NOT default to the ":free" tier in production. Free is capped
// at ~8 RPM on OpenRouter; the engine bursts ~20 parallel calls per round, so
// a single sim hits the cap and crashes. Paid lane is ~$0.001/message
// ($0.03/sim) with no rate limits. Override per-deployment via OPENROUTER_MODEL.
const MODEL =
  process.env.OPENROUTER_MODEL ||
  "cognitivecomputations/dolphin-mistral-24b-venice-edition";

// Dissertation final params (Table 4.3): temperature 0.9, response length 150 tokens.
// Higher temperature (1.2) hurt composite by 0.085; longer responses didn't improve realism.
const DEFAULT_TEMPERATURE = 0.9;
const DEFAULT_MAX_TOKENS = 150;

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 600;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 429]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  _client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: getOpenRouterEnv().OPENROUTER_API_KEY,
  });
  return _client;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: unknown) {
  return (
    typeof status === "number" && (RETRYABLE_STATUS_CODES.has(status) || status >= 500)
  );
}

function hasRetryableCode(value: unknown) {
  return typeof value === "string" && RETRYABLE_NETWORK_CODES.has(value);
}

function getErrorMetadata(
  value: unknown
): { status?: unknown; code?: unknown } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as { status?: unknown; code?: unknown };
}

function isTransientNetworkError(error: unknown) {
  if (
    error instanceof OpenAI.APIConnectionError ||
    error instanceof OpenAI.APIConnectionTimeoutError
  ) {
    return true;
  }

  if (error instanceof OpenAI.APIError) {
    return isRetryableStatus(error.status);
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const maybeError = error as Error & {
    status?: unknown;
    code?: unknown;
    cause?: unknown;
  };

  if (isRetryableStatus(maybeError.status) || hasRetryableCode(maybeError.code)) {
    return true;
  }

  const causeMetadata = getErrorMetadata(maybeError.cause);
  if (
    causeMetadata &&
    (isRetryableStatus(causeMetadata.status) || hasRetryableCode(causeMetadata.code))
  ) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("socket hang up") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function getRetryDelayMs(attempt: number) {
  return BASE_RETRY_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250);
}

/**
 * If OpenRouter returns a 429 with a Retry-After header (seconds), honour it
 * up to a 30s ceiling. Otherwise fall back to exponential backoff.
 */
function getRateLimitDelayMs(error: unknown, attempt: number): number {
  const fallback = getRetryDelayMs(attempt);
  if (!(error instanceof OpenAI.APIError)) return fallback;
  const headers =
    (error as unknown as { headers?: Record<string, string | string[]> }).headers ?? null;
  if (!headers) return fallback;
  const raw =
    headers["retry-after"] ??
    headers["Retry-After"] ??
    headers["x-ratelimit-reset"] ??
    null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return fallback;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(30_000, Math.ceil(seconds * 1000) + 250);
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError && error.status === 429) return true;
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status?: unknown }).status === 429;
  }
  return false;
}

export class SimulationCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulationCapacityError";
  }
}

export async function generateReply(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string }
): Promise<{ content: string; usage: TokenUsage }> {
  let attempt = 0;
  const modelToUse = options?.model || MODEL;

  while (true) {
    try {
      const response = await getClient().chat.completions.create({
        model: modelToUse,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        frequency_penalty: 0.1,
      });

      return {
        content: response.choices[0]?.message?.content?.trim() || "(no response)",
        usage: {
          prompt_tokens: response.usage?.prompt_tokens ?? 0,
          completion_tokens: response.usage?.completion_tokens ?? 0,
          total_tokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      const rateLimited = isRateLimitError(error);

      if (attempt >= MAX_RETRIES) {
        // Surface a clean message for rate limits and capacity issues so the
        // dashboard shows something readable instead of raw provider text.
        if (rateLimited) {
          throw new SimulationCapacityError(
            "The simulation hit a temporary capacity limit. Please retry in a moment."
          );
        }
        throw error;
      }

      if (!rateLimited && !isTransientNetworkError(error)) {
        throw error;
      }

      const delayMs = rateLimited
        ? getRateLimitDelayMs(error, attempt)
        : getRetryDelayMs(attempt);
      const message = error instanceof Error ? error.message : "Unknown error";

      console.warn(
        `${rateLimited ? "Rate-limited" : "Transient"} OpenRouter error. Retrying ${attempt + 1}/${MAX_RETRIES} in ${delayMs}ms: ${message}`
      );

      attempt += 1;
      await sleep(delayMs);
    }
  }
}
