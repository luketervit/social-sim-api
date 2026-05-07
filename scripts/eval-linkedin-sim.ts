import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runSimulation } from "@/lib/simulation/engine";
import { scoreLinkedInDraftForAudience } from "@/lib/simulation/linkedinSignals";
import { computeSimulationMetrics } from "@/lib/simulation/scoring";
import type { Persona } from "@/lib/schemas";
import type { AgentMessage } from "@/lib/simulation/types";

interface FixtureFile {
  personas: Persona[];
}

interface Scenario {
  id: string;
  expectation: string;
  minimumMargin: number;
  better: string;
  worse: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "specificity-over-bait",
    expectation: "specific, operator-grade posts should beat generic engagement bait",
    minimumMargin: 0.08,
    better: `Spent the last 60 days rewriting our LinkedIn posting process for a B2B SaaS founder account.

The biggest change was not "post more."
It was narrowing the topic surface from 9 themes to 3 and writing every post for one buyer-adjacent micro-audience.

Average saves per post doubled.
Comments got shorter, but they came from exactly the operators we wanted.

The surprising part: broad inspirational posts still got likes, but the specific ones drove profile visits and useful conversations.`,
    worse: `3 lessons every founder needs to hear about LinkedIn:

1. Show up
2. Be authentic
3. Stay consistent

Agree?
Comment "guide" and I'll DM the framework.`,
  },
  {
    id: "personal-surface-over-company-broadcast",
    expectation: "personal, experience-backed posts should beat company-broadcast copy",
    minimumMargin: 0.08,
    better: `One thing I got wrong about founder-led LinkedIn:

I assumed our company page should carry the strategy narrative.

It didn't.
The posts that actually reached growth leaders were the ones written from lived operating detail: what we tried, what failed, and what changed.

Company updates still matter. But for organic reach, personal credibility carries farther than polished announcement copy.`,
    worse: `We're excited to announce our new LinkedIn content framework for modern B2B teams.

This innovative solution helps brands unlock reach, authenticity, and consistent engagement at scale.

Learn more here: https://example.com/framework`,
  },
  {
    id: "niche-relevance-over-generic-ai",
    expectation: "niche professional relevance should beat broad AI hype",
    minimumMargin: 0.07,
    better: `If you're selling to RevOps leaders, stop writing LinkedIn posts like you're pitching marketers.

RevOps people save posts that clarify handoffs, forecast risk, and conversion friction.
They do not care that your workflow is "AI-native."

Same product.
Different language.
Completely different comment section.`,
    worse: `AI is changing everything.

The winners will adapt.
The losers will complain.

Now is the time to build, lead, and innovate.`,
  },
];

async function loadFixture(): Promise<Persona[]> {
  const fixturePath = resolve(process.cwd(), "train/linkedin_b2b.json");
  const raw = await readFile(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as FixtureFile;
  return parsed.personas;
}

function fmt(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return value.toFixed(3);
}

async function runFullSimulation(personas: Persona[], input: string) {
  const messages: AgentMessage[] = [];
  for await (const message of runSimulation(
    personas.slice(0, 8),
    "eval-linkedin",
    "linkedin",
    input
  )) {
    messages.push(message);
  }
  return computeSimulationMetrics(messages, "linkedin");
}

async function main() {
  const personas = await loadFixture();
  const live = process.argv.includes("--live");
  let failed = false;

  console.log(`LinkedIn latent evals on ${personas.length} fixture personas\n`);

  for (const scenario of SCENARIOS) {
    const better = scoreLinkedInDraftForAudience(personas, scenario.better);
    const worse = scoreLinkedInDraftForAudience(personas, scenario.worse);
    const margin = better.qualified_engagement - worse.qualified_engagement;
    const pass = margin >= scenario.minimumMargin;
    if (!pass) failed = true;

    console.log(`${pass ? "PASS" : "FAIL"} ${scenario.id}`);
    console.log(`  expectation: ${scenario.expectation}`);
    console.log(`  better qes=${fmt(better.qualified_engagement)} relevance=${fmt(better.avg_relevance)} save=${fmt(better.avg_save_intent)} trust=${fmt(better.avg_trust)}`);
    console.log(`  worse  qes=${fmt(worse.qualified_engagement)} relevance=${fmt(worse.avg_relevance)} save=${fmt(worse.avg_save_intent)} trust=${fmt(worse.avg_trust)}`);
    console.log(`  margin=${fmt(margin)} threshold=${scenario.minimumMargin.toFixed(3)}\n`);

    if (live) {
      const [betterLive, worseLive] = await Promise.all([
        runFullSimulation(personas, scenario.better),
        runFullSimulation(personas, scenario.worse),
      ]);
      const liveMargin =
        (betterLive.qualified_engagement_score ?? 0) -
        (worseLive.qualified_engagement_score ?? 0);

      console.log(`  live better qes=${fmt(betterLive.qualified_engagement_score)} comments=${betterLive.message_count}`);
      console.log(`  live worse  qes=${fmt(worseLive.qualified_engagement_score)} comments=${worseLive.message_count}`);
      console.log(`  live margin=${fmt(liveMargin)}\n`);
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log("All latent LinkedIn evals passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
