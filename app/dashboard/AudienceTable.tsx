"use client";

import { useMemo, useState } from "react";
import type { Persona } from "@/lib/schemas";
import type { AudienceSummary } from "./types";

type SortKey =
  | "archetype"
  | "reactivity"
  | "sophistication"
  | "affinity"
  | "values";

type SortDirection = "asc" | "desc";

interface AudienceTableProps {
  audience: AudienceSummary;
  personas: Persona[];
  loading: boolean;
  error: string | null;
  onUseInChat: () => void;
  onDownloadCsv: () => void;
}

const PAGE_SIZE = 50;

function describeAffinity(affinity: number): { label: string; color: string } {
  if (affinity <= -0.4) return { label: "skeptical", color: "var(--coral)" };
  if (affinity <= -0.1) return { label: "cool", color: "#C8552B" };
  if (affinity < 0.15) return { label: "neutral", color: "var(--text-secondary)" };
  if (affinity < 0.45) return { label: "warm", color: "#1F8A55" };
  return { label: "supportive", color: "var(--mint)" };
}

export default function AudienceTable({
  audience,
  personas,
  loading,
  error,
  onUseInChat,
  onDownloadCsv,
}: AudienceTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("archetype");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personas;
    return personas.filter((p) => {
      if (p.archetype?.toLowerCase().includes(q)) return true;
      if (p.persona_prompt?.toLowerCase().includes(q)) return true;
      if (p.core_values?.some((v) => v.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [personas, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "archetype":
          av = (a.archetype ?? "").toLowerCase();
          bv = (b.archetype ?? "").toLowerCase();
          break;
        case "reactivity":
          av = a.reactivity_baseline;
          bv = b.reactivity_baseline;
          break;
        case "sophistication":
          av = a.sophistication;
          bv = b.sophistication;
          break;
        case "affinity":
          av = a.brand_affinity;
          bv = b.brand_affinity;
          break;
        case "values":
          av = (a.core_values ?? []).join(",").toLowerCase();
          bv = (b.core_values ?? []).join(",").toLowerCase();
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "archetype" || key === "values" ? "asc" : "desc");
    }
    setPage(0);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        animation: "convo-fade-up 320ms cubic-bezier(0.215, 0.61, 0.355, 1) both",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="mono-label">Audience</span>
          <h1
            style={{
              marginTop: 8,
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(2rem, 4vw, 2.6rem)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "var(--text-primary)",
            }}
          >
            {audience.name}
          </h1>
          <p
            style={{
              marginTop: 6,
              fontFamily: "var(--font-data), monospace",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
            }}
            className="tabular-nums"
          >
            {personas.length} personas · derived{" "}
            {audience.platform ? `for ${audience.platform}` : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onDownloadCsv}
            disabled={personas.length === 0}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "10px 18px",
              fontSize: 14,
              color: "var(--text-primary)",
              cursor: personas.length === 0 ? "not-allowed" : "pointer",
              opacity: personas.length === 0 ? 0.5 : 1,
              transition: "background 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (personas.length === 0) return;
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--bg-subtle)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--border-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--border)";
            }}
          >
            Download .csv ↓
          </button>
          <button
            type="button"
            onClick={onUseInChat}
            disabled={personas.length === 0}
            style={{
              background: "var(--ink)",
              color: "var(--butter-deep)",
              border: "none",
              borderRadius: 999,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 500,
              cursor: personas.length === 0 ? "not-allowed" : "pointer",
              opacity: personas.length === 0 ? 0.5 : 1,
              transition: "transform 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (personas.length === 0) return;
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(0)";
            }}
          >
            Use in active chat →
          </button>
        </div>
      </header>

      {loading ? (
        <div
          style={{
            padding: "24px",
            borderRadius: 14,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-data), monospace",
            fontSize: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          Loading personas…
        </div>
      ) : error ? (
        <div
          role="alert"
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            background: "var(--coral-muted)",
            border: "1px solid rgba(249, 112, 102, 0.2)",
            color: "var(--coral)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search by name, value, or voice…"
              style={{
                flex: 1,
                minWidth: 240,
                maxWidth: 420,
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 14,
                color: "var(--text-primary)",
                outline: "none",
                fontFamily: "var(--font-body), system-ui, sans-serif",
              }}
              aria-label="Search personas"
            />
            <span
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-data), monospace",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
              }}
            >
              {sorted.length}
              {sorted.length !== personas.length
                ? ` of ${personas.length}`
                : ""}{" "}
              personas
            </span>
          </div>

          <div
            style={{
              borderRadius: 14,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 760,
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--bg-subtle)",
                      fontFamily: "var(--font-data), monospace",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <Th
                      label="Name / Role"
                      sortKey="archetype"
                      currentKey={sortKey}
                      direction={sortDir}
                      onClick={() => toggleSort("archetype")}
                      width="34%"
                    />
                    <Th
                      label="Reactivity"
                      sortKey="reactivity"
                      currentKey={sortKey}
                      direction={sortDir}
                      onClick={() => toggleSort("reactivity")}
                      width="14%"
                      align="right"
                    />
                    <Th
                      label="Sophistication"
                      sortKey="sophistication"
                      currentKey={sortKey}
                      direction={sortDir}
                      onClick={() => toggleSort("sophistication")}
                      width="14%"
                      align="right"
                    />
                    <Th
                      label="Affinity"
                      sortKey="affinity"
                      currentKey={sortKey}
                      direction={sortDir}
                      onClick={() => toggleSort("affinity")}
                      width="12%"
                      align="right"
                    />
                    <Th
                      label="Core values"
                      sortKey="values"
                      currentKey={sortKey}
                      direction={sortDir}
                      onClick={() => toggleSort("values")}
                      width="26%"
                    />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p, i) => {
                    const aff = describeAffinity(p.brand_affinity);
                    const voice = p.persona_prompt
                      ?.replace(/^You write things like:\s*/i, "")
                      .replace(/^"|"$/g, "")
                      .trim();
                    return (
                      <tr
                        key={p.id ?? `${pageStart + i}`}
                        style={{
                          borderTop: "1px solid var(--border)",
                          transition: "background 120ms ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            "var(--bg-subtle)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            "transparent";
                        }}
                      >
                        <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                          <div
                            style={{
                              fontWeight: 500,
                              color: "var(--text-primary)",
                            }}
                          >
                            {p.archetype || "Unlabelled"}
                          </div>
                          {voice ? (
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 12,
                                color: "var(--text-tertiary)",
                                fontStyle: "italic",
                                fontFamily: "var(--font-display), Georgia, serif",
                                lineHeight: 1.4,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              &ldquo;{voice}&rdquo;
                            </div>
                          ) : null}
                        </td>
                        <td
                          className="tabular-nums"
                          style={{
                            padding: "12px 14px",
                            textAlign: "right",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-data), monospace",
                          }}
                        >
                          {Math.round(p.reactivity_baseline * 100)}
                        </td>
                        <td
                          className="tabular-nums"
                          style={{
                            padding: "12px 14px",
                            textAlign: "right",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-data), monospace",
                          }}
                        >
                          {Math.round(p.sophistication * 100)}
                        </td>
                        <td
                          className="tabular-nums"
                          style={{
                            padding: "12px 14px",
                            textAlign: "right",
                            color: aff.color,
                            fontFamily: "var(--font-data), monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.brand_affinity > 0 ? "+" : ""}
                          {p.brand_affinity.toFixed(2)}
                          <div
                            style={{
                              fontSize: 10,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              color: aff.color,
                              fontWeight: 500,
                              marginTop: 2,
                            }}
                          >
                            {aff.label}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            {(p.core_values ?? []).slice(0, 4).map((v) => (
                              <span
                                key={v}
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "var(--bg-subtle)",
                                  border: "1px solid var(--border)",
                                  fontSize: 11,
                                  color: "var(--text-secondary)",
                                  fontFamily: "var(--font-data), monospace",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "32px 14px",
                          textAlign: "center",
                          color: "var(--text-tertiary)",
                          fontStyle: "italic",
                        }}
                      >
                        No personas match &ldquo;{search}&rdquo;.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {sorted.length > PAGE_SIZE ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                fontFamily: "var(--font-data), monospace",
                fontSize: 12,
                letterSpacing: "0.04em",
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
              }}
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={paginationButtonStyle(page === 0)}
              >
                ← Prev
              </button>
              <span className="tabular-nums">
                Page {page + 1} of {totalPages} · rows{" "}
                {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sorted.length)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={paginationButtonStyle(page >= totalPages - 1)}
              >
                Next →
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function paginationButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 12,
    color: disabled ? "var(--text-tertiary)" : "var(--text-primary)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: "var(--font-body), system-ui, sans-serif",
    letterSpacing: "-0.01em",
    textTransform: "none",
  };
}

function Th({
  label,
  sortKey,
  currentKey,
  direction,
  onClick,
  width,
  align,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDirection;
  onClick: () => void;
  width: string;
  align?: "left" | "right";
}) {
  const active = sortKey === currentKey;
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: "10px 14px",
        width,
        fontWeight: active ? 600 : 500,
        color: active ? "var(--text-primary)" : "var(--text-tertiary)",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={onClick}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          justifyContent: align === "right" ? "flex-end" : "flex-start",
        }}
      >
        {label}
        {active ? (
          <span
            aria-hidden="true"
            style={{ fontSize: 10, opacity: 0.7 }}
          >
            {direction === "asc" ? "▲" : "▼"}
          </span>
        ) : null}
      </span>
    </th>
  );
}

export function buildPersonaCsv(
  audience: AudienceSummary,
  personas: Persona[]
): string {
  const escape = (raw: unknown): string => {
    const str = String(raw ?? "");
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const header = [
    "Archetype",
    "Reactivity (0-100)",
    "Sophistication (0-100)",
    "Brand affinity (-1..1)",
    "Affinity label",
    "Core values",
    "Voice",
  ];
  const rows = personas.map((p) => {
    const aff = describeAffinity(p.brand_affinity);
    const voice = p.persona_prompt
      ?.replace(/^You write things like:\s*/i, "")
      .replace(/^"|"$/g, "")
      .trim();
    return [
      p.archetype ?? "",
      Math.round(p.reactivity_baseline * 100),
      Math.round(p.sophistication * 100),
      p.brand_affinity.toFixed(3),
      aff.label,
      (p.core_values ?? []).join("; "),
      voice ?? "",
    ]
      .map(escape)
      .join(",");
  });
  void audience;
  return [header.map(escape).join(","), ...rows].join("\n");
}
