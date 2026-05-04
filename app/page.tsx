import Footer from "./components/Footer";
import HeroSection from "./components/HeroSection";
import HowItWorks from "./components/HowItWorks";
import MockedPlayground from "./components/MockedPlayground";

export default function Home() {
  return (
    <div style={{ overflowX: "clip" }}>
      <HeroSection />
      <HowItWorks />
      <MockedPlayground slug="home" />
      <Footer />
    </div>
  );
}
