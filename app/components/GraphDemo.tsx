"use client";

import SimulationGraph from "@/components/SimulationGraph";
import type { AgentMessage } from "@/lib/simulation/types";

/* ─── Synthetic demo data ─── */
const ARCHETYPES = [
  "The Grumpy Architect",
  "Eternal Optimist",
  "Devil's Advocate",
  "Silent Lurker",
  "Brand Loyalist",
  "Cynical Realist",
  "Hype Beast",
  "Troll King",
  "Community Elder",
  "Fresh Recruit",
  "Data Nerd",
  "Hot Take Machine",
];

const SENTIMENTS: AgentMessage["sentiment"][] = [
  "hostile",
  "negative",
  "neutral",
  "positive",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateDemoThread(): AgentMessage[] {
  const rand = seededRandom(42);
  const thread: AgentMessage[] = [];
  const totalRounds = 8;
  const agentCount = ARCHETYPES.length;

  for (let round = 1; round <= totalRounds; round++) {
    // Each round has 4–8 participants
    const participantCount = 4 + Math.floor(rand() * 5);
    const picked = new Set<number>();
    while (picked.size < participantCount) {
      picked.add(Math.floor(rand() * agentCount));
    }

    for (const idx of picked) {
      // Bias sentiment distribution: earlier rounds more positive, later more hostile
      const hostileBias = round / totalRounds;
      const r = rand();
      let sentiment: AgentMessage["sentiment"];
      if (r < 0.1 + hostileBias * 0.25) sentiment = "hostile";
      else if (r < 0.3 + hostileBias * 0.15) sentiment = "negative";
      else if (r < 0.65) sentiment = "neutral";
      else sentiment = "positive";

      thread.push({
        round,
        agent_id: `agent_${String(idx).padStart(3, "0")}`,
        archetype: ARCHETYPES[idx],
        message: "",
        sentiment,
        reply_to: null,
        timestamp: new Date(
          Date.now() - (totalRounds - round) * 60_000
        ).toISOString(),
      });
    }
  }

  return thread;
}

const DEMO_THREAD = generateDemoThread();

export default function GraphDemo() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span className="mono-label">DISCOURSE_TOPOLOGY</span>
          <h2
            style={{
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: "var(--text-primary)",
              marginTop: 12,
            }}
          >
            Watch sentiment cascade through your audience
          </h2>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--text-secondary)",
              marginTop: 12,
              maxWidth: 540,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Every node is a synthetic agent. Edges form when agents
            interact in the same round. Watch how hostile sentiment
            clusters and spreads.
          </p>
        </div>

        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <SimulationGraph
            thread={DEMO_THREAD}
            height={380}
            autoPlay
            playbackSpeed={2200}
            compact
          />
        </div>
      </div>
    </section>
  );
}
