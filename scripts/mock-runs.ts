import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runSimulation } from "../lib/simulation/engine";
import { scoreAggression } from "../lib/simulation/scoring";
import type { Persona } from "../lib/schemas";
import type { AgentMessage } from "../lib/simulation/types";

interface MockSpec {
  slug: string;
  audience_file: string;
  audience_id: string;
  audience_name: string;
  platform: "twitter" | "reddit" | "slack";
  input: string;
  persona_cap: number;
}

const SPECS: MockSpec[] = [
  {
    slug: "home",
    audience_file: "genz.json",
    audience_id: "genz",
    audience_name: "Gen Z",
    platform: "twitter",
    input: "We're launching a free tier for all new users starting next week.",
    persona_cap: 60,
  },
  {
    slug: "founder",
    audience_file: "engineers.json",
    audience_id: "engineers",
    audience_name: "Engineers",
    platform: "twitter",
    input: "we just shipped v2 — bigger context, faster, $19/mo from today",
    persona_cap: 60,
  },
  {
    slug: "vc",
    audience_file: "engineers.json",
    audience_id: "engineers",
    audience_name: "Engineers",
    platform: "twitter",
    input:
      "Tough decision today — we're restructuring and reducing the team by 12% to extend runway.",
    persona_cap: 60,
  },
  {
    slug: "pm",
    audience_file: "engineers.json",
    audience_id: "engineers",
    audience_name: "Engineers",
    platform: "twitter",
    input:
      "Introducing our new pricing — Pro is now $39/mo, with the legacy plan grandfathered for 12 months.",
    persona_cap: 60,
  },
  {
    slug: "alignment",
    audience_file: "engineers.json",
    audience_id: "engineers",
    audience_name: "Engineers",
    platform: "reddit",
    input:
      "A new study finds that exposure to AI-generated content reduces trust in human-written news by 23%.",
    persona_cap: 60,
  },
  {
    slug: "comms",
    audience_file: "company_internal.json",
    audience_id: "company_internal",
    audience_name: "Company Internal",
    platform: "slack",
    input:
      "Team — starting June, we're moving back to 5 days in-office. Details and FAQ in the doc below.",
    persona_cap: 60,
  },
];

function loadPersonas(file: string, cap: number): Persona[] {
  const path = join(process.cwd(), "train", file);
  const all = JSON.parse(readFileSync(path, "utf-8")) as Persona[];
  return all.slice(0, cap);
}

async function generate() {
  const outDir = join(process.cwd(), "public", "mocked-runs");
  mkdirSync(outDir, { recursive: true });

  const filter = process.argv.slice(2);
  const specs = filter.length > 0 ? SPECS.filter((s) => filter.includes(s.slug)) : SPECS;
  if (filter.length > 0 && specs.length === 0) {
    console.error(`No specs matched filter: ${filter.join(", ")}`);
    console.error(`Known slugs: ${SPECS.map((s) => s.slug).join(", ")}`);
    process.exit(1);
  }

  for (const spec of specs) {
    console.log(`→ Generating mock for /${spec.slug} (${spec.audience_id} on ${spec.platform})…`);
    const personas = loadPersonas(spec.audience_file, spec.persona_cap);
    const messages: AgentMessage[] = [];
    const start = Date.now();

    try {
      for await (const message of runSimulation(
        personas,
        spec.audience_id,
        spec.platform,
        spec.input
      )) {
        messages.push(message);
      }
    } catch (err) {
      console.error(`Failed to generate ${spec.slug}:`, err);
      throw err;
    }

    const elapsedMs = Date.now() - start;
    const aggression = scoreAggression(messages);

    const payload = {
      slug: spec.slug,
      audience_id: spec.audience_id,
      audience_name: spec.audience_name,
      platform: spec.platform,
      input: spec.input,
      persona_cap: spec.persona_cap,
      aggression_score: aggression,
      thread: messages,
      generated_at: new Date().toISOString(),
      generated_in_ms: elapsedMs,
    };

    const filePath = join(outDir, `${spec.slug}.json`);
    writeFileSync(filePath, JSON.stringify(payload, null, 2));
    console.log(
      `   ✓ ${messages.length} messages, aggression=${aggression}, ${(elapsedMs / 1000).toFixed(1)}s → ${filePath}`
    );
  }

  console.log("\nAll mocks generated.");
}

generate().catch((err) => {
  console.error("Mock generation failed:", err);
  process.exit(1);
});
