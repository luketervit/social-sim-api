import OpenAI from "openai";
import { getOpenRouterEnv } from "@/lib/env";
import type { TokenUsage } from "./types";
import {
  SimulationImageAnalysisSchema,
  type SimulationImageAnalysis,
} from "./imageAnalysis";

// Hermes 4 70B by NousResearch — uncensored-friendly Llama 3.1 70B fine-tune.
// Steerable, low refusal rate, $0.13/M input + $0.40/M output (~$0.06/sim at
// 100 personas × 10 rounds × 20% reply). No OpenRouter rate-limit caps.
//
// We previously defaulted to Dolphin-Mistral 24B Venice but its only OpenRouter
// endpoint is the ":free" lane (8 RPM, kills the engine). Hermes 4 70B is the
// closest replacement with paid throughput.
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "nousresearch/hermes-4-70b";
const PLATFORM_DEFAULT_MODELS: Record<string, string> = {
  linkedin:
    process.env.OPENROUTER_LINKEDIN_MODEL || "qwen/qwen3-235b-a22b-2507",
  slack:
    process.env.OPENROUTER_SLACK_MODEL || "anthropic/claude-haiku-4.5",
  reddit:
    process.env.OPENROUTER_REDDIT_MODEL || DEFAULT_MODEL,
  twitter:
    process.env.OPENROUTER_TWITTER_MODEL || DEFAULT_MODEL,
};
const VISION_MODEL =
  process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4.1-mini";

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

function isStructuredOutputCompatibilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("response_format") ||
    message.includes("json_schema") ||
    message.includes("structured output") ||
    message.includes("unsupported parameter") ||
    message.includes("require_parameters")
  );
}

async function createCompletion(
  modelToUse: string,
  systemPrompt: string,
  userPrompt: string,
  structured: boolean
) {
  const payload: Record<string, unknown> = {
    model: modelToUse,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
    frequency_penalty: 0.1,
  };

  if (structured) {
    payload.response_format = {
      type: "json_object",
    };
  }

  return getClient().chat.completions.create(payload as never);
}

async function createVisionCompletion(
  postText: string,
  platform: string,
  imageUrl: string
) {
  return getClient().chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: "system",
        content: `You analyze images attached to social posts and return strict JSON only.

You are evaluating how an attached image affects interpretation of a ${platform} post.

Return a JSON object with exactly these keys:
- literal_description: string
- image_type: string
- visible_elements: string[]
- tone_signals: string[]
- linkedin_interpretation: string
- text_interaction: string
- audience_effects: string[]
- risk_flags: string[]
- uncertainty_notes: string[]

Rules:
- Be concrete and concise.
- Do not infer ungrounded facts from faces, logos, or settings.
- If something is ambiguous, put that in uncertainty_notes.
- Treat "linkedin_interpretation" as "professional social-feed interpretation" when the platform is not LinkedIn.
- No markdown and no prose outside the JSON object.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Platform: ${platform}
Post text:
${postText}

Analyze the attached image in the context of this post.`,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.2,
    response_format: { type: "json_object" },
  } as never);
}

export async function generateReply(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; platform?: string }
): Promise<{ content: string; usage: TokenUsage }> {
  let attempt = 0;
  const modelToUse =
    options?.model ||
    (options?.platform ? PLATFORM_DEFAULT_MODELS[options.platform] : null) ||
    DEFAULT_MODEL;

  while (true) {
    try {
      let response: Awaited<ReturnType<typeof createCompletion>>;
      try {
        response = await createCompletion(
          modelToUse,
          systemPrompt,
          userPrompt,
          true
        );
      } catch (structuredError) {
        if (!isStructuredOutputCompatibilityError(structuredError)) {
          throw structuredError;
        }
        response = await createCompletion(
          modelToUse,
          systemPrompt,
          userPrompt,
          false
        );
      }

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

export async function analyzePostImage(
  postText: string,
  platform: string,
  imageUrl: string
): Promise<{ analysis: SimulationImageAnalysis; usage: TokenUsage }> {
  let attempt = 0;

  while (true) {
    try {
      const response = await createVisionCompletion(postText, platform, imageUrl);
      const raw = response.choices[0]?.message?.content?.trim() || "{}";
      const analysis = SimulationImageAnalysisSchema.parse(JSON.parse(raw));
      return {
        analysis,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens ?? 0,
          completion_tokens: response.usage?.completion_tokens ?? 0,
          total_tokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      const rateLimited = isRateLimitError(error);

      if (attempt >= MAX_RETRIES) {
        if (rateLimited) {
          throw new SimulationCapacityError(
            "Image analysis hit a temporary capacity limit. Please retry in a moment."
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
      await sleep(delayMs);
      attempt += 1;
    }
  }
}
