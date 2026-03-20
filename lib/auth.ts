import { supabaseAdmin } from "@/lib/supabase/server";
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
    // If the RPC doesn't exist yet, fall back to the non-atomic path
    if (error.code === "42883" || error.code === "PGRST202") {
      return consumeApiCreditsFallback(key, amount);
    }
    return { valid: false, error: "Invalid API key" };
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
