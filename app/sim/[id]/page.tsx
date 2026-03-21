import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import SimulationGraph from "@/components/SimulationGraph";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { AgentMessage } from "@/lib/simulation/types";
import { buildResolvedThread } from "@/lib/simulation/threading";
import PreviewPublishButton from "./publish-button";
import SimulationThread from "./thread";
import ViewTracker from "./view-tracker";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getPublicSimulation(id: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("simulations")
    .select(
      "id, api_key, audience_id, persona_cap, platform, input, thread, aggression_score, title, summary, shared_at, progress_messages, created_at, completed_at, public"
    )
    .eq("id", id)
    .eq("public", true)
    .single();

  if (error || !data) return null;
  return { ...data, isPreview: false };
}

async function getOwnedSimulation(id: string, userId: string) {
  const db = supabaseAdmin();

  // Look up all API keys owned by this user
  const { data: keys } = await db
    .from("api_keys")
    .select("key")
    .eq("user_id", userId);

  if (!keys || keys.length === 0) return null;

  const { data, error } = await db
    .from("simulations")
    .select(
      "id, api_key, audience_id, persona_cap, platform, input, thread, aggression_score, title, summary, shared_at, progress_messages, created_at, completed_at, public"
    )
    .eq("id", id)
    .in("api_key", keys.map((k) => k.key))
    .single();

  if (error || !data) return null;
  return { ...data, isPreview: !data.public };
}

async function getBaseUrl() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (!host) {
    return "http://localhost:3000";
  }

  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

function buildTwitterIntentUrl(title: string, summary: string, url: string) {
  const text = `${title} - ${summary}`;
  const params = new URLSearchParams({
    text,
    url,
  });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const sim = await getPublicSimulation(id);

  if (!sim) {
    return { title: "Simulation Not Found - Atharias" };
  }

  const baseUrl = await getBaseUrl();
  const title = sim.title ?? "Public Simulation";
  const description = sim.summary ?? "An AI-powered social discourse simulation.";
  const imageUrl = `${baseUrl}/sim/${id}/opengraph-image`;

  return {
    title: `${title} - Atharias`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "Atharias",
      url: `${baseUrl}/sim/${id}`,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

const SENTIMENT_COLORS: Record<string, string> = {
  hostile: "#ef4444",
  negative: "#f97316",
  neutral: "#a1a1aa",
  positive: "#22c55e",
};

const SENTIMENT_LABELS: Record<string, string> = {
  hostile: "Hostile",
  negative: "Negative",
  neutral: "Neutral",
  positive: "Positive",
};

const AGGRESSION_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function SimulationPage({ params }: PageProps) {
  const { id } = await params;

  // Try public first, then fall back to owner preview
  let sim = await getPublicSimulation(id);

  if (!sim) {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      sim = await getOwnedSimulation(id, user.id);
    }
  }

  if (!sim) {
    notFound();
  }

  const isPreview = sim.isPreview;
  const baseUrl = await getBaseUrl();
  const thread = (sim.thread ?? []) as AgentMessage[];
  const sentimentCounts = {
    hostile: thread.filter((message) => message.sentiment === "hostile").length,
    negative: thread.filter((message) => message.sentiment === "negative").length,
    neutral: thread.filter((message) => message.sentiment === "neutral").length,
    positive: thread.filter((message) => message.sentiment === "positive").length,
  };
  const totalMessages = thread.length;
  const rounds = new Set(thread.map((message) => message.round)).size;
  const resolvedThread = buildResolvedThread(thread);
  const maxDepth = resolvedThread.ordered.reduce((max, message) => Math.max(max, message.depth), 0);
  const rootPosts = resolvedThread.roots.length;
  const title = sim.title ?? "Simulation Preview";
  const summary = sim.summary ?? "Inspect the full thread and how the audience reacted.";
  const shareUrl = `${baseUrl}/sim/${id}`;
  const twitterIntentUrl = buildTwitterIntentUrl(title, summary, shareUrl);

  return (
    <div className="mx-auto max-w-[760px] px-6 pt-12 pb-24">
      {!isPreview && <ViewTracker simulationId={sim.id} />}

      {isPreview && (
        <div
          className="mb-6 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3"
          style={{
            background: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.25)",
          }}
        >
          <p style={{ fontSize: 13, color: "#eab308" }}>
            Preview — only you can see this. Share to make it public.
          </p>
          <div className="flex items-center gap-2">
            <PreviewPublishButton
              simulation={{
                id: sim.id,
                audience_id: sim.audience_id,
                platform: sim.platform,
                input: sim.input,
                status: "completed",
                aggression_score: sim.aggression_score,
                public: sim.public,
                title: sim.title,
                summary: sim.summary,
                shared_at: sim.shared_at,
                progress_messages: sim.progress_messages,
                created_at: sim.created_at,
                completed_at: sim.completed_at,
              }}
            />
            <a
              href="/dashboard"
              className="btn-secondary"
              style={{ padding: "6px 12px", minHeight: "auto", fontSize: 12 }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      )}

      <div className="mono-label">SIMULATION_REPORT</div>
      <h1
        className="mt-4"
        style={{
          fontSize: "clamp(28px, 5vw, 40px)",
          fontWeight: 500,
          letterSpacing: "-0.04em",
          lineHeight: 1.05,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h1>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={twitterIntentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{ minHeight: "auto", padding: "10px 16px", fontSize: 13 }}
        >
          Share on X
        </a>
        <a
          href="/explore"
          className="btn-secondary"
          style={{ minHeight: "auto", padding: "10px 16px", fontSize: 13 }}
        >
          Browse Explore
        </a>
      </div>

      {sim.summary ? (
        <p
          className="mt-4"
          style={{
            fontSize: 15,
            lineHeight: 1.65,
            color: "var(--text-secondary)",
            maxWidth: 580,
          }}
        >
          {sim.summary}
        </p>
      ) : null}

      <div
        className="mt-6 flex flex-wrap gap-3"
        style={{ fontSize: 12, color: "var(--text-tertiary)" }}
      >
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
        >
          {sim.platform}
        </span>
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
        >
          {sim.audience_id.replace(/_/g, " ")}
        </span>
        {sim.persona_cap ? (
          <span
            className="rounded-full px-3 py-1"
            style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
          >
            {sim.persona_cap}-agent sample
          </span>
        ) : null}
        {sim.aggression_score ? (
          <span
            className="rounded-full px-3 py-1"
            style={{
              background: "var(--bg-element)",
              border: "1px solid var(--border)",
              color: AGGRESSION_COLORS[sim.aggression_score] ?? "var(--text-tertiary)",
            }}
          >
            {sim.aggression_score} aggression
          </span>
        ) : null}
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
        >
          {totalMessages} messages
        </span>
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
        >
          {rounds} rounds
        </span>
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
        >
          depth {maxDepth}
        </span>
        <span
          className="rounded-full px-3 py-1"
          style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
        >
          {rootPosts} root posts
        </span>
        {sim.shared_at ? (
          <span
            className="rounded-full px-3 py-1"
            style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
          >
            {formatDate(sim.shared_at)}
          </span>
        ) : null}
      </div>

      <div
        className="mt-6 rounded-xl p-4"
        style={{
          background: "var(--bg-element)",
          border: "1px solid var(--border)",
        }}
      >
        <p className="mono-label mb-3">SENTIMENT_BREAKDOWN</p>
        <div className="flex flex-wrap gap-4">
          {(["hostile", "negative", "neutral", "positive"] as const).map((sentiment) => (
            <div key={sentiment} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: SENTIMENT_COLORS[sentiment] }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {SENTIMENT_LABELS[sentiment]}
              </span>
              <span
                className="tabular-nums"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
              >
                {sentimentCounts[sentiment]}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                (
                {totalMessages > 0
                  ? Math.round((sentimentCounts[sentiment] / totalMessages) * 100)
                  : 0}
                %)
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full">
          {(["hostile", "negative", "neutral", "positive"] as const).map((sentiment) => {
            const pct = totalMessages > 0 ? (sentimentCounts[sentiment] / totalMessages) * 100 : 0;

            if (pct === 0) {
              return null;
            }

            return (
              <div
                key={sentiment}
                style={{
                  width: `${pct}%`,
                  background: SENTIMENT_COLORS[sentiment],
                  minWidth: pct > 0 ? 2 : 0,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <SimulationGraph thread={thread} />
      </div>

      <div
        className="mt-6 rounded-xl p-4"
        style={{
          background: "var(--bg-element)",
          border: "1px solid var(--border)",
        }}
      >
        <p className="mono-label mb-2">ORIGINAL_POST</p>
        <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
          &ldquo;{sim.input}&rdquo;
        </p>
      </div>

      <div className="mt-8">
        <p className="mono-label mb-4">THREAD</p>
        <SimulationThread thread={thread} platform={sim.platform} />
      </div>

      <div
        className="mt-12 rounded-xl p-6 text-center"
        style={{
          background:
            "linear-gradient(180deg, rgba(39, 39, 42, 0.34), rgba(24, 24, 27, 0.16) 42%, transparent 100%)",
          border: "1px solid rgba(39, 39, 42, 0.55)",
        }}
      >
        <p style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500 }}>
          Want to run your own simulation?
        </p>
        <p className="mt-1" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Start free in the dashboard, run the playground immediately, and join the API waitlist
          separately when you need direct integration.
        </p>
        <a
          href="/login?mode=signup"
          className="btn-primary mt-4 inline-flex"
          style={{ padding: "10px 24px", fontSize: 13 }}
        >
          Start free
        </a>
      </div>
    </div>
  );
}
