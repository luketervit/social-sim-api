import type { Persona } from "@/lib/schemas";

export interface AgentEngagementSignals {
  relevance: number;
  author_fit: number;
  trust: number;
  depth: number;
  save_intent: number;
  comment_intent: number;
}

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
  /**
   * Internal reasoning the agent surfaced for this reply. Used in the
   * simulator UI to expand "why did this agent react this way" and as
   * higher-quality demo material for VC pitches. Optional because some
   * model outputs may fail JSON parsing — in that case the message is
   * still kept (we never drop messages over a parse failure).
   */
  reasoning?: string | null;
  /** What this agent would push back on, if anything. */
  objection?: string | null;
  /** What would change the agent's mind. */
  what_would_change_my_mind?: string | null;
  /** Latent feed and engagement features used by relevance-aware platforms. */
  engagement_signals?: AgentEngagementSignals | null;
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
