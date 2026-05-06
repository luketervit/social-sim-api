import "server-only";
import type { Persona } from "@/lib/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OPERATOR_EMAIL = "luke@atharias.dev";

const FAMILY_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "Founders & Executives",
    pattern:
      /\b(founder|co-founder|ceo|cto|cmo|cfo|coo|cpo|chief|president|owner|managing partner|partner|executive)\b/i,
  },
  {
    label: "AI, Research & Data",
    pattern:
      /\b(ai|ml|machine learning|research|researcher|scientist|data science|data scientist|applied scientist|inference|alignment|llm)\b/i,
  },
  {
    label: "Engineering & Infra",
    pattern:
      /\b(engineer|engineering|developer|software|full stack|frontend|backend|platform|infra|infrastructure|devops|sre|architect)\b/i,
  },
  {
    label: "Product & Strategy",
    pattern:
      /\b(product|pm\b|product manager|program manager|strategy|strategic|chief of staff)\b/i,
  },
  {
    label: "Design & Creative",
    pattern:
      /\b(design|designer|ux|ui|brand designer|illustrator|creative|writer|editor)\b/i,
  },
  {
    label: "Go-To-Market",
    pattern:
      /\b(marketing|growth|sales|revenue|account executive|customer success|business development|comms|communications|pr|community|content)\b/i,
  },
  {
    label: "Operations & G&A",
    pattern:
      /\b(operations|finance|accounting|legal|compliance|hr|people|talent|recruiting|ops|procurement)\b/i,
  },
  {
    label: "Investors & Advisors",
    pattern:
      /\b(investor|venture|vc\b|advisor|adviser|board|analyst|associate)\b/i,
  },
];

const SENIORITY_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "Executive",
    pattern:
      /\b(founder|co-founder|ceo|cto|cmo|cfo|coo|cpo|chief|president|owner|managing partner|partner)\b/i,
  },
  { label: "VP", pattern: /\b(vp|vice president|svp|evp)\b/i },
  { label: "Director", pattern: /\b(director|head of)\b/i },
  { label: "Manager", pattern: /\b(manager|lead|principal|staff)\b/i },
  { label: "Senior IC", pattern: /\b(senior|sr\.?)\b/i },
  {
    label: "Junior IC",
    pattern:
      /\b(junior|jr\.?|intern|trainee|graduate|entry[- ]level|associate)\b/i,
  },
];

interface AudienceInsightRow {
  id: string;
  name: string;
  platform: string | null;
  row_count: number | null;
  created_at: string;
  personas: Persona[];
}

interface PersonaRow {
  audienceId: string;
  audienceName: string;
  platform: string;
  persona: Persona;
}

export interface OperatorPersonaInsights {
  ownerEmail: string;
  generatedAt: string;
  personas: Array<{
    id: string;
    audienceId: string;
    audienceName: string;
    platform: string;
    archetype: string;
    family: string;
    seniority: string;
    coreValues: string[];
    reactivity: number;
    sophistication: number;
    affinity: number;
  }>;
  filterOptions: {
    audiences: Array<{ id: string; name: string; count: number; platform: string }>;
    platforms: string[];
    families: string[];
    seniority: string[];
    values: string[];
  };
  totals: {
    audiences: number;
    personas: number;
    archetypes: number;
    valueTags: number;
  };
  families: Array<{
    label: string;
    count: number;
    share: number;
    avgReactivity: number;
    avgSophistication: number;
    avgAffinity: number;
    topValues: string[];
  }>;
  seniority: Array<{
    label: string;
    count: number;
    share: number;
  }>;
  topArchetypes: Array<{
    label: string;
    count: number;
    share: number;
  }>;
  topValues: Array<{
    label: string;
    count: number;
    share: number;
  }>;
  reactivityBuckets: BucketDatum[];
  sophisticationBuckets: BucketDatum[];
  affinityBuckets: BucketDatum[];
  segments: Array<{
    label: string;
    family: string;
    seniority: string;
    count: number;
    share: number;
    avgReactivity: number;
    avgSophistication: number;
    avgAffinity: number;
    topArchetypes: string[];
  }>;
  audiences: Array<{
    id: string;
    name: string;
    platform: string;
    count: number;
    topFamily: string;
    avgReactivity: number;
    avgSophistication: number;
    avgAffinity: number;
  }>;
}

interface BucketDatum {
  label: string;
  count: number;
  share: number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function share(count: number, total: number): number {
  if (total === 0) return 0;
  return count / total;
}

function labelFromPersona(persona: Persona): string {
  return `${persona.archetype} ${persona.core_values.join(" ")}`.trim();
}

function classifyFamily(persona: Persona): string {
  const text = labelFromPersona(persona);
  for (const rule of FAMILY_RULES) {
    if (rule.pattern.test(text)) return rule.label;
  }
  return "Other";
}

function classifySeniority(persona: Persona): string {
  const text = labelFromPersona(persona);
  for (const rule of SENIORITY_RULES) {
    if (rule.pattern.test(text)) return rule.label;
  }
  return "Unspecified";
}

function increment(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function sortCounts(map: Map<string, number>) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function bucketScore(
  value: number,
  buckets: Array<{ label: string; match: (value: number) => boolean }>
): string {
  const bucket = buckets.find((entry) => entry.match(value));
  return bucket?.label ?? buckets[buckets.length - 1]!.label;
}

function buildBuckets(values: number[], labels: Array<{ label: string; match: (value: number) => boolean }>): BucketDatum[] {
  const total = values.length;
  const counts = new Map<string, number>();
  for (const spec of labels) counts.set(spec.label, 0);
  for (const value of values) {
    const label = bucketScore(value, labels);
    increment(counts, label);
  }
  return labels.map((spec) => ({
    label: spec.label,
    count: counts.get(spec.label) ?? 0,
    share: share(counts.get(spec.label) ?? 0, total),
  }));
}

export function canAccessOperatorPersonaInsights(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === OPERATOR_EMAIL;
}

export async function loadOperatorPersonaInsights(): Promise<OperatorPersonaInsights> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .select("id, name, platform, row_count, created_at, personas")
    .eq("source", "uploaded")
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const audiences = ((data ?? []) as AudienceInsightRow[]).map((row) => ({
    ...row,
    personas: Array.isArray(row.personas) ? row.personas : [],
  }));

  const personaRows: PersonaRow[] = audiences.flatMap((audience) =>
    audience.personas.map((persona) => ({
      audienceId: audience.id,
      audienceName: audience.name,
      platform: audience.platform ?? "unknown",
      persona,
    }))
  );

  const totalPersonas = personaRows.length;
  const archetypeCounts = new Map<string, number>();
  const valueCounts = new Map<string, number>();
  const familyMap = new Map<
    string,
    {
      count: number;
      reactivity: number[];
      sophistication: number[];
      affinity: number[];
      values: Map<string, number>;
    }
  >();
  const seniorityCounts = new Map<string, number>();
  const segmentMap = new Map<
    string,
    {
      family: string;
      seniority: string;
      count: number;
      reactivity: number[];
      sophistication: number[];
      affinity: number[];
      archetypes: Map<string, number>;
    }
  >();
  const audienceMap = new Map<
    string,
    {
      name: string;
      platform: string;
      count: number;
      familyCounts: Map<string, number>;
      reactivity: number[];
      sophistication: number[];
      affinity: number[];
    }
  >();

  for (const row of personaRows) {
    const { persona } = row;
    const archetype = persona.archetype.trim() || "Unlabelled";
    increment(archetypeCounts, archetype);

    for (const value of persona.core_values) {
      const normalized = value.trim().toLowerCase();
      if (!normalized || normalized === "position") continue;
      increment(valueCounts, normalized);
    }

    const family = classifyFamily(persona);
    const seniority = classifySeniority(persona);
    increment(seniorityCounts, seniority);

    if (!familyMap.has(family)) {
      familyMap.set(family, {
        count: 0,
        reactivity: [],
        sophistication: [],
        affinity: [],
        values: new Map<string, number>(),
      });
    }
    const familyEntry = familyMap.get(family)!;
    familyEntry.count += 1;
    familyEntry.reactivity.push(persona.reactivity_baseline);
    familyEntry.sophistication.push(persona.sophistication);
    familyEntry.affinity.push(persona.brand_affinity);
    for (const value of persona.core_values) {
      const normalized = value.trim().toLowerCase();
      if (!normalized || normalized === "position") continue;
      increment(familyEntry.values, normalized);
    }

    const segmentLabel = `${family} · ${seniority}`;
    if (!segmentMap.has(segmentLabel)) {
      segmentMap.set(segmentLabel, {
        family,
        seniority,
        count: 0,
        reactivity: [],
        sophistication: [],
        affinity: [],
        archetypes: new Map<string, number>(),
      });
    }
    const segment = segmentMap.get(segmentLabel)!;
    segment.count += 1;
    segment.reactivity.push(persona.reactivity_baseline);
    segment.sophistication.push(persona.sophistication);
    segment.affinity.push(persona.brand_affinity);
    increment(segment.archetypes, archetype);

    if (!audienceMap.has(row.audienceId)) {
      audienceMap.set(row.audienceId, {
        name: row.audienceName,
        platform: row.platform,
        count: 0,
        familyCounts: new Map<string, number>(),
        reactivity: [],
        sophistication: [],
        affinity: [],
      });
    }
    const audienceEntry = audienceMap.get(row.audienceId)!;
    audienceEntry.count += 1;
    increment(audienceEntry.familyCounts, family);
    audienceEntry.reactivity.push(persona.reactivity_baseline);
    audienceEntry.sophistication.push(persona.sophistication);
    audienceEntry.affinity.push(persona.brand_affinity);
  }

  const families = sortCounts(new Map(Array.from(familyMap.entries()).map(([label, value]) => [label, value.count])))
    .map(([label, count]) => {
      const entry = familyMap.get(label)!;
      return {
        label,
        count,
        share: share(count, totalPersonas),
        avgReactivity: round(average(entry.reactivity)),
        avgSophistication: round(average(entry.sophistication)),
        avgAffinity: round(average(entry.affinity)),
        topValues: sortCounts(entry.values)
          .slice(0, 3)
          .map(([value]) => value),
      };
    });

  const seniorityOrder = ["Executive", "VP", "Director", "Manager", "Senior IC", "Junior IC", "Unspecified"];
  const seniority = seniorityOrder
    .map((label) => ({
      label,
      count: seniorityCounts.get(label) ?? 0,
      share: share(seniorityCounts.get(label) ?? 0, totalPersonas),
    }))
    .filter((entry) => entry.count > 0);

  const topArchetypes = sortCounts(archetypeCounts)
    .slice(0, 16)
    .map(([label, count]) => ({
      label,
      count,
      share: share(count, totalPersonas),
    }));

  const topValues = sortCounts(valueCounts)
    .slice(0, 20)
    .map(([label, count]) => ({
      label,
      count,
      share: share(count, totalPersonas),
    }));

  const reactivityBuckets = buildBuckets(
    personaRows.map((row) => row.persona.reactivity_baseline),
    [
      { label: "Quiet", match: (value) => value < 0.25 },
      { label: "Low", match: (value) => value >= 0.25 && value < 0.45 },
      { label: "Medium", match: (value) => value >= 0.45 && value < 0.65 },
      { label: "High", match: (value) => value >= 0.65 && value < 0.8 },
      { label: "Volatile", match: (value) => value >= 0.8 },
    ]
  );

  const sophisticationBuckets = buildBuckets(
    personaRows.map((row) => row.persona.sophistication),
    [
      { label: "Plainspoken", match: (value) => value < 0.35 },
      { label: "Practical", match: (value) => value >= 0.35 && value < 0.55 },
      { label: "Fluent", match: (value) => value >= 0.55 && value < 0.7 },
      { label: "Strategic", match: (value) => value >= 0.7 && value < 0.85 },
      { label: "Elite", match: (value) => value >= 0.85 },
    ]
  );

  const affinityBuckets = buildBuckets(
    personaRows.map((row) => row.persona.brand_affinity),
    [
      { label: "Strongly skeptical", match: (value) => value < -0.45 },
      { label: "Cool", match: (value) => value >= -0.45 && value < -0.1 },
      { label: "Neutral", match: (value) => value >= -0.1 && value < 0.15 },
      { label: "Warm", match: (value) => value >= 0.15 && value < 0.45 },
      { label: "Advocates", match: (value) => value >= 0.45 },
    ]
  );

  const segments = Array.from(segmentMap.entries())
    .map(([label, entry]) => ({
      label,
      family: entry.family,
      seniority: entry.seniority,
      count: entry.count,
      share: share(entry.count, totalPersonas),
      avgReactivity: round(average(entry.reactivity)),
      avgSophistication: round(average(entry.sophistication)),
      avgAffinity: round(average(entry.affinity)),
      topArchetypes: sortCounts(entry.archetypes)
        .slice(0, 3)
        .map(([archetype]) => archetype),
      score:
        entry.count *
        (average(entry.reactivity) * 0.45 +
          average(entry.sophistication) * 0.35 +
          ((1 - average(entry.affinity)) / 2) * 0.2),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ score: _score, ...segment }) => segment);

  const audienceInsights = Array.from(audienceMap.entries())
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      platform: entry.platform,
      count: entry.count,
      topFamily: sortCounts(entry.familyCounts)[0]?.[0] ?? "Other",
      avgReactivity: round(average(entry.reactivity)),
      avgSophistication: round(average(entry.sophistication)),
      avgAffinity: round(average(entry.affinity)),
    }))
    .sort((a, b) => b.count - a.count);

  const exportedPersonas = personaRows.map((row) => {
    const family = classifyFamily(row.persona);
    const seniority = classifySeniority(row.persona);
    return {
      id: row.persona.id,
      audienceId: row.audienceId,
      audienceName: row.audienceName,
      platform: row.platform,
      archetype: row.persona.archetype.trim() || "Unlabelled",
      family,
      seniority,
      coreValues: row.persona.core_values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0 && value !== "position"),
      reactivity: round(row.persona.reactivity_baseline),
      sophistication: round(row.persona.sophistication),
      affinity: round(row.persona.brand_affinity),
    };
  });

  return {
    ownerEmail: OPERATOR_EMAIL,
    generatedAt: new Date().toISOString(),
    personas: exportedPersonas,
    filterOptions: {
      audiences: audienceInsights.map((audience) => ({
        id: audience.id,
        name: audience.name,
        count: audience.count,
        platform: audience.platform,
      })),
      platforms: Array.from(
        new Set(exportedPersonas.map((persona) => persona.platform))
      ).sort(),
      families: families.map((family) => family.label),
      seniority: seniority.map((entry) => entry.label),
      values: topValues.map((entry) => entry.label),
    },
    totals: {
      audiences: audiences.length,
      personas: totalPersonas,
      archetypes: archetypeCounts.size,
      valueTags: valueCounts.size,
    },
    families,
    seniority,
    topArchetypes,
    topValues,
    reactivityBuckets,
    sophisticationBuckets,
    affinityBuckets,
    segments,
    audiences: audienceInsights,
  };
}
