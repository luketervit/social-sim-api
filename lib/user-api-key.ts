import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DEMO_STARTING_CREDITS = 100_000;
const KEY_PREFIX = "ssim_user_";

/**
 * Look up (or mint) the internal API key tied to a signed-in user. The
 * simulation engine still keys off `api_keys.key`, so dashboard runs piggyback
 * on the existing credit + job machinery.
 */
export async function getOrCreateUserApiKey(email: string): Promise<string> {
  const db = supabaseAdmin();

  const { data: existing, error } = await db
    .from("api_keys")
    .select("key")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (existing?.key) {
    return existing.key as string;
  }

  const key = `${KEY_PREFIX}${randomBytes(20).toString("hex")}`;

  const { error: insertError } = await db.from("api_keys").insert({
    key,
    email,
    credits: DEMO_STARTING_CREDITS,
    total_tokens_used: 0,
  });

  if (insertError) {
    throw insertError;
  }

  return key;
}
