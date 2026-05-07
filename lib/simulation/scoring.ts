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

export function computeSimulationMetrics(
  messages: AgentMessage[],
  platform?: string
) {
  const hostile = messages.filter((message) => message.sentiment === "hostile").length;
  const negative = messages.filter((message) => message.sentiment === "negative").length;
  const neutral = messages.filter((message) => message.sentiment === "neutral").length;
  const positive = messages.filter((message) => message.sentiment === "positive").length;
  const total = Math.max(messages.length, 1);
  const withSignals = messages.filter((message) => message.engagement_signals);

  const averageSignal = (
    selector: (message: NonNullable<typeof withSignals[number]["engagement_signals"]>) => number
  ) =>
    withSignals.length === 0
      ? null
      : withSignals.reduce(
          (sum, message) => sum + selector(message.engagement_signals!),
          0
        ) / withSignals.length;

  const replyDepth = total === 0
    ? 0
    : messages.filter((message) => message.reply_to).length / total;

  const thoughtfulCommentRate =
    total === 0
      ? 0
      : messages.filter((message) => {
          const signalDepth = message.engagement_signals?.depth ?? 0;
          return (
            message.sentiment !== "hostile" &&
            message.sentiment !== "negative" &&
            signalDepth >= 0.55
          );
        }).length / total;

  const qualifiedEngagement =
    withSignals.length === 0
      ? null
      : (
          (averageSignal((signal) => signal.depth) ?? 0) * 0.22 +
          (averageSignal((signal) => signal.save_intent) ?? 0) * 0.28 +
          (averageSignal((signal) => signal.trust) ?? 0) * 0.18 +
          (averageSignal((signal) => signal.relevance) ?? 0) * 0.18 +
          thoughtfulCommentRate * 0.14
        );

  return {
    platform: platform ?? null,
    message_count: messages.length,
    sentiment: {
      hostile,
      negative,
      neutral,
      positive,
    },
    rates: {
      hostile: hostile / total,
      negative: negative / total,
      neutral: neutral / total,
      positive: positive / total,
      reply_depth: replyDepth,
      thoughtful_comment_rate: thoughtfulCommentRate,
    },
    signals: {
      relevance: averageSignal((signal) => signal.relevance),
      author_fit: averageSignal((signal) => signal.author_fit),
      trust: averageSignal((signal) => signal.trust),
      depth: averageSignal((signal) => signal.depth),
      save_intent: averageSignal((signal) => signal.save_intent),
      comment_intent: averageSignal((signal) => signal.comment_intent),
    },
    qualified_engagement_score:
      platform === "linkedin" ? qualifiedEngagement : null,
  };
}
