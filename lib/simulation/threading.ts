import type { AgentMessage } from "./types";

export interface ResolvedAgentMessage extends AgentMessage {
  id: string;
  parentMessageId: string | null;
  parentAgentId: string | null;
  parentArchetype: string | null;
  originalIndex: number;
  depth: number;
  children: ResolvedAgentMessage[];
}

function compareMessages(left: AgentMessage, right: AgentMessage) {
  if (left.round !== right.round) return left.round - right.round;
  if (left.timestamp !== right.timestamp) return left.timestamp.localeCompare(right.timestamp);
  return 0;
}

export function getMessageId(message: AgentMessage, fallbackIndex: number) {
  return message.id ?? `${message.agent_id}-${message.round}-${fallbackIndex}`;
}

export function buildResolvedThread(thread: AgentMessage[]) {
  const ordered = [...thread]
    .map((message, originalIndex) => ({ message, originalIndex }))
    .sort((left, right) => {
      const result = compareMessages(left.message, right.message);
      return result !== 0 ? result : left.originalIndex - right.originalIndex;
    });

  const byId = new Map<string, ResolvedAgentMessage>();
  const latestMessageIdByAgent = new Map<string, string>();
  const roots: ResolvedAgentMessage[] = [];
  const resolved: ResolvedAgentMessage[] = [];

  for (const { message, originalIndex } of ordered) {
    const id = getMessageId(message, originalIndex);
    let parentMessageId: string | null = null;
    let parentAgentId: string | null = null;
    let parentArchetype: string | null = null;

    if (message.reply_to && byId.has(message.reply_to)) {
      const parent = byId.get(message.reply_to)!;
      parentMessageId = parent.id;
      parentAgentId = parent.agent_id;
      parentArchetype = parent.archetype;
    } else {
      const hintedParentAgentId = message.reply_to_agent_id ?? message.reply_to;
      if (hintedParentAgentId) {
        const latestParentMessageId = latestMessageIdByAgent.get(hintedParentAgentId) ?? null;
        if (latestParentMessageId) {
          const parent = byId.get(latestParentMessageId);
          if (parent) {
            parentMessageId = parent.id;
            parentAgentId = parent.agent_id;
            parentArchetype = parent.archetype;
          }
        } else {
          parentAgentId = hintedParentAgentId;
        }
      }
    }

    const entry: ResolvedAgentMessage = {
      ...message,
      id,
      parentMessageId,
      parentAgentId,
      parentArchetype,
      originalIndex,
      depth: 0,
      children: [],
    };

    byId.set(id, entry);
    resolved.push(entry);

    if (parentMessageId) {
      byId.get(parentMessageId)?.children.push(entry);
    } else {
      roots.push(entry);
    }

    latestMessageIdByAgent.set(message.agent_id, id);
  }

  const stack = roots.map((root) => ({ node: root, depth: 0 }));
  while (stack.length > 0) {
    const current = stack.pop()!;
    current.node.depth = current.depth;
    for (let index = current.node.children.length - 1; index >= 0; index -= 1) {
      stack.push({
        node: current.node.children[index],
        depth: current.depth + 1,
      });
    }
  }

  return {
    roots,
    ordered: resolved,
    byId,
  };
}
