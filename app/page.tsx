import AudienceDNA from "./components/AudienceDNA";
import HeroSection from "./components/HeroSection";
import HowItWorks from "./components/HowItWorks";
import PlaygroundSection from "./components/PlaygroundSection";
import PricingSection from "./components/PricingSection";
import SocialProofStrip from "./components/SocialProofStrip";
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
      <SocialProofStrip />
      <HowItWorks />
      <PlaygroundSection
        audiences={audiences?.length ? audiences : FALLBACK_AUDIENCES}
        isSignedIn={!!user}
      />
      <AudienceDNA />
      <PricingSection />
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "56px 0 40px" }}>
      <div
        className="mx-auto max-w-[1200px] px-6"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "var(--border-hairline) solid var(--border)",
          paddingTop: 24,
        }}
      >
        <span
          style={{
            fontSize: 13,
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
