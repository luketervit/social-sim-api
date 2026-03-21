"use client";

import type { AgentMessage } from "@/lib/simulation/types";
import { buildResolvedThread, type ResolvedAgentMessage } from "@/lib/simulation/threading";

const SENTIMENT_COLORS: Record<string, string> = {
  hostile: "#ef4444",
  negative: "#f97316",
  neutral: "#71717a",
  positive: "#22c55e",
};

interface SimulationThreadProps {
  thread: AgentMessage[];
  platform: string;
}

/* ─── Username formatters per platform ─── */
function formatHandle(archetype: string, agentId: string, platform: string) {
  const slug = archetype.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
  switch (platform) {
    case "twitter":
      return `@${slug}`;
    case "reddit":
      return `u/${slug}`;
    default:
      return archetype;
  }
}

function formatTimestamp(platform: string, index: number) {
  if (platform === "twitter") {
    const mins = index * 3 + 1;
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;
  }
  if (platform === "reddit") {
    const mins = index * 4 + 2;
    if (mins < 60) return `${mins} min. ago`;
    return `${Math.floor(mins / 60)} hr. ago`;
  }
  // slack
  const h = 9 + Math.floor(index / 4);
  const m = (index * 7) % 60;
  return `${h}:${String(m).padStart(2, "0")} AM`;
}

/* ─── Twitter message ─── */
function getIndent(depth: number) {
  return Math.min(depth, 5) * 26;
}

function ReplyMeta({
  parent,
  platform,
}: {
  parent: ResolvedAgentMessage | null;
  platform: string;
}) {
  if (!parent) return null;

  const handle = formatHandle(parent.archetype, parent.agent_id, platform);
  return (
    <p
      style={{
        fontSize: 11,
        color: "var(--text-tertiary)",
        marginTop: 2,
      }}
    >
      Replying to {handle}
    </p>
  );
}

function TwitterMessage({
  msg,
  index,
  depth,
  parent,
}: {
  msg: AgentMessage;
  index: number;
  depth: number;
  parent: ResolvedAgentMessage | null;
}) {
  const handle = formatHandle(msg.archetype, msg.agent_id, "twitter");

  return (
    <div>
      <div
        className="px-4 py-3"
        style={{
          borderBottom: "1px solid rgba(39, 39, 42, 0.3)",
          paddingLeft: 16 + getIndent(depth),
        }}
      >
        <div className="flex items-start gap-2.5">
          {/* Avatar dot */}
          <div
            className="mt-1 flex-shrink-0 rounded-full"
            style={{
              width: 32,
              height: 32,
              background: `linear-gradient(135deg, ${SENTIMENT_COLORS[msg.sentiment]}44, ${SENTIMENT_COLORS[msg.sentiment]}22)`,
              border: `1px solid ${SENTIMENT_COLORS[msg.sentiment]}55`,
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              color: SENTIMENT_COLORS[msg.sentiment],
              fontWeight: 600,
            }}
          >
            {msg.archetype.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                }}
              >
                {msg.archetype}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {handle}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", opacity: 0.5 }}>
                ·
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {formatTimestamp("twitter", index)}
              </span>
              <div
                className="ml-auto flex-shrink-0 rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: SENTIMENT_COLORS[msg.sentiment],
                }}
              />
            </div>

            <ReplyMeta parent={parent} platform="twitter" />

            {/* Tweet body */}
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--text-secondary)",
                marginTop: 4,
              }}
            >
              {msg.message}
            </p>

            {/* Engagement bar */}
            <div
              className="mt-2 flex items-center gap-5"
              style={{ fontSize: 11, color: "var(--text-tertiary)" }}
            >
              <span>↩</span>
              <span>♻</span>
              <span>♡</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Reddit message ─── */
function RedditMessage({
  msg,
  index,
  depth,
  parent,
}: {
  msg: AgentMessage;
  index: number;
  depth: number;
  parent: ResolvedAgentMessage | null;
}) {
  const handle = formatHandle(msg.archetype, msg.agent_id, "reddit");

  return (
    <div
      className="py-2.5"
      style={{
        borderBottom: "1px solid rgba(39, 39, 42, 0.3)",
        paddingLeft: 16 + getIndent(depth),
      }}
    >
      <div className="px-4">
        {/* Header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              background: SENTIMENT_COLORS[msg.sentiment],
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#4a9eff",
              letterSpacing: "-0.01em",
            }}
          >
            {handle}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            · {formatTimestamp("reddit", index)}
          </span>
        </div>

        <ReplyMeta parent={parent} platform="reddit" />

        {/* Comment body */}
        <p
          className="mt-1"
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          {msg.message}
        </p>

        {/* Action bar */}
        <div
          className="mt-1.5 flex items-center gap-4"
          style={{ fontSize: 11, color: "var(--text-tertiary)" }}
        >
          <span>⬆ Vote</span>
          <span>Reply</span>
          <span>Share</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Slack message ─── */
function SlackMessage({
  msg,
  index,
  depth,
  parent,
}: {
  msg: AgentMessage;
  index: number;
  depth: number;
  parent: ResolvedAgentMessage | null;
}) {
  return (
    <div
      className="flex gap-2.5 px-4 py-2"
      style={{
        borderBottom: "1px solid rgba(39, 39, 42, 0.15)",
        paddingLeft: 16 + getIndent(depth),
      }}
    >
      {/* Avatar */}
      <div
        className="mt-0.5 flex-shrink-0 rounded"
        style={{
          width: 32,
          height: 32,
          background: `linear-gradient(135deg, ${SENTIMENT_COLORS[msg.sentiment]}33, ${SENTIMENT_COLORS[msg.sentiment]}18)`,
          border: `1px solid ${SENTIMENT_COLORS[msg.sentiment]}33`,
          borderRadius: 6,
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          color: SENTIMENT_COLORS[msg.sentiment],
          fontWeight: 600,
        }}
      >
        {msg.archetype.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {msg.archetype}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {formatTimestamp("slack", index)}
          </span>
          <div
            className="ml-auto flex-shrink-0 rounded-full"
            style={{
              width: 6,
              height: 6,
              background: SENTIMENT_COLORS[msg.sentiment],
            }}
          />
        </div>

        <ReplyMeta parent={parent} platform="slack" />

        {/* Message */}
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            marginTop: 2,
          }}
        >
          {msg.message}
        </p>
      </div>
    </div>
  );
}

function flattenThread(roots: ResolvedAgentMessage[]) {
  const flattened: ResolvedAgentMessage[] = [];
  const visit = (node: ResolvedAgentMessage) => {
    flattened.push(node);
    for (const child of node.children) {
      visit(child);
    }
  };

  for (const root of roots) {
    visit(root);
  }

  return flattened;
}

/* ─── Main component ─── */
export default function SimulationThread({ thread, platform }: SimulationThreadProps) {
  const { roots, byId } = buildResolvedThread(thread);
  const flattened = flattenThread(roots);

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-element)",
      }}
    >
      {platform === "twitter" &&
        flattened.map((message, i) => (
          <TwitterMessage
            key={message.id}
            msg={message}
            index={i}
            depth={message.depth}
            parent={message.parentMessageId ? byId.get(message.parentMessageId) ?? null : null}
          />
        ))}

      {platform === "reddit" &&
        flattened.map((message, i) => (
          <RedditMessage
            key={message.id}
            msg={message}
            index={i}
            depth={message.depth}
            parent={message.parentMessageId ? byId.get(message.parentMessageId) ?? null : null}
          />
        ))}

      {platform === "slack" &&
        flattened.map((message, i) => (
          <SlackMessage
            key={message.id}
            msg={message}
            index={i}
            depth={message.depth}
            parent={message.parentMessageId ? byId.get(message.parentMessageId) ?? null : null}
          />
        ))}

      {!["twitter", "reddit", "slack"].includes(platform) &&
        flattened.map((message, i) => (
          <TwitterMessage
            key={message.id}
            msg={message}
            index={i}
            depth={message.depth}
            parent={message.parentMessageId ? byId.get(message.parentMessageId) ?? null : null}
          />
        ))}
    </div>
  );
}
