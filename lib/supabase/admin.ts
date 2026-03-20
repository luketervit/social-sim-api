import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

let _adminClient: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient;
  const env = getEnv();
  _adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminClient;
}
