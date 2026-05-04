import type { Metadata } from "next";
import Footer from "../components/Footer";
import HowItWorks from "../components/HowItWorks";
import IndustryHero from "../components/IndustryHero";
import PlaygroundSection from "../components/PlaygroundSection";
import { PM_CONFIG } from "../components/industry-configs";
import { getLandingData } from "../lib/landing-data";

export const metadata: Metadata = {
  title: "Atharias for Product Marketing — QA the launch post",
  description:
    "Drop the draft. See the objections in 30 seconds. Iterate before legal does.",
};

export default async function PmPage() {
  const { user, audiences } = await getLandingData();
  return (
    <div style={{ overflowX: "clip" }}>
      <IndustryHero config={PM_CONFIG} />
      <HowItWorks />
      <PlaygroundSection
        audiences={audiences}
        isSignedIn={!!user}
        defaultPrompt="Introducing our new pricing — Pro is now $39/mo, with the legacy plan grandfathered for 12 months."
        defaultPlatform="twitter"
        defaultAudienceId="engineers"
      />
      <Footer />
    </div>
  );
}
