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
  view: "chat" | "audience";
  viewedAudienceId: string | null;
  audiences: AudienceSummary[];
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onViewAudience: (audience: AudienceSummary) => void;
}

export default function Sidebar({
  email,
  chats,
  activeChatId,
  view,
  viewedAudienceId,
  audiences,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onViewAudience,
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
            transition: "transform 150ms ease",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(-1px)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(0)")
          }
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
                const active = view === "chat" && chat.id === activeChatId;
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
              {audiences.map((a) => {
                const ready = a.status === "ready";
                const active = view === "audience" && viewedAudienceId === a.id;
                return (
                  <li key={a.id}>
                    <AudienceRow
                      audience={a}
                      active={active}
                      ready={ready}
                      onClick={() => onViewAudience(a)}
                    />
                  </li>
                );
              })}
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
        transition: "background 160ms cubic-bezier(0.215, 0.61, 0.355, 1)",
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

function AudienceRow({
  audience,
  active,
  ready,
  onClick,
}: {
  audience: AudienceSummary;
  active: boolean;
  ready: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={ready ? onClick : undefined}
      onKeyDown={(e) => {
        if (!ready) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-disabled={!ready}
      title={
        ready
          ? "View audience personas"
          : `${audience.status} — wait for ready`
      }
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        background: active ? "var(--surface)" : "transparent",
        cursor: ready ? "pointer" : "not-allowed",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        transition: "background 160ms cubic-bezier(0.215, 0.61, 0.355, 1)",
        boxShadow: active
          ? "0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)"
          : "none",
        opacity: ready ? 1 : 0.6,
      }}
      onMouseEnter={(e) => {
        if (ready && !active) {
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
          color: ready ? "var(--text-primary)" : "var(--text-tertiary)",
          fontWeight: active ? 500 : 400,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {audience.name}
      </span>
      <span
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.04em",
          color: ready ? "var(--text-tertiary)" : "var(--accent)",
          textTransform: "uppercase",
        }}
      >
        {ready ? `${audience.row_count ?? 0} personas` : audience.status}
      </span>
    </div>
  );
}
