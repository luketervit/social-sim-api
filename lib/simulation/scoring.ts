import type { AgentMessage } from "./types";

export function scoreAggression(messages: AgentMessage[]) {
  const sentiments = messages.map((message) => message.sentiment);
  const hostileCount = sentiments.filter((sentiment) => sentiment === "hostile").length;
  const negativeCount = sentiments.filter((sentiment) => sentiment === "negative").length;
  const total = Math.max(messages.length, 1);
  const hostileRate = hostileCount / total;
  const negativeRate = (hostileCount + negativeCount) / total;

  if (hostileRate >= 0.35 || hostileCount >= 30) return "critical";
  if (negativeRate >= 0.6 || hostileRate >= 0.2) return "high";
  if (negativeRate >= 0.35) return "moderate";
  return "low";
}
