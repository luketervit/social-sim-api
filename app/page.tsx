import Footer from "./components/Footer";
import HeroSection from "./components/HeroSection";
import HowItWorks from "./components/HowItWorks";
import MockedPlayground from "./components/MockedPlayground";
import { getLandingData } from "./lib/landing-data";

export default async function Home() {
  const { user } = await getLandingData();

  return (
    <div style={{ overflowX: "clip" }}>
      <HeroSection />
      <HowItWorks />
      <MockedPlayground slug="home" isSignedIn={!!user} />
      <Footer />
    </div>
  );
}
