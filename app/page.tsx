import Audiences from "./components/Audiences";
import Footer from "./components/Footer";
import HeroSection from "./components/HeroSection";
import HowItWorks from "./components/HowItWorks";
import Manifesto from "./components/Manifesto";
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
      <Manifesto />
      <HowItWorks />
      <Audiences />
      <PlaygroundSection
        audiences={audiences?.length ? audiences : FALLBACK_AUDIENCES}
        isSignedIn={!!user}
      />
      <PricingSection />
      <Footer />
    </div>
  );
}
