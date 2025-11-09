import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import Hero from '@/components/landing/hero';
import HowItWorks from '@/components/landing/how-it-works';
import WhyCoachesLoveIt from '@/components/landing/why-teachers-love-it';
import BuiltOnGoogle from '@/components/landing/built-on-google';
import ForEveryClassroom from '@/components/landing/for-every-classroom';
import Testimonials from '@/components/landing/testimonials';
import Pricing from '@/components/landing/pricing';
import FAQ from '@/components/landing/faq';
import TrustLogos from '@/components/landing/trust-logos';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustLogos />
        <HowItWorks />
        <WhyCoachesLoveIt />
        <BuiltOnGoogle />
        <ForEveryClassroom />
        <Testimonials />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
