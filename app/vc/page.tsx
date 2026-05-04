import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import MockedPlayground from "../components/MockedPlayground";
import { VC_CONFIG } from "../components/industry-configs";

export const metadata: Metadata = {
  title: "Atharias for Investors — Stress-test the portfolio bombshell",
  description:
    "Layoffs, down rounds, pivots — preview your portfolio's public reaction before they ship the announcement.",
};

export default function VcPage() {
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={VC_CONFIG} />
      <HowItWorks />
      <MockedPlayground slug="vc" />
      <Footer />
    </div>
  );
}
