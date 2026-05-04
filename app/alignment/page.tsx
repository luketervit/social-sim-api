import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import PlaygroundSection from "../components/PlaygroundSection";
import { ALIGNMENT_CONFIG } from "../components/industry-configs";
import { getLandingData } from "../lib/landing-data";

export const metadata: Metadata = {
  title: "Atharias for Research Labs — A million synthetic users, one API call",
  description:
    "Population-scale synthetic agent simulations for contagion, persuasion, alignment, and content studies.",
};

export default async function AlignmentPage() {
  const { user, audiences } = await getLandingData();
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={ALIGNMENT_CONFIG} />
      <HowItWorks />
      <PlaygroundSection
        audiences={audiences}
        isSignedIn={!!user}
        defaultPrompt="A new study finds that exposure to AI-generated content reduces trust in human-written news by 23%."
        defaultPlatform="reddit"
      />
      <Footer />
    </div>
  );
}
