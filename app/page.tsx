import AudienceDNA from "./components/AudienceDNA";
import GhostShift from "./components/GhostShift";
import GraphDemo from "./components/GraphDemo";
import HeroSection from "./components/HeroSection";
import JourneySection from "./components/JourneySection";
import PlaygroundSection from "./components/PlaygroundSection";
import PricingSection from "./components/PricingSection";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

const FALLBACK_AUDIENCES = [
  { id: "genz", name: "Gen Z" },
  { id: "toxic_gamers", name: "Toxic Gamers" },
  { id: "engineers", name: "Engineers" },
  { id: "small_town", name: "Small Town" },
  { id: "company_internal", name: "Company Internal" },
];

export default async function Home() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const db = supabaseAdmin();
  const { data: audiences } = await db
    .from("audiences")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div style={{ overflowX: "clip" }}>
      <HeroSection />
      <JourneySection />
      <PlaygroundSection
        audiences={audiences?.length ? audiences : FALLBACK_AUDIENCES}
        isSignedIn={!!user}
      />
      <GraphDemo />
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
