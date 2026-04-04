import ParticleBackground from "@/components/ParticleBackground";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import QuoteEngine from "@/components/QuoteEngine";
import BusinessForm from "@/components/BusinessForm";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="ships-app min-h-screen bg-background relative overflow-x-hidden">
    <ParticleBackground />
    <div className="relative z-10">
      <Navbar />
      <HeroSection />
      <HowItWorks />
      <QuoteEngine />
      <BusinessForm />
      <Footer />
    </div>
  </div>
);

export default Index;
