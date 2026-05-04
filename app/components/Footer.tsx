import Link from "next/link";
import Reveal from "./Reveal";

const LINK_GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Playground", href: "/#playground" },
      { label: "Docs", href: "/docs" },
      { label: "API keys", href: "/keys" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Waitlist", href: "/waitlist" },
      { label: "Sign in", href: "/login" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Elsewhere",
    links: [
      { label: "Contact", href: "mailto:luke@atharias.dev" },
    ],
  },
];

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: 48,
        background: "var(--ink)",
        color: "#F5F4F2",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="mx-auto max-w-[1200px] px-6"
        style={{ paddingTop: 72, paddingBottom: 24, position: "relative" }}
      >
        <div
          style={{
            display: "grid",
            gap: 48,
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
            alignItems: "flex-start",
          }}
        >
          <div>
            <span
              className="mono-label"
              style={{ color: "var(--butter-deep)" }}
            >
              Atharias · 2026
            </span>
            <p
              style={{
                marginTop: 18,
                fontSize: 17,
                lineHeight: 1.5,
                color: "rgba(245, 244, 242, 0.78)",
                maxWidth: 380,
                fontFamily: "var(--font-display), Georgia, serif",
                fontStyle: "italic",
                letterSpacing: "-0.01em",
              }}
            >
              Built for people who&apos;d rather not trend.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 24,
            }}
          >
            {LINK_GROUPS.map((group) => (
              <div key={group.title}>
                <span
                  style={{
                    fontFamily: "var(--font-data), monospace",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(245, 244, 242, 0.5)",
                  }}
                >
                  {group.title}
                </span>
                <ul
                  style={{
                    marginTop: 14,
                    listStyle: "none",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {group.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="footer-link"
                        style={{
                          fontSize: 14,
                          color: "rgba(245, 244, 242, 0.85)",
                          textDecoration: "none",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Oversized wordmark */}
        <Reveal
          className="reveal-wordmark"
          threshold={0.25}
          style={{
            marginTop: 64,
            paddingTop: 32,
            borderTop: "1px solid rgba(245, 244, 242, 0.12)",
            position: "relative",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "block",
              fontFamily: "var(--font-display), Georgia, serif",
              fontStyle: "italic",
              fontSize: "clamp(5rem, 18vw, 16rem)",
              lineHeight: 0.86,
              letterSpacing: "-0.06em",
              color: "var(--butter-deep)",
              userSelect: "none",
              whiteSpace: "nowrap",
              paddingBottom: "0.08em",
            }}
          >
            Atharias.
          </span>
        </Reveal>
      </div>
    </footer>
  );
}
