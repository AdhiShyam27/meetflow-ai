import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import LogoCloud from "@/components/LogoCloud";
import Features from "@/components/Features";
import Integrations from "@/components/Integrations";
import Pricing from "@/components/Pricing";
import Security from "@/components/Security";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      <Navbar />
      <Hero />
      <LogoCloud />
      <Features />
      <Integrations />
      <Pricing />
      <Security />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
