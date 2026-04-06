"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

interface Simulation {
  id: string;
  audience_id: string;
  persona_cap: number | null;
  platform: string;
  input: string;
  aggression_score: string | null;
  title: string | null;
  summary: string | null;
  shared_at: string | null;
  progress_messages: number;
  created_at: string;
  public_clicks: number;
  upvotes: number;
  downvotes: number;
}

type SortMode = "recent" | "hot" | "most_viewed" | "most_liked";

const AGGRESSION_COLORS: Record<string, string> = {
  low: "var(--mint)",
  moderate: "#F59E0B",
  high: "#f97316",
  critical: "#ef4444",
};

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "hot", label: "Hot" },
  { value: "most_viewed", label: "Most viewed" },
  { value: "most_liked", label: "Most liked" },
];

function formatRelativeDate(date: string | null) {
  if (!date) return "Recently";
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function hotScore(sim: Simulation): number {
  const votes = sim.upvotes - sim.downvotes;
  const age = (Date.now() - new Date(sim.shared_at ?? sim.created_at).getTime()) / 3600000;
  return (votes + sim.public_clicks * 0.1) / Math.pow(age + 2, 1.5);
}

function VoteButton({
  direction,
  count,
  active,
  disabled,
  onVote,
}: {
  direction: 1 | -1;
  count: number;
  active: boolean;
  disabled: boolean;
  onVote: (vote: 0 | 1 | -1) => void;
}) {
  function handleVote() {
    if (disabled) return;
    onVote(active ? 0 : direction);
  }

  const isUp = direction === 1;

  return (
    <button
      type="button"
      onClick={handleVote}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid",
        borderColor: active ? (isUp ? "var(--accent)" : "var(--coral)") : "var(--border)",
        background: active
          ? isUp
            ? "rgba(124, 92, 252, 0.08)"
            : "rgba(249, 112, 102, 0.08)"
          : "transparent",
        color: active ? (isUp ? "var(--accent)" : "var(--coral)") : "var(--text-tertiary)",
        fontSize: 12,
        cursor: "pointer",
        transition: "all 150ms ease",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        {isUp ? (
          <path d="M6 2.5L10 8.5H2L6 2.5Z" fill="currentColor" />
        ) : (
          <path d="M6 9.5L2 3.5H10L6 9.5Z" fill="currentColor" />
        )}
      </svg>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function SimCard({
  sim,
  userVote,
  upvotes,
  downvotes,
  onVoteChange,
}: {
  sim: Simulation;
  userVote: number | null;
  upvotes: number;
  downvotes: number;
  onVoteChange: (vote: number | null, up: number, down: number) => void;
}) {
  const [voting, setVoting] = useState(false);

  async function handleVote(newVote: 0 | 1 | -1) {
    if (voting) return;
    setVoting(true);

    const prevVote = userVote;

    // Optimistic counts
    let upDelta = 0;
    let downDelta = 0;
    if (newVote === 0) {
      if (prevVote === 1) upDelta = -1;
      if (prevVote === -1) downDelta = -1;
    } else if (prevVote === null) {
      if (newVote === 1) upDelta = 1;
      if (newVote === -1) downDelta = 1;
    } else if (prevVote !== newVote) {
      if (newVote === 1) { upDelta = 1; downDelta = -1; }
      if (newVote === -1) { downDelta = 1; upDelta = -1; }
    }

    const newUp = Math.max(0, upvotes + upDelta);
    const newDown = Math.max(0, downvotes + downDelta);
    onVoteChange(newVote === 0 ? null : newVote, newUp, newDown);

    try {
      const res = await fetch("/api/v1/explore/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulation_id: sim.id, vote: newVote }),
      });

      if (res.status === 401) {
        window.location.assign("/login?mode=signin&next=%2Fexplore");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        onVoteChange(
          data.user_vote === 0 ? null : data.user_vote,
          data.upvotes,
          data.downvotes
        );
      }
    } catch {
      // Revert
      onVoteChange(prevVote, upvotes, downvotes);
    } finally {
      setVoting(false);
    }
  }

  return (
    <article
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "18px 20px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-subtle)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--surface)";
      }}
    >
      {/* Votes */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          flexShrink: 0,
          minWidth: 52,
        }}
      >
        <VoteButton
          direction={1}
          count={upvotes}
          active={userVote === 1}
          disabled={voting}
          onVote={handleVote}
        />
        <VoteButton
          direction={-1}
          count={downvotes}
          active={userVote === -1}
          disabled={voting}
          onVote={handleVote}
        />
      </div>

      {/* Content — whole area clickable */}
      <Link
        href={`/sim/${sim.id}`}
        style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "var(--text-primary)",
              lineHeight: 1.3,
            }}
          >
            {sim.title ?? sim.input.slice(0, 100)}
          </span>
          {sim.aggression_score ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: AGGRESSION_COLORS[sim.aggression_score] ?? "var(--text-tertiary)",
                padding: "2px 8px",
                borderRadius: 4,
                background:
                  sim.aggression_score === "critical"
                    ? "rgba(239, 68, 68, 0.08)"
                    : sim.aggression_score === "high"
                      ? "rgba(249, 115, 22, 0.08)"
                      : sim.aggression_score === "moderate"
                        ? "rgba(245, 158, 11, 0.08)"
                        : "rgba(34, 197, 94, 0.06)",
                flexShrink: 0,
              }}
            >
              {sim.aggression_score}
            </span>
          ) : null}
        </div>
        <div
          className="mt-1.5 flex flex-wrap items-center gap-1.5"
          style={{ fontSize: 12, color: "var(--text-tertiary)" }}
        >
          <span style={{ textTransform: "capitalize" }}>{sim.platform}</span>
          <span style={{ opacity: 0.4 }}>&middot;</span>
          <span>{sim.audience_id.replace(/_/g, " ")}</span>
          <span style={{ opacity: 0.4 }}>&middot;</span>
          <span>{sim.progress_messages} msgs</span>
          {sim.persona_cap ? (
            <>
              <span style={{ opacity: 0.4 }}>&middot;</span>
              <span>{sim.persona_cap} agents</span>
            </>
          ) : null}
          <span style={{ opacity: 0.4 }}>&middot;</span>
          <span suppressHydrationWarning>{formatRelativeDate(sim.shared_at ?? sim.created_at)}</span>
          {sim.public_clicks > 0 ? (
            <>
              <span style={{ opacity: 0.4 }}>&middot;</span>
              <span>{sim.public_clicks} views</span>
            </>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export default function ExploreClient({
  simulations: initialSimulations,
  userVotes: initialUserVotes,
}: {
  simulations: Simulation[];
  userVotes: Record<string, number>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [sort, setSort] = useState<SortMode>("recent");
  const [userVotes, setUserVotes] = useState(initialUserVotes);
  const [voteCounts, setVoteCounts] = useState<Record<string, { up: number; down: number }>>({});

  function setCounts(id: string, up: number, down: number) {
    setVoteCounts((prev) => ({ ...prev, [id]: { up, down } }));
  }

  function getUpvotes(sim: Simulation) {
    return voteCounts[sim.id]?.up ?? sim.upvotes;
  }

  function getDownvotes(sim: Simulation) {
    return voteCounts[sim.id]?.down ?? sim.downvotes;
  }

  const filtered = useMemo(() => {
    let list = [...initialSimulations];

    switch (sort) {
      case "hot":
        list.sort((a, b) => hotScore(b) - hotScore(a));
        break;
      case "most_viewed":
        list.sort((a, b) => b.public_clicks - a.public_clicks);
        break;
      case "most_liked":
        list.sort((a, b) => getUpvotes(b) - getDownvotes(b) - (getUpvotes(a) - getDownvotes(a)));
        break;
      default:
        // Already sorted by shared_at desc from server
        break;
    }

    return list;
  }, [initialSimulations, sort, voteCounts]);

  return (
    <div className="mx-auto max-w-[1180px] px-6 pt-14 pb-24" suppressHydrationWarning>
      {/* Header */}
      <div style={{ maxWidth: 640 }}>
        <span className="mono-label">Explore</span>
        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            marginTop: 12,
            color: "var(--text-primary)",
          }}
        >
          Public simulations
        </h1>
        <p
          style={{
            marginTop: 12,
            color: "var(--text-secondary)",
            fontSize: 15,
            lineHeight: 1.7,
          }}
        >
          Browse and vote on publicly shared runs from the Atharias network.
        </p>
      </div>

      {/* Filters + Sort */}
      <div
        className="mt-8 flex flex-wrap items-center gap-2"
        style={{ fontSize: 13 }}
      >
        {/* Sort tabs */}
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSort(opt.value)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: sort === opt.value ? "var(--accent)" : "var(--border)",
              background: sort === opt.value ? "rgba(124, 92, 252, 0.08)" : "transparent",
              color: sort === opt.value ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: sort === opt.value ? 500 : 400,
              transition: "all 150ms ease",
            }}
          >
            {opt.label}
          </button>
        ))}


      </div>

      {/* Cards — uniform list layout */}
      {filtered.length > 0 ? (
        <div className="mt-8" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {filtered.map((sim) => (
            <SimCard
              key={sim.id}
              sim={sim}
              userVote={userVotes[sim.id] ?? null}
              upvotes={getUpvotes(sim)}
              downvotes={getDownvotes(sim)}
              onVoteChange={(newVote, newUp, newDown) => {
                const next = { ...userVotes };
                if (newVote === null) {
                  delete next[sim.id];
                } else {
                  next[sim.id] = newVote;
                }
                setUserVotes(next);
                setCounts(sim.id, newUp, newDown);
              }}
            />
          ))}
        </div>
      ) : (
        <div
          className="mt-10"
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--surface)",
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <p style={{ color: "var(--text-primary)", fontSize: 16 }}>No simulations match your filters.</p>
          <p className="mt-2" style={{ color: "var(--text-tertiary)", fontSize: 14 }}>
            Try changing the sort or removing a filter.
          </p>
        </div>
      )}
    </div>
  );
}
