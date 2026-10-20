import { Navbar } from "@/components/Navbar";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { RecentlyViewedProducts } from "@/components/home/RecentlyViewedProducts";
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

  const { data: sellerProducts = [] } = useQuery({
    queryKey: ["home-approved-seller-products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).schema("catalog").from("products")
        .select("id,title,category,price,mrp,image_urls,stock_quantity,created_at")
        .eq("status", "approved").gt("stock_quantity", 0)
        .order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: homeSellerFeatures = [] } = useQuery({
    queryKey: ["home-featured-seller-products"],
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db.schema("catalog").from("products")
        .select("id,seller_id,title,category,price,mrp,image_urls,stock_quantity,created_at")
        .eq("status", "approved").eq("featured_on_home", true).gt("stock_quantity", 0)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const eligible = (data ?? []).filter((p: any) => p.image_urls?.[0]);
      const sellerIds = [...new Set(eligible.map((p: any) => p.seller_id))];
      if (!sellerIds.length) return [];
      const { data: sellers, error: sellerError } = await db.schema("seller").from("seller_profiles")
        .select("id,business_name,store_name").in("id", sellerIds);
      if (sellerError) throw sellerError;
      const sellerMap = new Map((sellers ?? []).map((s: any) => [s.id, s]));
      return eligible.map((p: any) => ({ ...p, seller: sellerMap.get(p.seller_id) }))
        .filter((p: any) => p.seller)
        .slice(0, 12);
    },
    staleTime: 60 * 1000,
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
      {sellerProducts.length > 0 && homeSellerFeatures.length === 0 && (
        <section className="container mx-auto px-4 py-10" aria-label="Marketplace seller products">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-semibold uppercase tracking-wider text-primary">Marketplace</p><h2 className="text-2xl font-bold md:text-3xl">From our sellers</h2><p className="text-muted-foreground">Discover approved products from our seller community.</p></div>
            <Button variant="outline" asChild><Link to="/products">View all products</Link></Button>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {sellerProducts.map((product: any) => (
              <Link key={product.id} to={`/marketplace/products/${product.id}`} className="block">
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="aspect-square bg-muted"><img src={product.image_urls?.[0] || "/placeholder.svg"} alt={product.title} loading="lazy" className="h-full w-full object-cover"/></div>
                  <CardContent className="p-3 md:p-4"><h3 className="line-clamp-2 font-semibold">{product.title}</h3><p className="mt-1 text-xs text-muted-foreground">{product.category}</p><div className="mt-2 flex flex-wrap items-baseline gap-2"><span className="font-bold text-primary">₹{Number(product.price).toFixed(2)}</span>{product.mrp && Number(product.mrp)>Number(product.price)&&<span className="text-xs text-muted-foreground line-through">₹{Number(product.mrp).toFixed(2)}</span>}</div></CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
      {homeSellerFeatures.length > 0 && (
        <section className="relative overflow-hidden py-12 md:py-16" aria-label="Featured seller products">
          <div className="absolute inset-0 bg-gradient-to-br from-[#fffafd] via-[#fff0f6] to-[#fff7fb]" />
          <div className="container relative mx-auto px-4">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Handpicked for you</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Featured from our stores</h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">Discover standout picks from trusted ShopHub sellers.</p>
              </div>
              <Button variant="outline" asChild className="border-primary/20 bg-white/80 hover:bg-white">
                <Link to="/products">Explore marketplace <span aria-hidden="true" className="ml-2">→</span></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {homeSellerFeatures.map((product: any) => (
                <Link key={product.id} to={`/marketplace/products/${product.id}`} className="group block">
                  <Card className="h-full overflow-hidden rounded-2xl border-[#f9a8c8]/40 bg-white shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
                    <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                      <img src={product.image_urls[0]} alt={product.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-semibold text-[#9d174d] shadow-sm">
                        {product.seller?.store_name || product.seller?.business_name || "ShopHub seller"}
                      </span>
                    </div>
                    <CardContent className="p-3 md:p-4">
                      <h3 className="line-clamp-2 font-semibold transition-colors group-hover:text-primary">{product.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{product.category}</p>
                      <div className="mt-3 flex flex-wrap items-baseline gap-2">
                        <span className="font-bold text-primary">₹{Number(product.price).toFixed(2)}</span>
                        {product.mrp && Number(product.mrp) > Number(product.price) && <span className="text-xs text-muted-foreground line-through">₹{Number(product.mrp).toFixed(2)}</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <DealsSection />
      
      {newArrivals.length > 0 && <NewArrivalsSection products={newArrivals} />}
      <RecentlyViewedProducts />
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
