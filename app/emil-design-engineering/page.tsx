import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import MockedPlayground from "../components/MockedPlayground";
import { EMIL_CONFIG } from "../components/industry-configs";
import { getLandingData } from "../lib/landing-data";

export const metadata: Metadata = {
  title: "Atharias for Emil — Pre-test the launch tweet on synthetic engineers",
  description:
    "Design engineers ship to brutal audiences. Drop your launch tweet, watch 60 synthetic engineers react across 10 rounds in 15 seconds.",
};

export default async function EmilPage() {
  const { user } = await getLandingData();
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={EMIL_CONFIG} />
      <HowItWorks />
      <MockedPlayground slug="emil-design-engineering" isSignedIn={!!user} />
      <Footer />
    </div>
  );
}
