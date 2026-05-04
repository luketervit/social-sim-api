import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import PlaygroundSection from "../components/PlaygroundSection";
import { COMMS_CONFIG } from "../components/industry-configs";
import { getLandingData } from "../lib/landing-data";

export const metadata: Metadata = {
  title: "Atharias for Internal Comms — Rehearse the all-hands",
  description:
    "Layoffs, RTO mandates, comp changes. Rehearse the leak before it leaks.",
};

export default async function CommsPage() {
  const { user, audiences } = await getLandingData();
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={COMMS_CONFIG} />
      <HowItWorks />
      <PlaygroundSection audiences={audiences} isSignedIn={!!user} />
      <Footer />
    </div>
  );
}
