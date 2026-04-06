"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ApiKey {
  key: string;
  email: string;
  name: string | null;
  credits: string;
  total_tokens_used: number;
  created_at: string;
}

interface KeysClientProps {
  waitlisted: boolean;
  waitlistJoinedAt: string | null;
  accessGrantedAt: string | null;
}

export default function KeysClient({
  waitlisted,
  waitlistJoinedAt,
  accessGrantedAt,
}: KeysClientProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(!waitlisted);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (waitlisted) return;

    async function loadKeys() {
      try {
        const res = await fetch("/api/v1/keys");
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to load keys");
        }
        const data = await res.json();
        setKeys(data.keys ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load keys");
      } finally {
        setLoading(false);
      }
    }

    loadKeys();
  }, [waitlisted]);

  async function createKey() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create key");
      }
      const newKey = await res.json();
      setKeys((prev) => [newKey, ...prev]);
      setRevealedKey(newKey.key);
      setNewKeyName("");
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(key: string) {
    setDeletingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete key");
      }
      setKeys((prev) => prev.filter((k) => k.key !== key));
      if (revealedKey === key) setRevealedKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete key");
    } finally {
      setDeletingKey(null);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function maskKey(key: string) {
    return key.slice(0, 8) + "\u2026" + key.slice(-4);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Waitlisted state
  if (waitlisted) {
    return (
      <div className="mx-auto max-w-[620px] px-6" style={{ padding: "80px 24px" }}>
        <span className="mono-label">API Access</span>
        <h1
          style={{
            fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginTop: 14,
          }}
        >
          Access pending.
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: 16,
            lineHeight: 1.7,
            marginTop: 20,
            maxWidth: 480,
          }}
        >
          Your API access request is in the queue. We review applications manually
          and grant access in batches. You&apos;ll receive an email when your account
          is approved.
        </p>

        {waitlistJoinedAt ? (
          <div
            style={{
              marginTop: 28,
              padding: "16px 20px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              display: "inline-flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
              Joined waitlist
            </span>
            <span
              style={{
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "var(--font-data), monospace",
              }}
            >
              {formatDate(waitlistJoinedAt)}
            </span>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn-primary">
            Go to Playground
          </Link>
          <Link href="/docs" className="btn-secondary">
            Read the docs
          </Link>
        </div>
      </div>
    );
  }

  // Approved state
  return (
    <div className="mx-auto max-w-[720px] px-6" style={{ padding: "80px 24px" }}>
      <span className="mono-label">API Access</span>
      <h1
        style={{
          fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
          fontFamily: "var(--font-display), Georgia, serif",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginTop: 14,
        }}
      >
        API Keys
      </h1>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: 16,
          lineHeight: 1.7,
          marginTop: 14,
        }}
      >
        Create and manage API keys for integrating Atharias into your workflows.
        {accessGrantedAt ? (
          <span style={{ color: "var(--text-tertiary)" }}>
            {" "}Access granted {formatDate(accessGrantedAt)}.
          </span>
        ) : null}
      </p>

      {error ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--coral)" }}>{error}</p>
      ) : null}

      {/* Revealed key banner — only shown once after creation */}
      {revealedKey ? (
        <div
          className="mt-6"
          style={{
            padding: "20px 24px",
            borderRadius: 12,
            border: "1px solid var(--accent)",
            background: "var(--accent-subtle)",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
              Copy your key now — it won&apos;t be shown again
            </span>
            <button
              onClick={() => setRevealedKey(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-tertiary)",
                fontSize: 18,
                padding: 2,
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
          <div className="flex items-center gap-3">
            <code
              style={{
                flex: 1,
                fontFamily: "var(--font-data), monospace",
                fontSize: 13,
                color: "var(--text-primary)",
                letterSpacing: "0.01em",
                wordBreak: "break-all",
                lineHeight: 1.5,
              }}
            >
              {revealedKey}
            </code>
            <button
              onClick={() => copyKey(revealedKey)}
              className="btn-primary"
              style={{ padding: "8px 18px", minHeight: 36, fontSize: 13, flexShrink: 0 }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {keys.length} {keys.length === 1 ? "key" : "keys"}
          </span>
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary"
              style={{ padding: "10px 24px", minHeight: 40, fontSize: 14 }}
            >
              Generate new key
            </button>
          ) : null}
        </div>

        {/* Create key form */}
        {showCreateForm ? (
          <div
            className="panel mb-4"
            style={{ padding: "22px 24px" }}
          >
            <label
              htmlFor="key-name"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 8 }}
            >
              Key name
            </label>
            <div className="flex gap-3">
              <input
                id="key-name"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production, Staging, My App"
                className="input"
                style={{ flex: 1, minHeight: 42 }}
                maxLength={64}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") createKey();
                  if (e.key === "Escape") setShowCreateForm(false);
                }}
              />
              <button
                onClick={createKey}
                disabled={creating}
                className="btn-primary"
                style={{ padding: "10px 24px", minHeight: 42, fontSize: 14 }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setNewKeyName(""); }}
                className="btn-secondary"
                style={{ padding: "10px 18px", minHeight: 42, fontSize: 14 }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--text-tertiary)",
              fontSize: 14,
            }}
          >
            Loading keys...
          </div>
        ) : keys.length === 0 && !showCreateForm ? (
          <div
            className="panel"
            style={{ padding: 40, textAlign: "center" }}
          >
            <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
              No API keys yet. Generate one to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {keys.map((apiKey) => (
              <div
                key={apiKey.key}
                className="panel"
                style={{
                  padding: "18px 22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div className="flex items-center gap-2">
                    {apiKey.name ? (
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                        {apiKey.name}
                      </span>
                    ) : null}
                    <code
                      style={{
                        fontFamily: "var(--font-data), monospace",
                        fontSize: 13,
                        color: apiKey.name ? "var(--text-tertiary)" : "var(--text-primary)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {maskKey(apiKey.key)}
                    </code>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span>Credits: {apiKey.credits}</span>
                    <span>Tokens: {apiKey.total_tokens_used.toLocaleString()}</span>
                    <span>Created {formatDate(apiKey.created_at)}</span>
                  </div>
                </div>

                <button
                  onClick={() => deleteKey(apiKey.key)}
                  disabled={deletingKey === apiKey.key}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "6px 14px",
                    fontSize: 13,
                    color: "var(--coral)",
                    cursor: "pointer",
                    transition: "border-color 150ms ease",
                  }}
                >
                  {deletingKey === apiKey.key ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
