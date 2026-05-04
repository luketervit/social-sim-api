import Footer from "./components/Footer";
import HeroSection from "./components/HeroSection";
import HowItWorks from "./components/HowItWorks";
import PlaygroundSection from "./components/PlaygroundSection";
import { getLandingData } from "./lib/landing-data";

export default async function Home() {
  const { user, audiences } = await getLandingData();

  return (
    <div style={{ overflowX: "clip" }}>
      <HeroSection />
      <HowItWorks />
      <PlaygroundSection audiences={audiences} isSignedIn={!!user} />
      <Footer />
    </div>
  );
}
