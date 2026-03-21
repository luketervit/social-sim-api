"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentMessage } from "@/lib/simulation/types";
import { buildResolvedThread } from "@/lib/simulation/threading";

type ViewMode = number | "all";

interface SimulationGraphProps {
  thread: AgentMessage[];
  height?: number;
  autoPlay?: boolean;
  playbackSpeed?: number;
  compact?: boolean;
}

interface AgentNode {
  id: string;
  archetype: string;
  firstRound: number;
  lastRound: number;
  activeRounds: Set<number>;
  messageCount: number;
  replyCount: number;
  hostileCount: number;
  latestSentiment: AgentMessage["sentiment"];
  degree: number;
  weight: number;
}

interface AgentLink {
  id: string;
  source: string;
  target: string;
  firstRound: number;
  rounds: Set<number>;
  replyRounds: Set<number>;
  coPresenceRounds: Set<number>;
  replyWeight: number;
  coPresenceWeight: number;
}

interface GraphModel {
  nodes: AgentNode[];
  links: AgentLink[];
  totalRounds: number;
}

interface PositionedNode extends AgentNode {
  x: number;
  y: number;
  radius: number;
}

const LAYOUT_WIDTH = 1000;
const LAYOUT_HEIGHT = 620;
const LAYOUT_PADDING = 96;

const SENTIMENT_LABELS: Record<AgentMessage["sentiment"], string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  hostile: "Hostile",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildGraph(thread: AgentMessage[]): GraphModel {
  if (thread.length === 0) {
    return { nodes: [], links: [], totalRounds: 0 };
  }

  const { ordered: sorted, byId } = buildResolvedThread(thread);

  const distinctRounds = Array.from(new Set(sorted.map((message) => message.round))).sort((a, b) => a - b);
  const normalizedRound = new Map(distinctRounds.map((round, index) => [round, index + 1] as const));

  const nodeMap = new Map<string, AgentNode>();
  const linkMap = new Map<string, AgentLink>();
  const roundParticipants = new Map<number, Set<string>>();

  for (const message of sorted) {
    const round = normalizedRound.get(message.round) ?? 1;
    if (!nodeMap.has(message.agent_id)) {
      nodeMap.set(message.agent_id, {
        id: message.agent_id,
        archetype: message.archetype,
        firstRound: round,
        lastRound: round,
        activeRounds: new Set<number>(),
        messageCount: 0,
        replyCount: 0,
        hostileCount: 0,
        latestSentiment: message.sentiment,
        degree: 0,
        weight: 0,
      });
    }

    const node = nodeMap.get(message.agent_id)!;
    node.firstRound = Math.min(node.firstRound, round);
    node.lastRound = Math.max(node.lastRound, round);
    node.activeRounds.add(round);
    node.messageCount += 1;
    node.latestSentiment = message.sentiment;
    if (message.sentiment === "hostile") node.hostileCount += 1;

    if (!roundParticipants.has(round)) {
      roundParticipants.set(round, new Set());
    }
    roundParticipants.get(round)!.add(message.agent_id);

    if (!message.parentMessageId || !message.parentAgentId || message.parentAgentId === message.agent_id) {
      continue;
    }

    const source = message.agent_id;
    const target = byId.get(message.parentMessageId)?.agent_id ?? message.parentAgentId;
    const key = [source, target].sort().join("::");
    if (!linkMap.has(key)) {
      linkMap.set(key, {
        id: key,
        source,
        target,
        firstRound: round,
        rounds: new Set<number>(),
        replyRounds: new Set<number>(),
        coPresenceRounds: new Set<number>(),
        replyWeight: 0,
        coPresenceWeight: 0,
      });
    }

    const link = linkMap.get(key)!;
    link.firstRound = Math.min(link.firstRound, round);
    link.rounds.add(round);
    link.replyRounds.add(round);
    link.replyWeight += 1;
    node.replyCount += 1;
  }

  for (const [round, participants] of roundParticipants) {
    const ids = [...participants];
    for (let index = 0; index < ids.length; index += 1) {
      for (let inner = index + 1; inner < ids.length; inner += 1) {
        const source = ids[index];
        const target = ids[inner];
        const key = [source, target].sort().join("::");
        if (!linkMap.has(key)) {
          linkMap.set(key, {
            id: key,
            source,
            target,
            firstRound: round,
            rounds: new Set<number>(),
            replyRounds: new Set<number>(),
            coPresenceRounds: new Set<number>(),
            replyWeight: 0,
            coPresenceWeight: 0,
          });
        }

        const link = linkMap.get(key)!;
        link.firstRound = Math.min(link.firstRound, round);
        link.rounds.add(round);
        link.coPresenceRounds.add(round);
        link.coPresenceWeight += 0.3;
      }
    }
  }

  const nodes = [...nodeMap.values()];
  const links = [...linkMap.values()].filter((link) => link.replyWeight > 0 || link.coPresenceWeight > 0);
  const degreeMap = new Map<string, number>();

  for (const link of links) {
    degreeMap.set(link.source, (degreeMap.get(link.source) ?? 0) + 1);
    degreeMap.set(link.target, (degreeMap.get(link.target) ?? 0) + 1);
  }

  const maxMessages = Math.max(...nodes.map((node) => node.messageCount), 1);
  const maxReplies = Math.max(...nodes.map((node) => node.replyCount), 1);

  for (const node of nodes) {
    node.degree = degreeMap.get(node.id) ?? 0;
    node.weight =
      1 +
      (node.messageCount / maxMessages) * 1.7 +
      (node.replyCount / maxReplies) * 1.4 +
      Math.min(node.degree, 6) * 0.12;
  }

  return {
    nodes,
    links,
    totalRounds: distinctRounds.length,
  };
}

function computeLayout(graph: GraphModel, compact: boolean) {
  if (graph.nodes.length === 0) {
    return new Map<string, PositionedNode>();
  }

  const positions = new Map<string, { x: number; y: number }>();
  const velocities = new Map<string, { x: number; y: number }>();
  const centerX = LAYOUT_WIDTH / 2;
  const centerY = LAYOUT_HEIGHT / 2;

  const orderedNodes = [...graph.nodes].sort((left, right) => {
    if (right.degree !== left.degree) return right.degree - left.degree;
    if (right.replyCount !== left.replyCount) return right.replyCount - left.replyCount;
    return left.id.localeCompare(right.id);
  });

  for (let index = 0; index < orderedNodes.length; index += 1) {
    const node = orderedNodes[index];
    const seed = hashString(node.id);
    const angle = (((seed % 360) + index * 31) * Math.PI) / 180;
    const radius = 60 + (index / Math.max(orderedNodes.length, 1)) * 210;
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
    velocities.set(node.id, { x: 0, y: 0 });
  }

  for (let iteration = 0; iteration < 220; iteration += 1) {
    const forces = new Map<string, { x: number; y: number }>();
    for (const node of orderedNodes) {
      forces.set(node.id, { x: 0, y: 0 });
    }

    for (let index = 0; index < orderedNodes.length; index += 1) {
      for (let inner = index + 1; inner < orderedNodes.length; inner += 1) {
        const left = orderedNodes[index];
        const right = orderedNodes[inner];
        const leftPos = positions.get(left.id)!;
        const rightPos = positions.get(right.id)!;
        const dx = rightPos.x - leftPos.x;
        const dy = rightPos.y - leftPos.y;
        const distanceSq = dx * dx + dy * dy + 0.01;
        const distance = Math.sqrt(distanceSq);
        const repulsion = 18000 / distanceSq;
        const forceX = (dx / distance) * repulsion;
        const forceY = (dy / distance) * repulsion;
        forces.get(left.id)!.x -= forceX;
        forces.get(left.id)!.y -= forceY;
        forces.get(right.id)!.x += forceX;
        forces.get(right.id)!.y += forceY;
      }
    }

    for (const link of graph.links) {
      const sourcePos = positions.get(link.source)!;
      const targetPos = positions.get(link.target)!;
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const desired = link.replyWeight > 0 ? 132 : 188;
      const spring = (distance - desired) * (link.replyWeight > 0 ? 0.014 : 0.007);
      const forceX = (dx / distance) * spring;
      const forceY = (dy / distance) * spring;
      forces.get(link.source)!.x += forceX;
      forces.get(link.source)!.y += forceY;
      forces.get(link.target)!.x -= forceX;
      forces.get(link.target)!.y -= forceY;
    }

    for (const node of orderedNodes) {
      const position = positions.get(node.id)!;
      const velocity = velocities.get(node.id)!;
      const force = forces.get(node.id)!;
      force.x += (centerX - position.x) * 0.003;
      force.y += (centerY - position.y) * 0.003;
      velocity.x = (velocity.x + force.x) * 0.82;
      velocity.y = (velocity.y + force.y) * 0.82;
      position.x = clamp(position.x + velocity.x, LAYOUT_PADDING, LAYOUT_WIDTH - LAYOUT_PADDING);
      position.y = clamp(position.y + velocity.y, LAYOUT_PADDING, LAYOUT_HEIGHT - LAYOUT_PADDING);
    }
  }

  const placed = new Map<string, PositionedNode>();
  const maxWeight = Math.max(...graph.nodes.map((node) => node.weight), 1);
  for (const node of graph.nodes) {
    const position = positions.get(node.id)!;
    placed.set(node.id, {
      ...node,
      x: position.x,
      y: position.y,
      radius: (compact ? 10 : 12) + (node.weight / maxWeight) * (compact ? 10 : 13),
    });
  }

  return placed;
}

function buildLinkPath(source: PositionedNode, target: PositionedNode) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / distance;
  const ny = dx / distance;
  const curvature = Math.min(28, distance * 0.12);
  const midX = (source.x + target.x) / 2 + nx * curvature;
  const midY = (source.y + target.y) / 2 + ny * curvature;
  return `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`;
}

export default function SimulationGraph({
  thread,
  height = 460,
  autoPlay = true,
  playbackSpeed = 1500,
  compact = false,
}: SimulationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(760);
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const graph = useMemo(() => buildGraph(thread), [thread]);
  const layout = useMemo(() => computeLayout(graph, compact), [compact, graph]);
  const maxRound = graph.totalRounds;
  const activeRound = typeof viewMode === "number" ? viewMode : null;
  const showingAllRounds = viewMode === "all";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(Math.floor(width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setViewMode("all");
    setIsPlaying(false);
    setHoveredNodeId(null);
    setSelectedNodeId(null);
  }, [thread]);

  useEffect(() => {
    if (!autoPlay || reducedMotion || maxRound === 0) return;
    const timeout = window.setTimeout(() => {
      setViewMode(1);
      setIsPlaying(true);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [autoPlay, maxRound, reducedMotion, thread]);

  useEffect(() => {
    if (!isPlaying || maxRound === 0) return;
    const interval = window.setInterval(() => {
      setViewMode((previous) => {
        const current = typeof previous === "number" ? previous : 0;
        const next = current + 1;
        if (next >= maxRound) {
          setIsPlaying(false);
          return maxRound;
        }
        return next;
      });
    }, playbackSpeed);
    return () => window.clearInterval(interval);
  }, [isPlaying, maxRound, playbackSpeed]);

  const visibleNodes = useMemo(() => {
    return graph.nodes
      .filter((node) => showingAllRounds || (activeRound !== null && node.firstRound <= activeRound))
      .map((node) => layout.get(node.id)!)
      .filter(Boolean);
  }, [activeRound, graph.nodes, layout, showingAllRounds]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes]
  );

  const visibleLinks = useMemo(() => {
    return graph.links
      .filter((link) => showingAllRounds || (activeRound !== null && link.firstRound <= activeRound))
      .filter((link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target))
      .map((link) => ({
        ...link,
        sourceNode: layout.get(link.source)!,
        targetNode: layout.get(link.target)!,
      }));
  }, [activeRound, graph.links, layout, showingAllRounds, visibleNodeIds]);

  useEffect(() => {
    if (hoveredNodeId && !visibleNodeIds.has(hoveredNodeId)) setHoveredNodeId(null);
    if (selectedNodeId && !visibleNodeIds.has(selectedNodeId)) setSelectedNodeId(null);
  }, [hoveredNodeId, selectedNodeId, visibleNodeIds]);

  const nodeLookup = useMemo(
    () => new Map(visibleNodes.map((node) => [node.id, node] as const)),
    [visibleNodes]
  );
  const detailNode = (selectedNodeId && nodeLookup.get(selectedNodeId)) || (hoveredNodeId && nodeLookup.get(hoveredNodeId)) || null;

  const activeAgentCount = activeRound
    ? visibleNodes.filter((node) => node.activeRounds.has(activeRound)).length
    : visibleNodes.length;
  const activeLinkCount = activeRound
    ? visibleLinks.filter((link) => link.rounds.has(activeRound)).length
    : visibleLinks.length;

  const xScale = containerWidth / LAYOUT_WIDTH;
  const yScale = height / LAYOUT_HEIGHT;
  const scale = Math.min(xScale, yScale);
  const offsetX = (containerWidth - LAYOUT_WIDTH * scale) / 2;
  const offsetY = (height - LAYOUT_HEIGHT * scale) / 2;
  const toScreenX = (x: number) => offsetX + x * scale;
  const toScreenY = (y: number) => offsetY + y * scale;

  const handlePlay = () => {
    setHoveredNodeId(null);
    setSelectedNodeId(null);
    setViewMode(1);
    setIsPlaying(true);
  };

  const handlePause = () => setIsPlaying(false);

  const handleReset = () => {
    setIsPlaying(false);
    setViewMode("all");
    setHoveredNodeId(null);
    setSelectedNodeId(null);
  };

  if (graph.nodes.length === 0) return null;

  if (!isMounted) {
    return (
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl"
        style={{
          background: "var(--bg-element)",
          border: "1px solid var(--border)",
          isolation: "isolate",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="mono-label">INTERACTION_GRAPH</span>
            <span className="tabular-nums" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Loading graph
            </span>
          </div>
        </div>
        <div
          style={{
            height,
            background:
              "radial-gradient(circle at 20% 18%, rgba(244,244,245,0.04), transparent 34%), linear-gradient(180deg, rgba(9,9,11,0.96), rgba(9,9,11,0.98))",
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-xl"
      style={{
        background: "var(--bg-element)",
        border: "1px solid var(--border)",
        isolation: "isolate",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="mono-label">INTERACTION_GRAPH</span>
          <span className="tabular-nums" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {showingAllRounds ? `All ${maxRound} rounds` : `Round ${activeRound}/${maxRound}`}
            <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>
              {showingAllRounds
                ? `${visibleNodes.length} agents · ${visibleLinks.length} visible connections`
                : `${activeAgentCount} active agents · ${visibleNodes.length} discovered · ${activeLinkCount} round links`}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isPlaying ? (
            <button
              type="button"
              onClick={handlePause}
              aria-label="Pause playback"
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                minWidth: 44,
                minHeight: 44,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ❚❚
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              aria-label="Play round-by-round"
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                minWidth: 44,
                minHeight: 44,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ▶
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset graph"
            className="flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ↺
          </button>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          height,
          background:
            "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.05), transparent 26%), radial-gradient(circle at 82% 22%, rgba(255,255,255,0.04), transparent 24%), linear-gradient(180deg, rgba(15,15,18,0.98), rgba(9,9,11,1))",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.06) 0.7px, transparent 0.7px)",
            backgroundSize: "18px 18px",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
            Persistent audience network
          </p>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
            Bright links are direct replies. Previous rounds stay visible as the network grows.
          </p>
        </div>

        {detailNode ? (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: compact ? 220 : 280,
              padding: compact ? "12px" : "14px 16px",
              borderRadius: 16,
              background: "rgba(18,18,22,0.88)",
              border: "1px solid rgba(63,63,70,0.85)",
              boxShadow: "0 26px 54px rgba(0,0,0,0.34)",
              backdropFilter: "blur(18px)",
              zIndex: 3,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 42,
                  height: 42,
                  background: "rgba(244,244,245,0.08)",
                  border: "1px solid rgba(228,228,231,0.12)",
                  color: "rgba(244,244,245,1)",
                  fontSize: 14,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {detailNode.archetype.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 600, lineHeight: 1.2 }}>
                  {detailNode.archetype}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>
                  Round {detailNode.firstRound} to {detailNode.lastRound}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[`${detailNode.messageCount} posts`, detailNode.replyCount > 0 ? `${detailNode.replyCount} replies` : null, `${detailNode.activeRounds.size} active rounds`, detailNode.hostileCount > 0 ? `${detailNode.hostileCount} hostile turns` : null]
                .filter(Boolean)
                .map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full px-2.5 py-1"
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {badge}
                  </span>
                ))}
            </div>

            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 }}>
              Latest tone: {SENTIMENT_LABELS[detailNode.latestSentiment]}
            </p>
          </div>
        ) : null}

        <svg
          width={containerWidth}
          height={height}
          viewBox={`0 0 ${containerWidth} ${height}`}
          style={{ display: "block" }}
        >
          {visibleLinks.map((link) => {
            const isActive = activeRound !== null && link.rounds.has(activeRound);
            const isReplyActive = activeRound !== null && link.replyRounds.has(activeRound);
            const source = link.sourceNode;
            const target = link.targetNode;
            const path = buildLinkPath(
              { ...source, x: toScreenX(source.x), y: toScreenY(source.y) },
              { ...target, x: toScreenX(target.x), y: toScreenY(target.y) }
            );

            return (
              <path
                key={link.id}
                d={path}
                fill="none"
                stroke={
                  isReplyActive
                    ? "rgba(244,244,245,0.92)"
                    : isActive
                      ? "rgba(212,212,216,0.36)"
                      : link.replyWeight > 0
                        ? "rgba(161,161,170,0.2)"
                        : "rgba(113,113,122,0.08)"
                }
                strokeWidth={isReplyActive ? 2.3 : link.replyWeight > 0 ? 1.2 : 0.8}
                strokeLinecap="round"
              />
            );
          })}

          {visibleNodes.map((node) => {
            const x = toScreenX(node.x);
            const y = toScreenY(node.y);
            const r = node.radius * scale;
            const isHovered = hoveredNodeId === node.id;
            const isSelected = selectedNodeId === node.id;
            const isRoundActive = activeRound !== null && node.activeRounds.has(activeRound);
            const isHistoric = showingAllRounds || (activeRound !== null && node.lastRound < activeRound);

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
                onClick={() => setSelectedNodeId((current) => (current === node.id ? null : node.id))}
                style={{ cursor: "pointer" }}
              >
                {(isHovered || isSelected || isRoundActive) ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={r + (isRoundActive ? 18 : 12)}
                    fill="rgba(255,255,255,0.08)"
                  />
                ) : null}
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={isRoundActive ? "rgba(255,255,255,0.98)" : isHistoric ? "rgba(220,220,223,0.94)" : "rgba(150,150,160,0.9)"}
                  stroke={isSelected ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.14)"}
                  strokeWidth={isSelected ? 1.8 : 1}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={Math.max(3, r - 5)}
                  fill="rgba(255,255,255,0.34)"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {!compact ? (
        <div
          className="flex items-center gap-1 overflow-x-auto px-4 py-2.5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setViewMode("all");
            }}
            className="flex items-center justify-center"
            style={{
              minWidth: 44,
              minHeight: 36,
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: 10,
              fontFamily: "var(--font-data), monospace",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: "none",
              background: showingAllRounds ? "rgba(228,228,231,0.08)" : "transparent",
              color: showingAllRounds ? "var(--text-primary)" : "var(--text-tertiary)",
              cursor: "pointer",
            }}
          >
            All
          </button>
          {Array.from({ length: maxRound }, (_, index) => index + 1).map((round) => (
            <button
              key={round}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setViewMode(round);
              }}
              className="tabular-nums flex items-center justify-center"
              style={{
                minWidth: 40,
                minHeight: 36,
                padding: "6px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "var(--font-data), monospace",
                border: "none",
                background: activeRound === round ? "rgba(228,228,231,0.08)" : "transparent",
                color: activeRound === round ? "var(--text-primary)" : "var(--text-tertiary)",
                cursor: "pointer",
              }}
            >
              {String(round).padStart(2, "0")}
            </button>
          ))}
        </div>
      ) : null}

      {!compact ? (
        <div
          className="flex flex-wrap items-center gap-4 px-4 py-2.5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-1.5">
            <div className="rounded-full" style={{ width: 8, height: 8, background: "rgba(244,244,245,0.92)" }} />
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Active round participants</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 16, height: 0, borderTop: "2px solid rgba(244,244,245,0.72)" }} />
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Direct replies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 16, height: 0, borderTop: "1px solid rgba(113,113,122,0.3)" }} />
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Prior rounds remain visible</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
