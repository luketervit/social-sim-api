"use client";

import { useState, type FormEvent } from "react";

export default function KeysPage() {
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setApiKey(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create key");
        return;
      }

      setApiKey(data.key);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mx-auto max-w-[440px] pt-16">
      <h1
        className="text-[28px]"
        style={{
          fontWeight: "var(--font-weight-bold)" as unknown as number,
          letterSpacing: "-0.03em",
        }}
      >
        Get API Key
      </h1>
      <p
        className="mt-2 text-[14px] leading-[1.6]"
        style={{ color: "var(--text-secondary)" }}
      >
        Enter your email to receive an API key with 100 free simulation credits.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          spellCheck={false}
          autoComplete="email"
          className="input"
        />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating\u2026" : "Generate Key"}
        </button>
      </form>

      {error && (
        <div
          className="mt-6 rounded-lg px-4 py-3 text-[13px]"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            color: "#f87171",
            boxShadow: "0 0 0 1px rgba(239, 68, 68, 0.15)",
          }}
        >
          {error}
        </div>
      )}

      {apiKey && (
        <div
          className="mt-6 rounded-lg p-4"
          style={{
            background: "rgba(34, 197, 94, 0.06)",
            boxShadow: "0 0 0 1px rgba(34, 197, 94, 0.12)",
          }}
        >
          <p className="text-[13px]" style={{ color: "#4ade80" }}>
            Your API key (save it &mdash; it won&rsquo;t be shown again):
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code
              className="flex-1 break-all rounded-md px-3 py-2.5 text-[13px]"
              style={{
                background: "var(--bg-element)",
                color: "var(--text-primary)",
              }}
            >
              {apiKey}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary"
              style={{ padding: "8px 14px", minHeight: "auto", fontSize: "13px" }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
