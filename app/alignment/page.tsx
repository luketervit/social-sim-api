import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import MockedPlayground from "../components/MockedPlayground";
import { ALIGNMENT_CONFIG } from "../components/industry-configs";

export const metadata: Metadata = {
  title: "Atharias for Research Labs — A million synthetic users, one API call",
  description:
    "Population-scale synthetic agent simulations for contagion, persuasion, alignment, and content studies.",
};

export default function AlignmentPage() {
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={ALIGNMENT_CONFIG} />
      <HowItWorks />
      <MockedPlayground slug="alignment" />
      <Footer />
    </div>
  );
}
