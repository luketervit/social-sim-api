import { supabaseAdmin } from "@/lib/supabase/server";

export async function validateApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  const db = supabaseAdmin();

  // Atomic decrement: only succeeds if credits > 0
  const { data, error } = await db.rpc("use_credit", { api_key: key });

  if (error) {
    // If the RPC doesn't exist yet, fall back to the non-atomic path
    if (error.code === "42883") {
      return validateApiKeyFallback(key);
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

async function validateApiKeyFallback(key: string): Promise<{ valid: boolean; error?: string }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_keys")
    .select("key, credits")
    .eq("key", key)
    .single();

  if (error || !data) {
    return { valid: false, error: "Invalid API key" };
  }

  if (data.credits <= 0) {
    return { valid: false, error: "No credits remaining" };
  }

  await db
    .from("api_keys")
    .update({ credits: data.credits - 1 })
    .eq("key", key);

  return { valid: true };
}
