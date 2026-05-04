import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import PlaygroundSection from "../components/PlaygroundSection";
import { FOUNDER_CONFIG } from "../components/industry-configs";
import { getLandingData } from "../lib/landing-data";

export const metadata: Metadata = {
  title: "Atharias for Founders — Hedge your launch tweet",
  description:
    "Run your launch post through 1,000 simulated users in 30 seconds. See the dunks before the internet does.",
};

export default async function FounderPage() {
  const { user, audiences } = await getLandingData();
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={FOUNDER_CONFIG} />
      <HowItWorks />
      <PlaygroundSection
        audiences={audiences}
        isSignedIn={!!user}
        defaultPrompt="we just shipped v2 — bigger context, faster, $19/mo from today"
        defaultPlatform="twitter"
      />
      <Footer />
    </div>
  );
}
