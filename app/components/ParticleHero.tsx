"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  violet: "#7C5CFC",
  coral: "#F97066",
  mint: "#34D399",
};

const COLOR_ARRAY = [
  COLORS.violet,
  COLORS.violet,
  COLORS.violet,
  COLORS.coral,
  COLORS.mint,
  COLORS.mint,
];

const COLORS_AMBER = "#F59E0B";

// Cluster → color mapping (4 distinct colors)
const CLUSTER_COLORS = [
  COLORS.violet,
  COLORS.coral,
  COLORS.mint,
  COLORS_AMBER,
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

interface Node {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  targetRadius: number;
  opacity: number;
  targetOpacity: number;
  cluster: number;
}

interface Edge {
  from: number;
  to: number;
  delay: number; // 0–1 normalized delay for stagger
}

/**
 * Generate graph node positions using a force-directed-ish layout.
 * Creates clusters that look like a social network.
 */
function generateGraphLayout(
  count: number,
  width: number,
  height: number
): { nodes: { x: number; y: number; cluster: number }[]; edges: Edge[] } {
  const clusterCount = 4;
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const spread = Math.min(width, height) * 0.4;

  // Cluster centers — well separated, 4 quadrants
  const clusterCenters = [
    { x: centerX - spread * 0.6, y: centerY - spread * 0.55 },
    { x: centerX + spread * 0.65, y: centerY - spread * 0.5 },
    { x: centerX - spread * 0.55, y: centerY + spread * 0.6 },
    { x: centerX + spread * 0.6, y: centerY + spread * 0.55 },
  ];

  const nodes: { x: number; y: number; cluster: number }[] = [];

  for (let i = 0; i < count; i++) {
    const cluster = i % clusterCount;
    const center = clusterCenters[cluster];
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * spread * 0.25 + 8;
    nodes.push({
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
      cluster,
    });
  }

  // Create edges: intra-cluster (dense) and inter-cluster (sparse bridge nodes)
  const edges: Edge[] = [];
  const maxEdgeDist = spread * 0.35;
  const maxInterDist = spread * 0.6;

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (nodes[i].cluster === nodes[j].cluster && dist < maxEdgeDist) {
        if (Math.random() < 0.25 * (1 - dist / maxEdgeDist)) {
          edges.push({ from: i, to: j, delay: 0 });
        }
      } else if (
        nodes[i].cluster !== nodes[j].cluster &&
        dist < maxInterDist
      ) {
        if (Math.random() < 0.015) {
          edges.push({ from: i, to: j, delay: 0 });
        }
      }
    }
  }

  // Assign stagger delays: intra-cluster first (0–0.6), bridges later (0.5–1.0)
  // Shuffle within each group for organic feel
  const intra = edges.filter((e) => nodes[e.from].cluster === nodes[e.to].cluster);
  const bridge = edges.filter((e) => nodes[e.from].cluster !== nodes[e.to].cluster);

  // Shuffle
  for (let i = intra.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [intra[i], intra[j]] = [intra[j], intra[i]];
  }
  for (let i = bridge.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bridge[i], bridge[j]] = [bridge[j], bridge[i]];
  }

  intra.forEach((e, i) => { e.delay = (i / Math.max(1, intra.length - 1)) * 0.6; });
  bridge.forEach((e, i) => { e.delay = 0.5 + (i / Math.max(1, bridge.length - 1)) * 0.5; });

  return { nodes, edges };
}

export default function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const reducedMotion = useRef(false);

  // Timing — pause, then form graph, then edges stagger in
  const FLOAT_DURATION = 1000; // 1s pause with floating particles
  const TRANSITION_DURATION = 3500; // ms to settle into graph positions
  const EDGE_STAGGER_START = FLOAT_DURATION + 800; // edges start after settle begins
  const EDGE_STAGGER_TOTAL = 8000; // ms for all edges to finish appearing

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rectW = 0;
    let rectH = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      rectW = rect.width;
      rectH = rect.height;
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    // Init
    const rect = canvas.getBoundingClientRect();
    rectW = rect.width;
    rectH = rect.height;
    const count = Math.min(90, Math.floor((rectW * rectH) / 6000));

    const layout = generateGraphLayout(count, rectW, rectH);
    edgesRef.current = layout.edges;

    nodesRef.current = layout.nodes.map((n) => ({
      x: Math.random() * rectW,
      y: Math.random() * rectH,
      targetX: n.x,
      targetY: n.y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      color: CLUSTER_COLORS[n.cluster],
      radius: 2.5 + Math.random() * 3,
      targetRadius: 3 + Math.random() * 3.5,
      opacity: 0.15 + Math.random() * 0.45,
      targetOpacity: 0.5 + Math.random() * 0.4,
      cluster: n.cluster,
    }));

    startTimeRef.current = performance.now();

    function easeInOutCubic(t: number): number {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, rectW, rectH);

      const elapsed = now - startTimeRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Phase progress: 0 = floating, 1 = fully settled
      const transitionProgress =
        elapsed < FLOAT_DURATION
          ? 0
          : Math.min(
              1,
              (elapsed - FLOAT_DURATION) / TRANSITION_DURATION
            );
      const eased = easeInOutCubic(transitionProgress);

      // Draw edges — staggered and color-coded
      const edgeElapsed = elapsed - EDGE_STAGGER_START;
      for (const edge of edges) {
        // Each edge has its own start time based on delay
        const edgeStart = edge.delay * EDGE_STAGGER_TOTAL;
        const edgeFadeDur = 1500; // each individual edge fades in over 1500ms
        const edgeT = edgeElapsed - edgeStart;
        if (edgeT <= 0) continue;

        const edgeProgress = Math.min(1, edgeT / edgeFadeDur);
        const edgeAlpha = easeInOutCubic(edgeProgress);

        const a = nodes[edge.from];
        const b = nodes[edge.to];
        const isBridge = a.cluster !== b.cluster;
        const maxAlpha = isBridge ? 0.1 : 0.18;
        const alpha = edgeAlpha * maxAlpha;

        let edgeColor: string;
        if (!isBridge) {
          const rgb = hexToRgb(a.color);
          edgeColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        } else {
          const rgbA = hexToRgb(a.color);
          const rgbB = hexToRgb(b.color);
          edgeColor = `rgba(${(rgbA.r + rgbB.r) >> 1}, ${(rgbA.g + rgbB.g) >> 1}, ${(rgbA.b + rgbB.b) >> 1}, ${alpha})`;
        }

        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.strokeStyle = edgeColor;
        ctx!.lineWidth = isBridge ? 0.6 : 0.8;
        ctx!.stroke();
      }

      // Track overall edge progress for glow effect
      const edgeEased = Math.min(1, Math.max(0, edgeElapsed / (EDGE_STAGGER_TOTAL + 800)));

      // During float phase, also draw proximity lines (like before) that fade out
      if (transitionProgress < 1) {
        const proxAlpha = 1 - eased;
        if (proxAlpha > 0.01) {
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              const dx = nodes[i].x - nodes[j].x;
              const dy = nodes[i].y - nodes[j].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 80) {
                const al = (1 - dist / 80) * 0.06 * proxAlpha;
                const rgb = hexToRgb(nodes[i].color);
                ctx!.beginPath();
                ctx!.moveTo(nodes[i].x, nodes[i].y);
                ctx!.lineTo(nodes[j].x, nodes[j].y);
                ctx!.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${al})`;
                ctx!.lineWidth = 0.5;
                ctx!.stroke();
              }
            }
          }
        }
      }

      // Update and draw nodes
      for (const p of nodes) {
        if (!reducedMotion.current) {
          if (transitionProgress < 1) {
            // Blend between free float and target position
            const floatX = p.x + p.vx;
            const floatY = p.y + p.vy;

            p.x = floatX + (p.targetX - floatX) * eased;
            p.y = floatY + (p.targetY - floatY) * eased;

            // Keep velocity for float phase
            if (p.x < 0 || p.x > rectW) p.vx *= -1;
            if (p.y < 0 || p.y > rectH) p.vy *= -1;

            // Dampen velocity as we settle
            p.vx *= 1 - eased * 0.03;
            p.vy *= 1 - eased * 0.03;
          } else {
            // Settled: gentle breathing motion
            const breathX =
              Math.sin(now * 0.0008 + p.targetX * 0.01) * 1.5;
            const breathY =
              Math.cos(now * 0.0006 + p.targetY * 0.01) * 1.5;
            p.x = p.targetX + breathX;
            p.y = p.targetY + breathY;
          }

          // Drift opacity and radius toward targets
          p.opacity += (p.targetOpacity - p.opacity) * 0.02;
          p.radius += (p.targetRadius - p.radius) * 0.02;
        }

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.opacity;
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      // Draw subtle glow on larger hub nodes (top 8 by edge count) once settled
      if (edgeEased > 0.5) {
        const glowAlpha = (edgeEased - 0.5) * 2; // 0→1 over second half
        const edgeCounts = new Array(nodes.length).fill(0);
        for (const e of edges) {
          edgeCounts[e.from]++;
          edgeCounts[e.to]++;
        }
        const threshold =
          [...edgeCounts].sort((a, b) => b - a)[
            Math.min(7, nodes.length - 1)
          ] || 1;

        for (let i = 0; i < nodes.length; i++) {
          if (edgeCounts[i] >= threshold && threshold > 1) {
            const p = nodes[i];
            const grad = ctx!.createRadialGradient(
              p.x,
              p.y,
              p.radius,
              p.x,
              p.y,
              p.radius * 4
            );
            grad.addColorStop(0, p.color);
            grad.addColorStop(1, "transparent");
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
            ctx!.fillStyle = grad;
            ctx!.globalAlpha = 0.08 * glowAlpha * p.opacity;
            ctx!.fill();
            ctx!.globalAlpha = 1;
          }
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    if (reducedMotion.current) {
      // Jump straight to settled state
      startTimeRef.current =
        performance.now() -
        (FLOAT_DURATION + TRANSITION_DURATION + EDGE_STAGGER_TOTAL + 1000);
      draw(performance.now());
      cancelAnimationFrame(animationRef.current);
    } else {
      animationRef.current = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
