"use client";

import Link from "next/link";
import {
  type AudienceSummary,
  type ChatState,
  renderChatTitle,
} from "./types";

interface SidebarProps {
  email: string;
  chats: ChatState[];
  activeChatId: string;
  audiences: AudienceSummary[];
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onPickAudienceForActive: (audience: AudienceSummary) => void;
}

export default function Sidebar({
  email,
  chats,
  activeChatId,
  audiences,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onPickAudienceForActive,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: 264,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--bg-subtle)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        padding: "20px 14px 14px",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingLeft: 6,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            textDecoration: "none",
          }}
        >
          Atharias
        </Link>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          style={{
            background: "var(--ink)",
            color: "var(--butter-deep)",
            border: "none",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          + New chat
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          paddingRight: 4,
        }}
      >
        <Section title="Chats">
          {chats.length === 0 ? (
            <Empty text="No chats yet." />
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {chats.map((chat) => {
                const active = chat.id === activeChatId;
                return (
                  <li key={chat.id}>
                    <ChatRow
                      chat={chat}
                      active={active}
                      onClick={() => onSelectChat(chat.id)}
                      onDelete={() => onDeleteChat(chat.id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Audiences">
          {audiences.length === 0 ? (
            <Empty text="Upload one in any chat." />
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {audiences.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onPickAudienceForActive(a)}
                    disabled={a.status !== "ready"}
                    title={
                      a.status !== "ready"
                        ? `${a.status} — wait for ready`
                        : "Use this audience in the active chat"
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      padding: "8px 10px",
                      borderRadius: 8,
                      fontSize: 13,
                      color:
                        a.status === "ready"
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                      cursor: a.status === "ready" ? "pointer" : "not-allowed",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (a.status === "ready") {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--surface)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "transparent";
                    }}
                  >
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.name}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontFamily: "var(--font-data), monospace",
                        fontSize: 10,
                        letterSpacing: "0.04em",
                        color:
                          a.status === "ready"
                            ? "var(--text-tertiary)"
                            : "var(--accent)",
                        textTransform: "uppercase",
                      }}
                    >
                      {a.status === "ready"
                        ? `${a.row_count ?? 0} personas`
                        : a.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontFamily: "var(--font-data), monospace",
          fontSize: 11,
          letterSpacing: "0.04em",
          color: "var(--text-tertiary)",
        }}
      >
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            paddingLeft: 6,
          }}
        >
          {email}
        </span>
        <Link
          href="/audiences"
          style={{
            color: "var(--text-secondary)",
            textDecoration: "none",
            paddingLeft: 6,
            fontSize: 11,
          }}
        >
          Manage audiences →
        </Link>
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          paddingLeft: 6,
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p
      style={{
        fontSize: 12,
        color: "var(--text-tertiary)",
        padding: "6px 10px",
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

function ChatRow({
  chat,
  active,
  onClick,
  onDelete,
}: {
  chat: ChatState;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const inFlight = chat.variants.some(
    (v) => v.status === "running" || v.status === "queued"
  );
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        position: "relative",
        padding: "8px 30px 8px 10px",
        borderRadius: 8,
        background: active ? "var(--surface)" : "transparent",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        transition: "background 120ms ease",
        boxShadow: active
          ? "0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)"
          : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLDivElement).style.background = "var(--surface)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "var(--text-primary)",
          fontWeight: active ? 500 : 400,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {renderChatTitle(chat)}
      </span>
      <span
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.04em",
          color: inFlight ? "var(--accent)" : "var(--text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        {inFlight
          ? "running…"
          : chat.audienceName
            ? chat.audienceName
            : "no audience"}
      </span>
      <button
        type="button"
        aria-label="Delete chat"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          background: "transparent",
          border: "none",
          color: "var(--text-tertiary)",
          fontSize: 14,
          lineHeight: 1,
          padding: 4,
          borderRadius: 4,
          cursor: "pointer",
          opacity: 0.6,
        }}
      >
        ×
      </button>
    </div>
  );
}
