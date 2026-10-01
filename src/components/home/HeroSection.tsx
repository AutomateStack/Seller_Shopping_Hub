import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowRight, Sparkles, Star, Zap } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

export function HeroSection() {
  // Reuse the home-products batched fetch when present so the hero doesn't
  // issue its own round trip. Falls back to a tiny query if the cache is empty
  // (e.g. Hero mounted on a non-Home page).
  const qc = useQueryClient();
  const homeProducts = qc.getQueryData<any[]>(["home-products"]);
  const cachedHero = homeProducts?.filter((p: any) => p.featured).slice(0, 3);

  const { data: heroProducts } = useQuery({
    queryKey: ["hero-products"],
    queryFn: async () => {
      if (cachedHero && cachedHero.length > 0) return cachedHero;
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, featured")
        .eq("featured", true)
        .limit(3);
      return data || [];
    },
    initialData: cachedHero && cachedHero.length > 0 ? cachedHero : undefined,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="relative overflow-hidden bg-gradient-hero min-h-[85vh] flex items-center">
      {/* Animated background elements — pure CSS */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-secondary/20 blur-[100px] animate-hero-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary-foreground/10 blur-[80px] animate-hero-pulse-slow-alt" />
        <div className="absolute top-20 right-[15%] w-3 h-3 rounded-full bg-secondary/40 animate-float-slow" />
        <div className="absolute bottom-32 left-[20%] w-2 h-2 rounded-full bg-primary-foreground/30 animate-float-slow-alt" />
        <div className="absolute top-[40%] left-[10%] w-4 h-4 rounded-full bg-secondary/20 animate-float-drift" />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="container px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="animate-fade-in-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm text-primary-foreground/90 mb-6 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <Sparkles className="h-3.5 w-3.5 text-secondary" />
              New arrivals every week
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl xl:text-7xl leading-[1.1]">
              Discover Products{" "}
              <span className="relative inline-block">
                You'll{" "}
                <span className="italic bg-gradient-to-r from-secondary to-secondary/80 bg-clip-text text-transparent">
                  Love
                </span>
                <svg
                  className="absolute -bottom-2 left-0 w-full animate-draw-underline"
                  viewBox="0 0 200 12"
                  fill="none"
                >
                  <path
                    d="M2 8 C50 2, 150 2, 198 8"
                    stroke="hsl(40, 96%, 55%)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mb-8 text-lg text-primary-foreground/70 md:text-xl max-w-xl leading-relaxed animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              Curated collections, unbeatable prices, and lightning-fast delivery — your premium shopping destination.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
              <Link to="/products">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 bg-secondary text-secondary-foreground hover:bg-secondary-hover font-semibold shadow-xl hover:shadow-2xl hover:scale-105 transition-all">
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Shop Now
                </Button>
              </Link>
              <Link to="/products">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20 text-base px-8 backdrop-blur-sm"
                >
                  Browse Collection
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-6 text-primary-foreground/60 text-sm animate-fade-in-up" style={{ animationDelay: "0.7s" }}>
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-secondary text-secondary" />
                  ))}
                </div>
                <span>4.9/5 rating</span>
              </div>
              <div className="h-4 w-px bg-primary-foreground/20" />
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-secondary" />
                <span>10K+ happy customers</span>
              </div>
            </div>
          </div>

          {/* Right - floating product cards */}
          <div className="hidden lg:block relative animate-fade-in-right">
            <div className="relative w-full h-[500px]">
              {heroProducts?.slice(0, 3).map((product, i) => {
                const positions = [
                  { top: "0%", right: "5%", rotate: "3deg", delay: "0.5s" },
                  { top: "25%", right: "30%", rotate: "-2deg", delay: "0.7s" },
                  { top: "45%", right: "0%", rotate: "1deg", delay: "0.9s" },
                ];
                const pos = positions[i];
                return (
                  <div
                    key={product.id}
                    className="absolute w-[240px] cursor-pointer animate-fade-in-up hover:scale-105 hover:rotate-0 transition-transform duration-300"
                    style={{
                      top: pos.top,
                      right: pos.right,
                      transform: `rotate(${pos.rotate})`,
                      zIndex: 10 + i,
                      animationDelay: pos.delay,
                    }}
                  >
                    <Link to={`/products/${product.id}`}>
                      <div className="rounded-2xl overflow-hidden bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/15 shadow-2xl">
                        <div className="aspect-square overflow-hidden">
                          <OptimizedImage
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            width={240}
                            height={240}
                            responsiveWidths={[240, 480]}
                            sizes="240px"
                            priority={i === 0}
                          />
                        </div>
                        <div className="p-3">
                          <p className="text-primary-foreground text-sm font-medium line-clamp-1">
                            {product.name}
                          </p>
                          <p className="text-secondary font-bold text-lg">
                            ₹{product.price.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}

              {/* Decorative elements */}
              <div className="absolute top-[10%] left-[5%] w-16 h-16 rounded-2xl bg-secondary/20 backdrop-blur-sm border border-secondary/20 flex items-center justify-center animate-float-slow">
                <Zap className="h-7 w-7 text-secondary" />
              </div>
              <div className="absolute bottom-[10%] left-[15%] w-14 h-14 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/15 flex items-center justify-center animate-float-slow-alt">
                <Star className="h-6 w-6 text-secondary fill-secondary" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
