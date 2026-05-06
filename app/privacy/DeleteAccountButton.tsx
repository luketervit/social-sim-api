"use client";

import { useState } from "react";

type State = "idle" | "confirming" | "loading" | "done" | "error" | "anon";

export default function DeleteAccountButton() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function requestDeletion() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/v1/delete-account", {
        method: "POST",
      });
      if (res.status === 401) {
        setState("anon");
        setMessage(
          "You're not signed in. Sign in first, then come back here to request deletion. If you've already deleted your account or want to delete an unverified email, email luke@atharias.dev."
        );
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setState("error");
        setMessage(
          payload?.error ?? "Could not record your deletion request."
        );
        return;
      }
      setState("done");
      setMessage(
        "Deletion request received. Your access has been revoked and we'll delete your data within 30 days. Check your inbox for confirmation."
      );
    } catch (err) {
      console.error(err);
      setState("error");
      setMessage("Network error — try again, or email luke@atharias.dev.");
    }
  }

  if (state === "done" || state === "anon" || state === "error") {
    return (
      <div
        role="status"
        style={{
          marginTop: 8,
          padding: "12px 14px",
          borderRadius: 12,
          fontSize: 13,
          background:
            state === "done"
              ? "var(--mint-muted)"
              : state === "anon"
                ? "var(--bg-subtle)"
                : "var(--coral-muted)",
          color:
            state === "done"
              ? "#1f8a55"
              : state === "anon"
                ? "var(--text-secondary)"
                : "var(--coral)",
          border: "1px solid var(--border)",
        }}
      >
        {message}
      </div>
    );
  }

  if (state === "confirming") {
    return (
      <div
        style={{
          marginTop: 8,
          padding: "14px 16px",
          borderRadius: 12,
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
          }}
        >
          This will revoke your access immediately and queue your account for
          deletion. There is no undo. Sure?
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={requestDeletion}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid var(--coral, #f97066)",
              background: "var(--coral, #f97066)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Yes, delete my data
          </button>
          <button
            type="button"
            onClick={() => setState("idle")}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("confirming")}
      disabled={state === "loading"}
      style={{
        marginTop: 8,
        padding: "10px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 500,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-primary)",
        cursor: "pointer",
        alignSelf: "flex-start",
      }}
    >
      {state === "loading" ? "Sending request…" : "Request deletion"}
    </button>
  );
}
