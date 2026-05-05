"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface AudienceRow {
  id: string;
  name: string;
  platform: string | null;
  status: string;
  row_count: number | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  generator_model?: string | null;
  classifier_models?: string[] | null;
  routing_decision?: {
    classifier_ids?: string[];
    generator_id?: string;
    reasoning?: string;
    vocabulary_seeds?: string[];
    source?: string;
  } | null;
}

interface AudiencesClientProps {
  initialAudiences: AudienceRow[];
}

const ACCEPTED_EXTENSIONS = [".csv", ".json", ".ndjson"];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

function statusColor(status: string): string {
  if (status === "ready") return "var(--mint, #34D399)";
  if (status === "processing") return "var(--accent, #7C5CFC)";
  return "var(--coral, #F97066)";
}

export default function AudiencesClient({ initialAudiences }: AudiencesClientProps) {
  const [audiences, setAudiences] = useState<AudienceRow[]>(initialAudiences);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"twitter" | "reddit" | "slack" | "linkedin">(
    "twitter"
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Poll for status updates while any audience is still processing.
  useEffect(() => {
    const hasProcessing = audiences.some((a) => a.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/v1/audiences");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.audiences)) {
          setAudiences(data.audiences);
        }
      } catch {
        // ignore network blips
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [audiences]);

  const onFileChosen = useCallback((f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const lower = f.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setError("File must be .csv, .json, or .ndjson");
      return;
    }
    setFile(f);
    if (!name.trim()) {
      const guess = f.name.replace(/\.[^.]+$/, "");
      setName(guess.slice(0, 60));
    }
  }, [name]);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileChosen(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file.");
      return;
    }
    if (!name.trim()) {
      setError("Please name this audience.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("platform", platform);

      const res = await fetch("/api/v1/audiences", {
        method: "POST",
        body: fd,
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Upload failed.");
      }

      // Refresh list
      const listRes = await fetch("/api/v1/audiences");
      if (listRes.ok) {
        const data = await listRes.json();
        if (Array.isArray(data.audiences)) {
          setAudiences(data.audiences);
        }
      }

      setFile(null);
      setName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this audience? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/v1/audiences/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Delete failed.");
      }
      setAudiences((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="mx-auto max-w-[860px] px-6" style={{ padding: "72px 24px 120px" }}>
      <span className="mono-label">CUSTOM AUDIENCES</span>
      <h1
        style={{
          fontSize: "clamp(2rem, 4vw, 2.75rem)",
          fontFamily: "var(--font-display), Georgia, serif",
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          marginTop: 14,
        }}
      >
        Upload your data, get a custom audience.
      </h1>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: 16,
          lineHeight: 1.7,
          marginTop: 18,
          maxWidth: 580,
        }}
      >
        Drop a CSV or JSON of customer messages, support tickets, community
        posts, or any text your audience writes. We classify each row and turn
        it into a persona you can simulate against.
      </p>

      {/* Upload form */}
      <form
        onSubmit={handleSubmit}
        className="panel mt-10"
        style={{ padding: "28px 28px 24px" }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 18 }}>
          New audience
        </h2>

        <label
          style={{
            fontSize: 13,
            fontWeight: 500,
            display: "block",
            marginBottom: 8,
          }}
        >
          File
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragActive ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 12,
            padding: 28,
            textAlign: "center",
            cursor: "pointer",
            background: dragActive ? "rgba(124, 92, 252, 0.04)" : "var(--surface)",
            transition: "border-color 150ms, background 150ms",
          }}
        >
          {file ? (
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{file.name}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  marginTop: 4,
                  fontFamily: "var(--font-data), monospace",
                }}
              >
                {(file.size / 1024).toFixed(1)} KB · click to change
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Drop a .csv or .json file, or click to browse
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  marginTop: 6,
                }}
              >
                Max 10 MB · up to 2,000 rows · any CSV — we&apos;ll pick the best text column or combine fields
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.ndjson,text/csv,application/json"
            style={{ display: "none" }}
            onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="audience-name"
              style={{
                fontSize: 13,
                fontWeight: 500,
                display: "block",
                marginBottom: 8,
              }}
            >
              Name
            </label>
            <input
              id="audience-name"
              type="text"
              className="input"
              placeholder="e.g. Discord active users — March 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              style={{ width: "100%", minHeight: 42 }}
            />
          </div>

          <div>
            <label
              htmlFor="audience-platform"
              style={{
                fontSize: 13,
                fontWeight: 500,
                display: "block",
                marginBottom: 8,
              }}
            >
              Platform to simulate
            </label>
            <select
              id="audience-platform"
              value={platform}
              onChange={(e) =>
                setPlatform(e.target.value as "twitter" | "reddit" | "slack" | "linkedin")
              }
              className="input"
              style={{ width: "100%", minHeight: 42 }}
            >
              <option value="twitter">Twitter / X</option>
              <option value="linkedin">LinkedIn</option>
              <option value="reddit">Reddit</option>
              <option value="slack">Slack</option>
            </select>
          </div>
        </div>

        {error ? (
          <p
            className="mt-4"
            style={{ color: "var(--coral)", fontSize: 13, lineHeight: 1.5 }}
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !file}
            className="btn-primary"
            style={{ minHeight: 42, padding: "10px 22px" }}
          >
            {submitting ? "Uploading…" : "Upload audience"}
          </button>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
            }}
          >
            Processing usually takes 30–90 seconds.
          </span>
        </div>
      </form>

      {/* Audience list */}
      <div className="mt-12">
        <div
          className="flex items-baseline justify-between mb-4"
          style={{ gap: 16 }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 500 }}>Your audiences</h2>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            {audiences.length} total
          </span>
        </div>

        {audiences.length === 0 ? (
          <div
            className="panel"
            style={{ padding: 36, textAlign: "center" }}
          >
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              No custom audiences yet. Upload a file above to create one.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {audiences.map((audience) => (
              <div
                key={audience.id}
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
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {audience.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: statusColor(audience.status),
                        fontFamily: "var(--font-data), monospace",
                      }}
                    >
                      {audience.status}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span>{audience.platform ?? "twitter"}</span>
                    <span>{audience.row_count ?? "—"} personas</span>
                    <span>Created {formatDate(audience.created_at)}</span>
                  </div>
                  {audience.error_message ? (
                    <p
                      style={{
                        color: "var(--coral)",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {audience.error_message}
                    </p>
                  ) : null}
                  {audience.routing_decision &&
                  audience.status === "ready" ? (
                    <details
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      <summary
                        style={{
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          fontFamily: "var(--font-data), monospace",
                          fontSize: 11,
                          letterSpacing: "0.04em",
                        }}
                      >
                        Routing
                        {audience.routing_decision.source === "router"
                          ? " · Claude-routed"
                          : " · default"}
                      </summary>
                      <div
                        style={{
                          marginTop: 8,
                          padding: "10px 12px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          lineHeight: 1.55,
                        }}
                      >
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            Generator:{" "}
                          </span>
                          <code style={{ fontSize: 11 }}>
                            {audience.generator_model ??
                              audience.routing_decision.generator_id ??
                              "default"}
                          </code>
                        </div>
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            Classifiers:{" "}
                          </span>
                          {(
                            audience.classifier_models ??
                            audience.routing_decision.classifier_ids ??
                            []
                          ).join(", ") || "none"}
                        </div>
                        {audience.routing_decision.vocabulary_seeds &&
                        audience.routing_decision.vocabulary_seeds.length >
                          0 ? (
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ color: "var(--text-secondary)" }}>
                              Vocab seeds:{" "}
                            </span>
                            {audience.routing_decision.vocabulary_seeds
                              .map((v) => `"${v}"`)
                              .join(", ")}
                          </div>
                        ) : null}
                        {audience.routing_decision.reasoning ? (
                          <div
                            style={{
                              marginTop: 6,
                              color: "var(--text-secondary)",
                              fontStyle: "italic",
                            }}
                          >
                            {audience.routing_decision.reasoning}
                          </div>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {audience.status === "ready" ? (
                    <Link
                      href={`/dashboard?audience=${audience.id}`}
                      className="btn-primary"
                      style={{
                        padding: "6px 14px",
                        minHeight: "auto",
                        fontSize: 12,
                      }}
                    >
                      Run sim
                    </Link>
                  ) : null}
                  <button
                    onClick={() => handleDelete(audience.id)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "var(--coral)",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
