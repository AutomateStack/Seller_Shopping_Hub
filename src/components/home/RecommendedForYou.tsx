import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/ProductCard";
import { getTopCategories } from "@/lib/affinity";

const RV_KEY = "shophub_recently_viewed";

function getRecentlyViewedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RV_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Home rail that personalizes based on recently viewed products.
 * Strategy:
 *   1. If user has viewed products before -> fetch related products in same categories
 *      (excluding the ones already viewed).
 *   2. Otherwise -> fall back to most-popular products (highest stock turnover proxy: featured).
 */
export function RecommendedForYou() {
  const viewedIds = typeof window !== "undefined" ? getRecentlyViewedIds() : [];
  const topCats = typeof window !== "undefined" ? getTopCategories(3) : [];

  const { data: products } = useQuery({
    queryKey: ["recommended-for-you", topCats.join(","), viewedIds.slice(0, 4).join(",")],
    queryFn: async () => {
      // Personalized path — prefer affinity-tracked categories, fall back to recently-viewed lookup.
      let cats: string[] = topCats;
      if (cats.length === 0 && viewedIds.length > 0) {
        const { data: viewed } = await supabase
          .from("products")
          .select("category")
          .in("id", viewedIds.slice(0, 4));
        cats = Array.from(
          new Set((viewed || []).map((p: any) => p.category).filter(Boolean)),
        );
      }
        if (cats.length > 0) {
          let q = supabase
            .from("products")
            .select("id, name, price, image_url, stock, category")
            .in("category", cats)
            .gt("stock", 0)
            .limit(8);
          if (viewedIds.length > 0) {
            q = q.not("id", "in", `(${viewedIds.join(",")})`);
          }
          const { data } = await q;
          if (data && data.length > 0) return data;
        }
      // Fallback: featured products
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock, category")
        .eq("featured", true)
        .gt("stock", 0)
        .limit(8);
      return data || [];
    },
  });

  if (!products || products.length === 0) return null;

  const personalized = topCats.length > 0 || viewedIds.length > 0;

  return (
    <section className="py-16" aria-label="Recommended products">
      <div className="container px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">
                {personalized ? "Just for you" : "Popular picks"}
              </p>
            </div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {personalized ? "Recommended for You" : "Trending Products"}
            </h2>
          </div>
          <Link to="/products">
            <Button variant="outline" size="sm" className="min-h-[44px]">
              View All <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.slice(0, 8).map((product, i) => (
            <div
              key={product.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <ProductCard product={product as any} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}