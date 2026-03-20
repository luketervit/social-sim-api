import HeroSection from "./components/HeroSection";
import AudienceDNA from "./components/AudienceDNA";
import GhostShift from "./components/GhostShift";
import PricingSection from "./components/PricingSection";

export default function Home() {
  return (
    <div style={{ overflowX: "clip" }}>
      <HeroSection />
      <AudienceDNA />
      <GhostShift />
      <PricingSection />
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{
        padding: "56px 0 40px",
      }}
    >
      <div
        className="mx-auto max-w-[1180px] px-6"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(39,39,42,0.65)",
          paddingTop: 24,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--text-tertiary)",
          }}
        >
          Atharias
        </span>
      </div>
    </footer>
  );
}
