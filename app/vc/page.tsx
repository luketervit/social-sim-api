import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import PlaygroundSection from "../components/PlaygroundSection";
import { VC_CONFIG } from "../components/industry-configs";
import { getLandingData } from "../lib/landing-data";

export const metadata: Metadata = {
  title: "Atharias for Investors — Stress-test the portfolio bombshell",
  description:
    "Layoffs, down rounds, pivots — preview your portfolio's public reaction before they ship the announcement.",
};

export default async function VcPage() {
  const { user, audiences } = await getLandingData();
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={VC_CONFIG} />
      <HowItWorks />
      <PlaygroundSection audiences={audiences} isSignedIn={!!user} />
      <Footer />
    </div>
  );
}
