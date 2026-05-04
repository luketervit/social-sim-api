import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import MockedPlayground from "../components/MockedPlayground";
import { PM_CONFIG } from "../components/industry-configs";

export const metadata: Metadata = {
  title: "Atharias for Product Marketing — QA the launch post",
  description:
    "Drop the draft. See the objections in 30 seconds. Iterate before legal does.",
};

export default function PmPage() {
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={PM_CONFIG} />
      <HowItWorks />
      <MockedPlayground slug="pm" />
      <Footer />
    </div>
  );
}
