import type { Persona } from "@/lib/schemas";
import type { AgentMessage } from "@/lib/simulation/types";

export type Platform = "twitter" | "reddit" | "slack" | "linkedin";
export type RunMode = "single" | "variations";
export type VariantStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  reddit: "Reddit",
  slack: "Slack",
  linkedin: "LinkedIn",
};

export const PLATFORM_HANDLE: Record<Platform, string> = {
  twitter: "@",
  reddit: "u/",
  slack: "",
  linkedin: "",
};

export const SENTIMENT_COLORS: Record<AgentMessage["sentiment"], string> = {
  positive: "#1F8A55",
  neutral: "#6B6B6B",
  negative: "#C8552B",
  hostile: "#B23226",
};

export const SENTIMENT_LABELS: Record<AgentMessage["sentiment"], string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  hostile: "Hostile",
};

export const SIMULATION_ROUNDS = 10;
export const DEFAULT_PERSONA_CAP = 25;

export interface AudienceSummary {
  id: string;
  name: string;
  platform: string | null;
  status: string;
  row_count: number | null;
  created_at: string;
}

export interface VariantRun {
  id: string;
  label: string;
  hook?: string;
  rationale?: string;
  post: string;
  simulationId: string | null;
  status: VariantStatus;
  thread: AgentMessage[];
  aggression: string | null;
  error: string | null;
}

export interface ChatState {
  id: string;
  title: string;
  audienceId: string | null;
  audienceName: string | null;
  audienceRowCount: number | null;
  audiencePersonas: Persona[];
  audienceLoading: boolean;
  audienceError: string | null;
  platform: Platform | null;
  post: string;
  personaCap: number;
  mode: RunMode | null;
  variants: VariantRun[];
  variationsLoading: boolean;
  variationsError: string | null;
  runError: string | null;
  createdAt: number;
}

export function makeChat(): ChatState {
  return {
    id: `chat_${Math.random().toString(36).slice(2, 10)}`,
    title: "New chat",
    audienceId: null,
    audienceName: null,
    audienceRowCount: null,
    audiencePersonas: [],
    audienceLoading: false,
    audienceError: null,
    platform: null,
    post: "",
    personaCap: DEFAULT_PERSONA_CAP,
    mode: null,
    variants: [],
    variationsLoading: false,
    variationsError: null,
    runError: null,
    createdAt: Date.now(),
  };
}

export function inferPlatformFromFilename(name: string): Platform {
  const lower = name.toLowerCase();
  if (lower.includes("linkedin")) return "linkedin";
  if (lower.includes("discord") || lower.includes("slack")) return "slack";
  if (lower.includes("reddit")) return "reddit";
  return "twitter";
}

export function summariseArchetypes(personas: Persona[]) {
  if (personas.length === 0) return [] as Array<{ archetype: string; count: number }>;
  const map = new Map<string, number>();
  for (const p of personas) {
    const key = (p.archetype || "Unlabelled").trim();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([archetype, count]) => ({ archetype, count }))
    .sort((a, b) => b.count - a.count);
}

export function avgAffinity(personas: Persona[]): number {
  if (personas.length === 0) return 0;
  return personas.reduce((s, p) => s + p.brand_affinity, 0) / personas.length;
}

export function describeAffinity(affinity: number): string {
  if (affinity <= -0.4) return "skeptical";
  if (affinity <= -0.1) return "cool";
  if (affinity < 0.15) return "neutral";
  if (affinity < 0.45) return "warm";
  return "supportive";
}

export function formatHandle(platform: Platform, archetype: string): string {
  const cleaned = archetype.replace(/[·\s]+/g, platform === "reddit" ? "_" : "");
  return `${PLATFORM_HANDLE[platform]}${cleaned.slice(0, 24)}`;
}

export function variantId(): string {
  return `v_${Math.random().toString(36).slice(2, 10)}`;
}

export function sentimentBreakdown(thread: AgentMessage[]) {
  return {
    hostile: thread.filter((m) => m.sentiment === "hostile").length,
    negative: thread.filter((m) => m.sentiment === "negative").length,
    neutral: thread.filter((m) => m.sentiment === "neutral").length,
    positive: thread.filter((m) => m.sentiment === "positive").length,
  };
}

export function variantScore(v: VariantRun): number {
  const b = sentimentBreakdown(v.thread);
  const total = v.thread.length || 1;
  return (b.hostile * 3 + b.negative * 1.5 - b.positive * 1.2) / total;
}

export function renderChatTitle(chat: ChatState): string {
  if (chat.title && chat.title !== "New chat") return chat.title;
  if (chat.post.trim().length > 0) {
    return chat.post.trim().slice(0, 48);
  }
  if (chat.audienceName) return chat.audienceName;
  return "New chat";
}
