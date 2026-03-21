import { randomBytes } from "crypto";
import { PLAYGROUND_KEY_PREFIX, displayCredits } from "@/lib/credits";
import { ensureOperatorAccount } from "@/lib/operator-accounts";
import {
  FREE_PLAYGROUND_SIMULATIONS_PER_DAY,
  QUOTA_BUCKETS,
  getDailyQuotaState,
} from "@/lib/quotas";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ApiKeyRecord {
  key: string;
  email: string;
  credits: number;
  total_tokens_used: number | string;
  created_at: string;
}

function withDisplayedCredits(record: ApiKeyRecord) {
  return {
    ...record,
    credits: displayCredits(record.credits),
  } satisfies ApiKeyRecord;
}

export interface DashboardSimulationRecord {
  id: string;
  api_key: string;
  audience_id: string;
  persona_cap?: number | null;
  platform: string;
  input: string;
  status: string;
  aggression_score: string | null;
  public: boolean;
  title: string | null;
  summary: string | null;
  shared_at: string | null;
  progress_messages: number;
  public_clicks: number;
  created_at: string;
  completed_at: string | null;
}

export interface SimulationShareEventRecord {
  simulation_id: string;
  channel: string;
  share_text: string | null;
  destination: string | null;
  created_at: string;
}

export interface AudienceOption {
  id: string;
  name: string;
  metadata: {
    persona_count?: number;
  } | null;
}

export { ensureOperatorAccount };

export async function getDailyPlaygroundQuotaForUser(userId: string) {
  return getDailyQuotaState(
    userId,
    QUOTA_BUCKETS.playgroundSimulation,
    FREE_PLAYGROUND_SIMULATIONS_PER_DAY
  );
}

export async function getOrCreatePlaygroundKey(userId: string, email: string) {
  const db = supabaseAdmin();
  const { data: existing, error } = await db
    .from("api_keys")
    .select("key, email, credits, total_tokens_used, created_at")
    .eq("user_id", userId)
    .like("key", `${PLAYGROUND_KEY_PREFIX}%`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (existing) {
    return withDisplayedCredits(existing as ApiKeyRecord);
  }

  const key = `${PLAYGROUND_KEY_PREFIX}${randomBytes(20).toString("hex")}`;
  const { data: created, error: createError } = await db
    .from("api_keys")
    .insert({
      key,
      email,
      credits: 0,
      user_id: userId,
    })
    .select("key, email, credits, total_tokens_used, created_at")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Failed to create playground API key");
  }

  return withDisplayedCredits(created as ApiKeyRecord);
}

export async function listAllApiKeysForUser(userId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_keys")
    .select("key, email, credits, total_tokens_used, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ApiKeyRecord[]).map(withDisplayedCredits);
}

export async function listVisibleApiKeysForUser(userId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_keys")
    .select("key, email, credits, total_tokens_used, created_at")
    .eq("user_id", userId)
    .not("key", "like", `${PLAYGROUND_KEY_PREFIX}%`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ApiKeyRecord[]).map(withDisplayedCredits);
}

export async function listAudienceOptions() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .select("id, name, metadata")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as AudienceOption[];
}

export async function listSimulationsForUser(userId: string, limit = 50) {
  const keys = await listAllApiKeysForUser(userId);
  if (keys.length === 0) {
    return [] as DashboardSimulationRecord[];
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("simulations")
    .select(
      "id, api_key, audience_id, persona_cap, platform, input, status, aggression_score, public, title, summary, shared_at, progress_messages, public_clicks, created_at, completed_at"
    )
    .in(
      "api_key",
      keys.map((keyRow) => keyRow.key)
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as DashboardSimulationRecord[];
}

export async function listSimulationShareEventsForUser(userId: string, limit = 250) {
  const simulations = await listSimulationsForUser(userId, 200);
  if (simulations.length === 0) {
    return [] as SimulationShareEventRecord[];
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("simulation_share_events")
    .select("simulation_id, channel, share_text, destination, created_at")
    .in(
      "simulation_id",
      simulations.map((simulation) => simulation.id)
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as SimulationShareEventRecord[];
}

export async function getSimulationForUser(userId: string, simulationId: string) {
  const keys = await listAllApiKeysForUser(userId);
  if (keys.length === 0) {
    return null;
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("simulations")
    .select(
      "id, api_key, audience_id, persona_cap, platform, input, thread, aggression_score, status, public, title, summary, shared_at, progress_messages, created_at, completed_at, reserved_credits, refunded_credits, error_message, started_at"
    )
    .eq("id", simulationId)
    .in(
      "api_key",
      keys.map((keyRow) => keyRow.key)
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getOrCreateStarterKeyForUser(userId: string, email: string) {
  return getOrCreatePlaygroundKey(userId, email);
}

export async function listApiKeysForUser(userId: string) {
  return listVisibleApiKeysForUser(userId);
}
