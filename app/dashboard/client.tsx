"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Persona } from "@/lib/schemas";
import AudienceChat from "./AudienceChat";
import SimulateComposer from "./SimulateComposer";

export interface AudienceSummary {
  id: string;
  name: string;
  platform: string | null;
  status: string;
  row_count: number | null;
  created_at: string;
}

interface DashboardClientProps {
  email: string;
  audiences: AudienceSummary[];
  selected: AudienceSummary | null;
  personas: Persona[];
  selectedPlatform: string | null;
}

const ACCEPTED_EXTENSIONS = [".csv", ".json", ".ndjson"];

export default function DashboardClient({
  email,
  audiences: initialAudiences,
  selected,
  personas,
  selectedPlatform,
}: DashboardClientProps) {
  const router = useRouter();
  const [audiences, setAudiences] = useState<AudienceSummary[]>(initialAudiences);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Poll while any audience is processing.
  useEffect(() => {
    const hasProcessing = audiences.some((a) => a.status === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/v1/audiences");
        if (!res.ok) return;
        const data = (await res.json()) as { audiences?: AudienceSummary[] };
        if (Array.isArray(data.audiences)) {
          setAudiences(data.audiences);
          // If a fresh audience just became ready and none was selected, refresh.
          if (
            !selected &&
            data.audiences.some((a) => a.status === "ready")
          ) {
            router.refresh();
          }
        }
      } catch {
        // ignore network blips
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [audiences, selected, router]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadError(null);
      const lower = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        setUploadError("File must be .csv, .json, or .ndjson.");
        return;
      }

      const guess = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Audience";

      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", guess);
      fd.append("platform", "twitter");

      setUploading(true);
      try {
        const res = await fetch("/api/v1/audiences", { method: "POST", body: fd });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Upload failed.");
        }
        const listRes = await fetch("/api/v1/audiences");
        if (listRes.ok) {
          const data = (await listRes.json()) as { audiences?: AudienceSummary[] };
          if (Array.isArray(data.audiences)) setAudiences(data.audiences);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    []
  );

  const showUpload =
    audiences.length === 0 ||
    audiences.every((a) => a.status !== "ready") ||
    !selected;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* Top bar */}
      <header
        className="header"
        style={{ display: "flex", alignItems: "center" }}
      >
        <div
          className="mx-auto px-6"
          style={{
            width: "100%",
            maxWidth: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "14px 24px",
          }}
        >
          <Link href="/" className="logo" aria-label="Atharias home">
            Atharias
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-data), monospace",
              fontSize: 11,
              color: "var(--text-tertiary)",
              letterSpacing: "0.04em",
            }}
          >
            <span>{email}</span>
            <Link href="/audiences" className="nav-link">
              Audiences
            </Link>
          </div>
        </div>
      </header>

      <main
        className="mx-auto px-6"
        style={{
          maxWidth: 1100,
          padding: "clamp(36px, 5vh, 64px) 24px clamp(72px, 10vh, 120px)",
        }}
      >
        {/* Audience switcher */}
        {audiences.length > 0 ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 28,
            }}
            role="tablist"
            aria-label="Audiences"
          >
            {audiences.map((a) => {
              const active = selected?.id === a.id;
              const ready = a.status === "ready";
              return (
                <Link
                  key={a.id}
                  href={ready ? `/dashboard?audience=${a.id}` : "#"}
                  aria-disabled={!ready}
                  role="tab"
                  aria-selected={active}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 500,
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    background: active ? "var(--surface)" : "transparent",
                    border: `1px solid ${active ? "var(--border-hover)" : "var(--border)"}`,
                    textDecoration: "none",
                    boxShadow: active
                      ? "0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)"
                      : "none",
                    opacity: ready ? 1 : 0.55,
                    pointerEvents: ready ? "auto" : "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    transition:
                      "background 150ms ease, border-color 150ms ease",
                  }}
                >
                  {a.name}
                  {!ready ? (
                    <span
                      style={{
                        fontFamily: "var(--font-data), monospace",
                        fontSize: 10,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--accent)",
                      }}
                    >
                      {a.status}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}

        {showUpload && !selected ? (
          <UploadHero
            uploading={uploading}
            dragActive={dragActive}
            onDragActive={setDragActive}
            onUpload={handleUpload}
            error={uploadError}
            fileInputRef={fileInputRef}
          />
        ) : null}

        {selected ? (
          <div
            style={{
              display: "grid",
              gap: 28,
              gridTemplateColumns: "1fr",
            }}
          >
            <AudienceChat
              audience={selected}
              personas={personas}
              email={email}
            />

            <SimulateComposer
              audienceId={selected.id}
              defaultPlatform={
                (selectedPlatform as "twitter" | "reddit" | "slack" | null) ??
                "twitter"
              }
              audienceSize={selected.row_count ?? personas.length ?? 50}
            />

            <details
              style={{
                marginTop: 8,
                fontSize: 13,
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
                  textTransform: "uppercase",
                }}
              >
                Upload another audience
              </summary>
              <div style={{ marginTop: 12 }}>
                <UploadHero
                  uploading={uploading}
                  dragActive={dragActive}
                  onDragActive={setDragActive}
                  onUpload={handleUpload}
                  error={uploadError}
                  fileInputRef={fileInputRef}
                  compact
                />
              </div>
            </details>
          </div>
        ) : null}
      </main>
    </div>
  );
}

interface UploadHeroProps {
  uploading: boolean;
  dragActive: boolean;
  onDragActive: (active: boolean) => void;
  onUpload: (file: File) => void;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  compact?: boolean;
}

function UploadHero({
  uploading,
  dragActive,
  onDragActive,
  onUpload,
  error,
  fileInputRef,
  compact,
}: UploadHeroProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      {!compact ? (
        <>
          <span className="mono-label">Step 1 · upload your data</span>
          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
              marginTop: 14,
            }}
          >
            Drop a CSV.{" "}
            <span style={{ fontStyle: "italic" }}>We&apos;ll do the rest.</span>
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 15,
              lineHeight: 1.6,
              marginTop: 14,
              maxWidth: 560,
            }}
          >
            LinkedIn connections, Discord exports, customer messages,
            anything text-based. We classify each row and turn it into a
            persona you can simulate against.
          </p>
        </>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          onDragActive(true);
        }}
        onDragLeave={() => onDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragActive(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onUpload(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload audience file"
        style={{
          marginTop: compact ? 0 : 22,
          padding: compact ? "20px" : "32px",
          borderRadius: 16,
          background: dragActive
            ? "var(--accent-subtle)"
            : "var(--surface)",
          border: `1.5px dashed ${dragActive ? "var(--accent)" : "var(--border)"}`,
          textAlign: "center",
          cursor: uploading ? "progress" : "pointer",
          transition: "border-color 150ms ease, background 150ms ease",
          opacity: uploading ? 0.7 : 1,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: compact ? 18 : 22,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          {uploading
            ? "Uploading…"
            : dragActive
              ? "Drop to upload"
              : "Drop a .csv or click to browse"}
        </div>
        <div
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 12,
            color: "var(--text-tertiary)",
            marginTop: 8,
            letterSpacing: "0.02em",
          }}
        >
          Max 10 MB · up to 2,000 rows · any CSV works — we&apos;ll pick the
          best text column or combine fields automatically.
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.ndjson,text/csv,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "var(--coral)",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
