import type { AgentMessage } from "./types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SimulationJobStatus = "queued" | "running" | "completed" | "failed";

export interface SimulationJob {
  id: string;
  api_key: string;
  audience_id: string;
  persona_cap: number | null;
  platform: string;
  input: string;
  thread: AgentMessage[];
  aggression_score: string | null;
  status: SimulationJobStatus;
  progress_messages: number;
  reserved_credits: number;
  refunded_credits: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  claimed_by: string | null;
  lease_expires_at: string | null;
  created_at: string;
}

interface CreateSimulationJobInput {
  apiKey: string;
  audienceId: string;
  personaCap?: number | null;
  platform: string;
  input: string;
  reservedCredits: number;
}

export async function createSimulationJob({
  apiKey,
  audienceId,
  personaCap,
  platform,
  input,
  reservedCredits,
}: CreateSimulationJobInput): Promise<SimulationJob> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("simulations")
    .insert({
      api_key: apiKey,
      audience_id: audienceId,
      persona_cap: personaCap ?? null,
      platform,
      input,
      status: "queued",
      progress_messages: 0,
      reserved_credits: reservedCredits,
      refunded_credits: 0,
      thread: [],
    })
    .select(
      "id, api_key, audience_id, persona_cap, platform, input, thread, aggression_score, status, progress_messages, reserved_credits, refunded_credits, error_message, started_at, completed_at, claimed_by, lease_expires_at, created_at"
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create simulation job");
  }

  return data as SimulationJob;
}

export async function getSimulationJob(id: string, apiKey: string): Promise<SimulationJob | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("simulations")
    .select(
      "id, api_key, audience_id, persona_cap, platform, input, thread, aggression_score, status, progress_messages, reserved_credits, refunded_credits, error_message, started_at, completed_at, claimed_by, lease_expires_at, created_at"
    )
    .eq("id", id)
    .eq("api_key", apiKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SimulationJob | null) ?? null;
}

export async function claimNextSimulationJob(workerId: string, leaseSeconds: number): Promise<SimulationJob | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("claim_next_simulation_job", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0] as SimulationJob;
}

export async function heartbeatSimulationJob(
  id: string,
  workerId: string,
  thread: AgentMessage[],
  progressMessages: number,
  leaseSeconds: number
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("simulations")
    .update({
      thread,
      progress_messages: progressMessages,
      lease_expires_at: new Date(Date.now() + leaseSeconds * 1000).toISOString(),
    })
    .eq("id", id)
    .eq("claimed_by", workerId)
    .eq("status", "running");

  if (error) {
    throw error;
  }
}

interface CompleteSimulationJobInput {
  id: string;
  workerId: string;
  messages: AgentMessage[];
  aggressionScore: string;
}

export async function completeSimulationJob({
  id,
  workerId,
  messages,
  aggressionScore,
}: CompleteSimulationJobInput): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("simulations")
    .update({
      status: "completed",
      progress_messages: messages.length,
      thread: messages,
      aggression_score: aggressionScore,
      completed_at: new Date().toISOString(),
      lease_expires_at: null,
      error_message: null,
    })
    .eq("id", id)
    .eq("claimed_by", workerId);

  if (error) {
    throw error;
  }
}

interface FailSimulationJobInput {
  id: string;
  workerId: string;
  messages: AgentMessage[];
  errorMessage: string;
  refundedCredits: number;
}

export async function failSimulationJob({
  id,
  workerId,
  messages,
  errorMessage,
  refundedCredits,
}: FailSimulationJobInput): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("simulations")
    .update({
      status: "failed",
      progress_messages: messages.length,
      thread: messages,
      refunded_credits: refundedCredits,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      lease_expires_at: null,
    })
    .eq("id", id)
    .eq("claimed_by", workerId);

  if (error) {
    throw error;
  }
}
