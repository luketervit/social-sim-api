"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

interface DashboardProps {
  apiKey: string;
  email: string;
  credits: number;
  createdAt: string;
  userEmail: string;
}

export default function DashboardClient({
  apiKey,
  email,
  credits,
  createdAt,
  userEmail,
}: DashboardProps) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const router = useRouter();

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const maskedKey = apiKey.slice(0, 8) + "\u2022".repeat(32) + apiKey.slice(-4);
  const creditsPercent = Math.min(100, (credits / 100) * 100);
  const createdDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-[560px] pt-16 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[28px]"
            style={{
              fontWeight: "var(--font-weight-bold)" as unknown as number,
              letterSpacing: "-0.03em",
            }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            {userEmail}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="btn-secondary"
          style={{ padding: "6px 14px", minHeight: "auto", fontSize: "13px" }}
        >
          Sign out
        </button>
      </div>

      {/* API Key Card */}
      <div className="panel mt-10 p-6">
        <div className="flex items-center justify-between">
          <h2
            className="text-[14px]"
            style={{
              fontWeight: "var(--font-weight-semibold)" as unknown as number,
              color: "var(--text-primary)",
            }}
          >
            API Key
          </h2>
          <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            Created {createdDate}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <code
            className="flex-1 break-all rounded-md px-3 py-2.5 text-[13px]"
            style={{ background: "var(--bg-element)", color: "var(--text-primary)" }}
          >
            {showKey ? apiKey : maskedKey}
          </code>
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="btn-secondary"
            style={{ padding: "8px 12px", minHeight: "auto", fontSize: "13px" }}
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary"
            style={{ padding: "8px 12px", minHeight: "auto", fontSize: "13px" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Credits Card */}
      <div className="panel mt-4 p-6">
        <div className="flex items-center justify-between">
          <h2
            className="text-[14px]"
            style={{
              fontWeight: "var(--font-weight-semibold)" as unknown as number,
              color: "var(--text-primary)",
            }}
          >
            Credits
          </h2>
          <span
            className="tabular-nums text-[24px]"
            style={{
              fontWeight: "var(--font-weight-bold)" as unknown as number,
              color: credits > 20 ? "var(--text-primary)" : credits > 0 ? "#eab308" : "#ef4444",
            }}
          >
            {credits}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--bg-element)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${creditsPercent}%`,
              background:
                credits > 20 ? "var(--accent)" : credits > 0 ? "#eab308" : "#ef4444",
              transition: "width 500ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          />
        </div>

        <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {credits > 0
            ? `${credits} simulation${credits !== 1 ? "s" : ""} remaining on your free trial.`
            : "You\u2019ve used all your free credits."}
        </p>

        <button
          type="button"
          disabled
          className="btn-primary mt-4 w-full"
          style={{ opacity: 0.5, cursor: "not-allowed" }}
        >
          Buy more credits (coming soon)
        </button>
      </div>

      {/* Quick start */}
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
        <div className="code-block mt-3">
          <pre className="whitespace-pre-wrap text-[12px]">
            <code>{`curl -N -X POST https://social-sim-api.vercel.app/api/v1/simulate \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "audience_id": "toxic_gamers",
    "platform": "twitter",
    "input": "Your message here"
  }'`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
