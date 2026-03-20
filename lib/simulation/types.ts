import type { Persona } from "@/lib/schemas";

export interface AgentMessage {
  round: number;
  agent_id: string;
  archetype: string;
  message: string;
  sentiment: "positive" | "neutral" | "negative" | "hostile";
  timestamp: string;
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
