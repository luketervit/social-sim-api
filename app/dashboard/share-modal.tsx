"use client";

import { useState, useEffect } from "react";

interface SimulationRecord {
  id: string;
  audience_id: string;
  platform: string;
  input: string;
  status: string;
  aggression_score: string | null;
  public: boolean;
  title: string | null;
  summary: string | null;
  shared_at: string | null;
  progress_messages: number;
  created_at: string;
  completed_at: string | null;
}

interface ShareModalProps {
  simulation: SimulationRecord;
  onClose: () => void;
  onShared: (simId: string, title: string, summary: string) => void;
}

type ModalState = "generating" | "editing" | "publishing" | "done" | "error";

export default function ShareModal({ simulation, onClose, onShared }: ShareModalProps) {
  const [state, setState] = useState<ModalState>("generating");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function generateDraft() {
      try {
        const response = await fetch(`/api/v1/simulate/${simulation.id}/share`, {
          method: "POST",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to generate summary");
        }

        setTitle(data.title);
        setSummary(data.summary);

        if (data.already_shared) {
          setShareUrl(`${window.location.origin}/sim/${simulation.id}`);
          setState("done");
        } else {
          setState("editing");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setState("error");
      }
    }

    generateDraft();
  }, [simulation.id]);

  async function logShareEvent(channel: string, shareText: string | null, destination: string | null) {
    try {
      await fetch(`/api/v1/simulate/${simulation.id}/share-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          share_text: shareText,
          destination,
        }),
      });
    } catch {
      // Sharing should not fail because analytics logging failed.
    }
  }

  async function handlePublish() {
    setState("publishing");
    try {
      const response = await fetch(`/api/v1/simulate/${simulation.id}/share`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, summary }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to publish");
      }

      const url = `${window.location.origin}${data.share_url}`;
      setShareUrl(url);
      setState("done");
      onShared(simulation.id, title, summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
      setState("error");
    }
  }

  async function handleCopy() {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await logShareEvent("copy_link", shareUrl, shareUrl);
    }
  }

  const twitterIntentUrl =
    shareUrl && title && summary
      ? `https://twitter.com/intent/tweet?${new URLSearchParams({
          text: `${title} - ${summary}`,
          url: shareUrl,
        }).toString()}`
      : null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 200,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl p-6"
        style={{
          background: "var(--obsidian-panel)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="mono-label">SHARE_SIMULATION</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: 18,
              padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        {/* Generating state */}
        {state === "generating" ? (
          <div className="mt-6 text-center py-8">
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Generating title and summary...
            </p>
            <p className="mt-2" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              AI is analyzing {simulation.progress_messages} messages
            </p>
          </div>
        ) : null}

        {/* Editing state */}
        {state === "editing" || state === "publishing" ? (
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="share-title"
                className="block text-[12px] mb-1.5"
                style={{ color: "var(--text-tertiary)", fontWeight: 500 }}
              >
                Title
              </label>
              <input
                id="share-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                maxLength={120}
                disabled={state === "publishing"}
              />
            </div>

            <div>
              <label
                htmlFor="share-summary"
                className="block text-[12px] mb-1.5"
                style={{ color: "var(--text-tertiary)", fontWeight: 500 }}
              >
                Summary
              </label>
              <textarea
                id="share-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="input"
                rows={3}
                maxLength={500}
                disabled={state === "publishing"}
                style={{ resize: "vertical", minHeight: 80 }}
              />
            </div>

            {/* Preview metadata */}
            <div
              className="flex flex-wrap gap-2"
              style={{ fontSize: 12, color: "var(--text-tertiary)" }}
            >
              <span
                className="rounded-full px-2.5 py-0.5"
                style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
              >
                {simulation.platform}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5"
                style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
              >
                {simulation.audience_id.replace(/_/g, " ")}
              </span>
              {simulation.aggression_score ? (
                <span
                  className="rounded-full px-2.5 py-0.5"
                  style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
                >
                  {simulation.aggression_score} aggression
                </span>
              ) : null}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                style={{ padding: "10px 16px", minHeight: "auto", fontSize: 13 }}
                disabled={state === "publishing"}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                className="btn-primary flex-1"
                style={{ padding: "10px 16px", minHeight: "auto", fontSize: 13 }}
                disabled={state === "publishing" || !title.trim() || !summary.trim()}
              >
                {state === "publishing" ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Done state */}
        {state === "done" ? (
          <div className="mt-4 space-y-4">
            <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
              Simulation shared
            </p>

            <div
              className="flex items-center gap-2 rounded-xl p-3"
              style={{ background: "var(--bg-element)", border: "1px solid var(--border)" }}
            >
              <code
                className="min-w-0 flex-1 break-all text-[12px]"
                style={{ color: "var(--accent)" }}
              >
                {shareUrl}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="btn-secondary flex-shrink-0"
                style={{ padding: "6px 10px", minHeight: "auto", fontSize: 12 }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={shareUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex-1 text-center"
                style={{ padding: "10px 16px", minHeight: "auto", fontSize: 13 }}
              >
                View page
              </a>
              {twitterIntentUrl ? (
                <a
                  href={twitterIntentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    void logShareEvent(
                      "twitter",
                      title && summary ? `${title}\n\n${summary}` : null,
                      shareUrl
                    );
                  }}
                  className="btn-secondary flex-1 text-center"
                  style={{ padding: "10px 16px", minHeight: "auto", fontSize: 13 }}
                >
                  Share on X
                </a>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="btn-primary flex-1"
                style={{ padding: "10px 16px", minHeight: "auto", fontSize: 13 }}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}

        {/* Error state */}
        {state === "error" ? (
          <div className="mt-4 space-y-4">
            <p style={{ fontSize: 14, color: "#f87171" }}>{error}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                style={{ padding: "10px 16px", minHeight: "auto", fontSize: 13 }}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
