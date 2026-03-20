"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-[400px] pt-24 text-center">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--accent-muted)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 4l8 5 8-5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="1" y="3" width="18" height="14" rx="2" stroke="var(--accent)" strokeWidth="1.5"/>
          </svg>
        </div>
        <h1
          className="text-[24px]"
          style={{ fontWeight: "var(--font-weight-bold)" as unknown as number, letterSpacing: "-0.03em" }}
        >
          Check your email
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          We sent a magic link to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>.
          Click the link to sign in.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[400px] pt-24">
      <h1
        className="text-[28px]"
        style={{ fontWeight: "var(--font-weight-bold)" as unknown as number, letterSpacing: "-0.03em" }}
      >
        Sign in to Atharias
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Enter your email to receive a magic link.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
        <label htmlFor="email" className="sr-only">Email address</label>
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
          {loading ? "Sending\u2026" : "Continue with email"}
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
    </div>
  );
}
