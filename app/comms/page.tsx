import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import MockedPlayground from "../components/MockedPlayground";
import { COMMS_CONFIG } from "../components/industry-configs";

export const metadata: Metadata = {
  title: "Atharias for Internal Comms — Rehearse the all-hands",
  description:
    "Layoffs, RTO mandates, comp changes. Rehearse the leak before it leaks.",
};

export default function CommsPage() {
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={COMMS_CONFIG} />
      <HowItWorks />
      <MockedPlayground slug="comms" />
      <Footer />
    </div>
  );
}
