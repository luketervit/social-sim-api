import type { Persona } from "@/lib/schemas";

export interface AgentMessage {
  id?: string;
  round: number;
  agent_id: string;
  archetype: string;
  message: string;
  sentiment: "positive" | "neutral" | "negative" | "hostile";
  reply_to: string | null;
  reply_to_agent_id?: string | null;
  timestamp: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface SimulationState {
  audience_id: string;
  platform: string;
  input: string;
  personas: Persona[];
  thread: AgentMessage[];
  round: number;
  lastAgentId: string | null;
}
