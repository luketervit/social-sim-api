import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import MockedPlayground from "../components/MockedPlayground";
import { FOUNDER_CONFIG } from "../components/industry-configs";

export const metadata: Metadata = {
  title: "Atharias for Founders — Hedge your launch tweet",
  description:
    "Run your launch post through 1,000 simulated users in 30 seconds. See the dunks before the internet does.",
};

export default function FounderPage() {
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={FOUNDER_CONFIG} />
      <HowItWorks />
      <MockedPlayground slug="founder" />
      <Footer />
    </div>
  );
}
