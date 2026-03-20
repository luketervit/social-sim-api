import { supabaseAdmin } from "@/lib/supabase/admin";
import { CREDITS_PER_MESSAGE } from "@/lib/credits";

export async function getApiKeyStatus(
  key: string,
  requiredCredits: number = CREDITS_PER_MESSAGE
): Promise<{ valid: boolean; error?: string; credits?: number }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_keys")
    .select("credits")
    .eq("key", key)
    .single();

  if (error || !data) {
    return { valid: false, error: "Invalid API key" };
  }

  if (data.credits < requiredCredits) {
    return { valid: false, error: "No credits remaining", credits: data.credits };
  }

  return { valid: true, credits: data.credits };
}

export async function consumeApiCredits(
  key: string,
  amount: number = CREDITS_PER_MESSAGE
): Promise<{ valid: boolean; error?: string }> {
  const db = supabaseAdmin();

  // Atomic decrement: only succeeds if enough credits remain for the requested amount
  const { data, error } = await db.rpc("use_credit", {
    api_key: key,
    credit_amount: amount,
  });

  if (error) {
    console.error("Failed to consume API credits:", {
      keyPrefix: key.slice(0, 12),
      amount,
      code: error.code,
      message: error.message,
      details: error.details,
    });

    // If the RPC doesn't exist yet, fall back to the non-atomic path
    if (error.code === "42883" || error.code === "PGRST202") {
      return consumeApiCreditsFallback(key, amount);
    }
    return { valid: false, error: "Failed to debit credits" };
  }

  // RPC returns false if key not found or no credits
  if (data === false) {
    // Check if it's a missing key or exhausted credits
    const { data: keyRow } = await db
      .from("api_keys")
      .select("credits")
      .eq("key", key)
      .single();

    if (!keyRow) return { valid: false, error: "Invalid API key" };
    return { valid: false, error: "No credits remaining" };
  }

  return { valid: true };
}

export async function refundApiCredits(
  key: string,
  amount: number
): Promise<{ ok: boolean; error?: string }> {
  if (amount <= 0) {
    return { ok: true };
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_keys")
    .select("credits")
    .eq("key", key)
    .single();

  if (error || !data) {
    console.error("Failed to load API key for refund:", {
      keyPrefix: key.slice(0, 12),
      amount,
      code: error?.code,
      message: error?.message,
    });
    return { ok: false, error: "Failed to load API key for refund" };
  }

  const { error: updateError } = await db
    .from("api_keys")
    .update({ credits: data.credits + amount })
    .eq("key", key);

  if (updateError) {
    console.error("Failed to refund API credits:", {
      keyPrefix: key.slice(0, 12),
      amount,
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
    });
    return { ok: false, error: "Failed to refund credits" };
  }

  return { ok: true };
}

export async function incrementApiKeyTokensUsed(
  key: string,
  amount: number
): Promise<{ ok: boolean; error?: string }> {
  if (amount <= 0) {
    return { ok: true };
  }

  const db = supabaseAdmin();
  const { error } = await db.rpc("increment_api_key_tokens_used", {
    api_key: key,
    token_amount: amount,
  });

  if (error) {
    console.error("Failed to increment API key token usage:", {
      keyPrefix: key.slice(0, 12),
      amount,
      code: error.code,
      message: error.message,
      details: error.details,
    });

    return incrementApiKeyTokensUsedFallback(key, amount);
  }

  return { ok: true };
}

async function consumeApiCreditsFallback(
  key: string,
  amount: number
): Promise<{ valid: boolean; error?: string }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_keys")
    .select("key, credits")
    .eq("key", key)
    .single();

  if (error || !data) {
    return { valid: false, error: "Invalid API key" };
  }

  if (data.credits < amount) {
    return { valid: false, error: "No credits remaining" };
  }

  await db
    .from("api_keys")
    .update({ credits: data.credits - amount })
    .eq("key", key);

  return { valid: true };
}

async function incrementApiKeyTokensUsedFallback(
  key: string,
  amount: number
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_keys")
    .select("total_tokens_used")
    .eq("key", key)
    .single();

  if (error || !data) {
    return { ok: false, error: "Invalid API key" };
  }

  const totalTokensUsed =
    typeof data.total_tokens_used === "number"
      ? data.total_tokens_used
      : Number(data.total_tokens_used ?? 0);

  const { error: updateError } = await db
    .from("api_keys")
    .update({ total_tokens_used: totalTokensUsed + amount })
    .eq("key", key);

  if (updateError) {
    console.error("Failed to update API key token usage:", {
      keyPrefix: key.slice(0, 12),
      amount,
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
    });

    return { ok: false, error: "Failed to update token usage" };
  }

  return { ok: true };
}
