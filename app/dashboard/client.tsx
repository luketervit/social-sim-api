"use client";

import { useState } from "react";
import SignOutButton from "@/app/components/SignOutButton";
import {
  CREDITS_PER_MESSAGE,
  MAX_MESSAGES_PER_SIMULATION,
  SIMULATION_ROUNDS,
  STANDARD_AUDIENCE_SIZE,
  TRIAL_CREDITS,
} from "@/lib/credits";

interface ApiKeyRecord {
  key: string;
  email: string;
  credits: number;
  total_tokens_used: number | string;
  created_at: string;
}

interface DashboardProps {
  apiKeys: ApiKeyRecord[];
  userEmail: string;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeTokensUsed(value: ApiKeyRecord["total_tokens_used"]) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function maskKey(apiKey: string) {
  const hiddenLength = Math.max(apiKey.length - 12, 8);
  return `${apiKey.slice(0, 8)}${"\u2022".repeat(hiddenLength)}${apiKey.slice(-4)}`;
}

function formatCreatedDate(createdAt: string) {
  return new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardClient({ apiKeys, userEmail }: DashboardProps) {
  const [keys, setKeys] = useState(
    apiKeys.map((keyRow) => ({
      ...keyRow,
      total_tokens_used: normalizeTokensUsed(keyRow.total_tokens_used),
    }))
  );
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreateKey() {
    setIsCreating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/v1/keys", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to create API key");
      }

      setKeys((current) => [
        {
          ...payload,
          total_tokens_used: normalizeTokensUsed(payload.total_tokens_used),
        },
        ...current,
      ]);
      setNotice("New API key created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteKey(key: string) {
    const confirmed = window.confirm("Delete this API key? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    setDeletingKey(key);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/v1/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete API key");
      }

      setKeys((current) => current.filter((keyRow) => keyRow.key !== key));
      setShowKeys((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setCopiedKey((current) => (current === key ? null : current));
      setNotice("API key deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    } finally {
      setDeletingKey(null);
    }
  }

  async function handleCopy(key: string) {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 2000);
  }

  const quickStartKey = keys[0]?.key ?? "";

  return (
    <div className="mx-auto max-w-[720px] pt-16 pb-24">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-[28px]"
            style={{
              fontWeight: "var(--font-weight-medium)" as unknown as number,
              letterSpacing: "-0.03em",
            }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            {userEmail}
          </p>
        </div>
        <SignOutButton
          style={{ padding: "6px 14px", minHeight: "auto", fontSize: "13px" }}
        />
      </div>

      <div className="panel mt-10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-[14px]"
              style={{
                fontWeight: "var(--font-weight-semibold)" as unknown as number,
                color: "var(--text-primary)",
              }}
            >
              API Keys
            </h2>
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Create, rotate, and remove keys. Token usage is tracked separately for each key.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateKey}
            disabled={isCreating}
            className="btn-primary"
            style={{ minHeight: "auto", padding: "10px 14px", whiteSpace: "nowrap" }}
          >
            {isCreating ? "Creating..." : "Create new key"}
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-[13px]" style={{ color: "#f87171" }}>
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-4 text-[13px]" style={{ color: "var(--accent)" }}>
            {notice}
          </p>
        ) : null}

        {keys.length === 0 ? (
          <div
            className="mt-6 rounded-xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-element)" }}
          >
            <p style={{ color: "var(--text-primary)" }}>No API keys yet.</p>
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Create a key to start running simulations and tracking usage.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {keys.map((keyRow, index) => {
              const creditsPercent = Math.min(100, (keyRow.credits / TRIAL_CREDITS) * 100);
              const simulationsRemaining = Math.floor(keyRow.credits / MAX_MESSAGES_PER_SIMULATION);
              const showKey = showKeys[keyRow.key] ?? false;
              const isDeleting = deletingKey === keyRow.key;
              const totalTokensUsed = normalizeTokensUsed(keyRow.total_tokens_used);

              return (
                <div
                  key={keyRow.key}
                  className="rounded-xl border p-5"
                  style={{ borderColor: "var(--border)", background: "var(--bg-element)" }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3
                        className="text-[14px]"
                        style={{
                          fontWeight: "var(--font-weight-semibold)" as unknown as number,
                          color: "var(--text-primary)",
                        }}
                      >
                        API Key {String(index + 1).padStart(2, "0")}
                      </h3>
                      <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        Created {formatCreatedDate(keyRow.created_at)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteKey(keyRow.key)}
                      disabled={isDeleting}
                      className="btn-secondary"
                      style={{
                        padding: "8px 12px",
                        minHeight: "auto",
                        fontSize: "13px",
                        color: "#fca5a5",
                      }}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <code
                      className="min-w-0 flex-1 break-all rounded-md px-3 py-2.5 text-[13px]"
                      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
                    >
                      {showKey ? keyRow.key : maskKey(keyRow.key)}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        setShowKeys((current) => ({
                          ...current,
                          [keyRow.key]: !showKey,
                        }))
                      }
                      className="btn-secondary"
                      style={{ padding: "8px 12px", minHeight: "auto", fontSize: "13px" }}
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(keyRow.key)}
                      className="btn-secondary"
                      style={{ padding: "8px 12px", minHeight: "auto", fontSize: "13px" }}
                    >
                      {copiedKey === keyRow.key ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        Credits remaining
                      </p>
                      <p
                        className="mt-1 tabular-nums text-[24px]"
                        style={{
                          fontWeight: "var(--font-weight-bold)" as unknown as number,
                          color:
                            keyRow.credits > 1500
                              ? "var(--text-primary)"
                              : keyRow.credits > 0
                                ? "#eab308"
                                : "#ef4444",
                        }}
                      >
                        {formatNumber(keyRow.credits)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        Full 100-agent runs left
                      </p>
                      <p
                        className="mt-1 tabular-nums text-[24px]"
                        style={{
                          fontWeight: "var(--font-weight-bold)" as unknown as number,
                          color: "var(--text-primary)",
                        }}
                      >
                        {formatNumber(simulationsRemaining)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        Tokens used
                      </p>
                      <p
                        className="mt-1 tabular-nums text-[24px]"
                        style={{
                          fontWeight: "var(--font-weight-bold)" as unknown as number,
                          color: "var(--text-primary)",
                        }}
                      >
                        {formatNumber(totalTokensUsed)}
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-4 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--bg-primary)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${creditsPercent}%`,
                        background:
                          keyRow.credits > 1500
                            ? "var(--accent)"
                            : keyRow.credits > 0
                              ? "#eab308"
                              : "#ef4444",
                      }}
                    />
                  </div>

                  <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    {keyRow.credits > 0
                      ? `${formatNumber(keyRow.credits)} credits remaining. That covers ${formatNumber(simulationsRemaining)} full ${SIMULATION_ROUNDS}-round, ${STANDARD_AUDIENCE_SIZE}-agent simulation${simulationsRemaining !== 1 ? "s" : ""} at ${MAX_MESSAGES_PER_SIMULATION * CREDITS_PER_MESSAGE} credits max each.`
                      : "No credits remaining on this key."}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {quickStartKey ? (
        <div className="panel mt-4 p-6">
          <h2
            className="text-[14px]"
            style={{
              fontWeight: "var(--font-weight-semibold)" as unknown as number,
              color: "var(--text-primary)",
            }}
          >
            Quick start
          </h2>
          <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Copy your API key from the card above and paste it into the request header.
          </p>
          <div className="code-block mt-3">
            <pre className="whitespace-pre-wrap text-[12px]">
              <code>{`curl -N -X POST https://social-sim-api.vercel.app/api/v1/simulate \\
  -H "x-api-key: ssim_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "audience_id": "toxic_gamers",
    "platform": "twitter",
    "input": "Your message here"
  }'`}</code>
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
