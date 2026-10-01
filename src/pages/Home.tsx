import { Navbar } from "@/components/Navbar";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { SEOHead } from "@/components/SEOHead";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesStrip } from "@/components/home/FeaturesStrip";
import { CategoriesSection } from "@/components/home/CategoriesSection";
import { SocialProofCounters } from "@/components/home/SocialProofCounters";
import { DealsSection } from "@/components/home/DealsSection";

import { NewArrivalsSection } from "@/components/home/NewArrivalsSection";
import { FeaturedCarousel } from "@/components/home/FeaturedCarousel";
import { RecommendedForYou } from "@/components/home/RecommendedForYou";
import { EngagementSection } from "@/components/home/EngagementSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { CTASection } from "@/components/home/CTASection";
import { Footer } from "@/components/home/Footer";
import { LazyMount } from "@/components/ui/LazyMount";

export default function Home() {

  // Single batched fetch — pulls a slim payload covering the hero, featured carousel,
  // and new arrivals in one round trip. Each section then reads from this cached list.
  const { data: homeProducts } = useQuery({
    queryKey: ["home-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock, featured, created_at, category, description")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const featuredProducts = homeProducts?.filter((p) => p.featured).slice(0, 8) ?? [];
  const newArrivals = homeProducts?.slice(0, 4) ?? [];

  return (
    <div className="min-h-screen bg-background page-enter" id="main-content" role="main">
      <SEOHead
        title="ShopHub — Online Shopping for Electronics, Fashion, Home & More"
        description="Shop the best deals on electronics, clothing, home essentials & more at ShopHub. Curated collections, secure payments, fast delivery & easy returns."
        canonical="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What payment methods does ShopHub accept?",
              acceptedAnswer: { "@type": "Answer", text: "We accept UPI, credit cards, debit cards, net banking, and wallet payments via secure Razorpay gateway. Cash on Delivery is also available on eligible orders." },
            },
            {
              "@type": "Question",
              name: "How fast is delivery?",
              acceptedAnswer: { "@type": "Answer", text: "Most orders are delivered within 3–7 business days across India. Delivery time depends on your location and product availability." },
            },
            {
              "@type": "Question",
              name: "What is the return policy?",
              acceptedAnswer: { "@type": "Answer", text: "We offer easy 7-day returns on most products. Items must be unused and in original packaging. Visit our Refunds & Cancellations page for details." },
            },
            {
              "@type": "Question",
              name: "Do you offer Cash on Delivery?",
              acceptedAnswer: { "@type": "Answer", text: "Yes, Cash on Delivery (COD) is available on eligible orders across most pin codes in India." },
            },
            {
              "@type": "Question",
              name: "Is my payment secure on ShopHub?",
              acceptedAnswer: { "@type": "Answer", text: "Absolutely. All payments are processed through PCI-DSS compliant Razorpay gateway with end-to-end encryption." },
            },
          ],
        }}
      />
      <AnnouncementBar />
      <Navbar />
      <HeroSection />
      <FeaturesStrip />
      <CategoriesSection />
      <DealsSection />
      
      {newArrivals.length > 0 && <NewArrivalsSection products={newArrivals} />}
      <LazyMount minHeight={500}>
        <RecommendedForYou />
      </LazyMount>
      {featuredProducts.length > 0 && (
        <LazyMount minHeight={500}>
          <FeaturedCarousel products={featuredProducts} />
        </LazyMount>
      )}
      <LazyMount minHeight={300}>
        <SocialProofCounters />
      </LazyMount>
      <LazyMount minHeight={500}>
        <EngagementSection />
      </LazyMount>
      <LazyMount minHeight={400}>
        <TestimonialsSection />
      </LazyMount>
      <LazyMount minHeight={300}>
        <CTASection />
      </LazyMount>
      <Footer />
    </div>
  );
}
