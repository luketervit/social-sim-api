"use client";

import { useEffect, useState } from "react";
import { MascotVideo } from "@/app/components/Mascot";

const ONBOARDING_KEY = "atharias_onboarded_v1";

interface OnboardingModalProps {
  /** When true, force-shows the modal regardless of localStorage. */
  forceOpen?: boolean;
  onDismiss?: () => void;
}

interface CardSpec {
  eyebrow: string;
  title: string;
  body: string;
  illustration: React.ReactNode;
}

const CARDS: CardSpec[] = [
  {
    eyebrow: "Step 1",
    title: "Upload an audience",
    body: "Drop a CSV — LinkedIn connections, customer messages, support tickets, anything text-based. If you have your complete LinkedIn export ZIP, upload that instead: we’ll build personas from connections and attach your real post history for private evals.",
    illustration: <MascotGreeting />,
  },
  {
    eyebrow: "Step 2",
    title: "Pick from your sidebar",
    body: "Every audience you upload shows up in the left sidebar. Click one to use it in the active chat. Open a new chat any time to test against a different audience or platform.",
    illustration: <SidebarIllustration />,
  },
  {
    eyebrow: "Step 3",
    title: "Run sims and compare",
    body: "Paste a draft post and run it through the room. Or have us draft 3 AI variations to A/B test, run them in parallel, and ship the one that lands cleanest.",
    illustration: <CompareIllustration />,
  },
];

export default function OnboardingModal({
  forceOpen,
  onDismiss,
}: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let timeout = 0;
    if (forceOpen) {
      timeout = window.setTimeout(() => setOpen(true), 0);
      return () => window.clearTimeout(timeout);
    }
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(ONBOARDING_KEY);
      if (!seen) {
        timeout = window.setTimeout(() => setOpen(true), 0);
      }
    } catch {
      timeout = window.setTimeout(() => setOpen(true), 0);
    }
    return () => window.clearTimeout(timeout);
  }, [forceOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function dismiss() {
    setClosing(true);
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setStep(0);
      onDismiss?.();
    }, 200);
  }

  if (!open) return null;

  const isLast = step === CARDS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Atharias"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 4vw, 48px)",
      }}
    >
      <div
        aria-hidden="true"
        onClick={dismiss}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(20, 20, 19, 0.42)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: closing
            ? "ob-fade-out 200ms cubic-bezier(0.215, 0.61, 0.355, 1) forwards"
            : "ob-fade-in 220ms cubic-bezier(0.215, 0.61, 0.355, 1) both",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "min(560px, 100%)",
          background: "var(--surface)",
          borderRadius: 24,
          padding: "clamp(28px, 4vw, 40px)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.04), 0 12px 36px rgba(20,20,19,0.18), 0 1px 3px rgba(0,0,0,0.04)",
          animation: closing
            ? "ob-card-out 220ms cubic-bezier(0.215, 0.61, 0.355, 1) forwards"
            : "ob-card-in 360ms cubic-bezier(0.23, 1, 0.32, 1) both",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
            role="tablist"
            aria-label="Onboarding step"
          >
            {CARDS.map((_, i) => {
              const active = i === step;
              return (
                <span
                  key={i}
                  role="tab"
                  aria-selected={active}
                  style={{
                    height: 4,
                    width: active ? 28 : 8,
                    borderRadius: 999,
                    background: active ? "var(--ink)" : "var(--border-hover)",
                    transition: "width 240ms cubic-bezier(0.215, 0.61, 0.355, 1), background 200ms ease",
                  }}
                />
              );
            })}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Skip onboarding"
            style={{
              background: "transparent",
              border: "none",
              padding: "4px 10px",
              fontSize: 12,
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontFamily: "var(--font-data), monospace",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Skip
          </button>
        </div>

        <CardSwitcher step={step} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 28,
          }}
        >
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "10px 18px",
              fontSize: 14,
              color: step === 0 ? "var(--text-tertiary)" : "var(--text-primary)",
              cursor: step === 0 ? "not-allowed" : "pointer",
              opacity: step === 0 ? 0.5 : 1,
              transition: "background 150ms ease, border-color 150ms ease",
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) dismiss();
              else setStep((s) => s + 1);
            }}
            style={{
              background: "var(--ink)",
              color: "var(--butter-deep)",
              border: "none",
              borderRadius: 999,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "transform 150ms ease, background 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(0)";
            }}
          >
            {isLast ? "Get started →" : "Next →"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes ob-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes ob-fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes ob-card-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes ob-card-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-6px) scale(0.99);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"] *,
          [role="dialog"] *::before,
          [role="dialog"] *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function CardSwitcher({ step }: { step: number }) {
  const card = CARDS[step];
  return (
    <div
      key={step}
      style={{
        animation:
          "ob-card-step 320ms cubic-bezier(0.215, 0.61, 0.355, 1) both",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          marginBottom: 22,
          padding: "20px 24px",
          borderRadius: 16,
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          minHeight: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {card.illustration}
      </div>
      <span
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--accent)",
        }}
      >
        {card.eyebrow}
      </span>
      <h2
        style={{
          marginTop: 8,
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "clamp(1.6rem, 3vw, 2rem)",
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          color: "var(--text-primary)",
        }}
      >
        {card.title}
      </h2>
      <p
        style={{
          marginTop: 12,
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--text-secondary)",
        }}
      >
        {card.body}
      </p>

      <style jsx>{`
        @keyframes ob-card-step {
          from {
            opacity: 0;
            transform: translateX(12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

function MascotGreeting() {
  return (
    <MascotVideo
      variant="idle"
      size={128}
      ariaLabel="Atharias mascot greeting you"
    />
  );
}

function UploadIllustration() {
  return (
    <svg viewBox="0 0 360 120" width="100%" style={{ maxWidth: 360 }}>
      <defs>
        <linearGradient id="ob-cream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F5F4F2" />
        </linearGradient>
      </defs>
      <rect
        x="40"
        y="20"
        width="280"
        height="80"
        rx="16"
        fill="url(#ob-cream)"
        stroke="#D4D4D4"
        strokeDasharray="4 4"
      />
      <path
        d="M180 44 L180 76 M168 56 L180 44 L192 56"
        stroke="#7C5CFC"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <text
        x="180"
        y="92"
        textAnchor="middle"
        fontSize="10"
        fontFamily="var(--font-data), monospace"
        fill="#9E9E9E"
        letterSpacing="1.2"
      >
        DROP YOUR CSV HERE
      </text>
    </svg>
  );
}

function SidebarIllustration() {
  return (
    <svg viewBox="0 0 360 120" width="100%" style={{ maxWidth: 360 }}>
      <rect x="40" y="20" width="100" height="80" rx="10" fill="#F5F4F2" stroke="#EBEBEB" />
      <text
        x="50"
        y="38"
        fontSize="9"
        fontFamily="var(--font-data), monospace"
        fill="#9E9E9E"
        letterSpacing="1"
      >
        AUDIENCES
      </text>
      <rect x="50" y="44" width="80" height="14" rx="4" fill="#FFFFFF" stroke="#EBEBEB" />
      <text x="58" y="54" fontSize="9" fontFamily="system-ui" fill="#1A1A1A">
        Connections
      </text>
      <rect x="50" y="62" width="80" height="14" rx="4" fill="#141413" />
      <text x="58" y="72" fontSize="9" fontFamily="system-ui" fill="#E8D27A" fontWeight="600">
        Customers
      </text>
      <rect x="50" y="80" width="80" height="14" rx="4" fill="#FFFFFF" stroke="#EBEBEB" />
      <text x="58" y="90" fontSize="9" fontFamily="system-ui" fill="#1A1A1A">
        Discord export
      </text>
      <path
        d="M148 70 L188 70"
        stroke="#7C5CFC"
        strokeWidth="2"
        strokeLinecap="round"
        markerEnd="url(#arrow)"
      />
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="#7C5CFC" />
        </marker>
      </defs>
      <rect x="200" y="30" width="120" height="60" rx="10" fill="#FFFFFF" stroke="#EBEBEB" />
      <text
        x="210"
        y="46"
        fontSize="9"
        fontFamily="var(--font-data), monospace"
        fill="#9E9E9E"
        letterSpacing="1"
      >
        ACTIVE CHAT
      </text>
      <rect x="210" y="54" width="100" height="22" rx="11" fill="#141413" />
      <text x="220" y="69" fontSize="10" fontFamily="system-ui" fill="#E8D27A" fontWeight="500">
        Customers ×432
      </text>
    </svg>
  );
}

function CompareIllustration() {
  return (
    <svg viewBox="0 0 360 120" width="100%" style={{ maxWidth: 360 }}>
      <rect x="20" y="22" width="100" height="76" rx="12" fill="#FFFFFF" stroke="#EBEBEB" />
      <text x="30" y="40" fontSize="9" fontFamily="var(--font-data), monospace" fill="#9E9E9E" letterSpacing="1">
        ORIGINAL
      </text>
      <rect x="30" y="48" width="80" height="6" rx="3" fill="#C8552B" opacity="0.7" />
      <rect x="30" y="58" width="60" height="6" rx="3" fill="#B23226" opacity="0.7" />
      <rect x="30" y="68" width="40" height="6" rx="3" fill="#6B6B6B" opacity="0.5" />
      <text x="30" y="90" fontSize="9" fontFamily="var(--font-data), monospace" fill="#C8552B">
        62% NEGATIVE
      </text>

      <rect x="130" y="22" width="100" height="76" rx="12" fill="#FFFFFF" stroke="#EBEBEB" />
      <text x="140" y="40" fontSize="9" fontFamily="var(--font-data), monospace" fill="#9E9E9E" letterSpacing="1">
        VARIANT 1
      </text>
      <rect x="140" y="48" width="40" height="6" rx="3" fill="#C8552B" opacity="0.5" />
      <rect x="140" y="58" width="64" height="6" rx="3" fill="#1F8A55" opacity="0.7" />
      <rect x="140" y="68" width="30" height="6" rx="3" fill="#6B6B6B" opacity="0.5" />
      <text x="140" y="90" fontSize="9" fontFamily="var(--font-data), monospace" fill="#1F8A55">
        18% NEGATIVE
      </text>

      <rect x="240" y="22" width="100" height="76" rx="12" fill="#141413" />
      <text x="250" y="40" fontSize="9" fontFamily="var(--font-data), monospace" fill="#E8D27A" letterSpacing="1">
        SHIP THIS
      </text>
      <text x="250" y="62" fontSize="11" fontFamily="var(--font-display), Georgia, serif" fontStyle="italic" fill="rgba(245, 244, 242, 0.92)">
        Variant 1
      </text>
      <text x="250" y="78" fontSize="9" fontFamily="var(--font-data), monospace" fill="rgba(245, 244, 242, 0.55)">
        WINNING DRAFT
      </text>
    </svg>
  );
}
