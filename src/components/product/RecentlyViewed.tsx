import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "./ProductCard";

interface RecentlyViewedProps {
  currentProductId: string;
}

export function RecentlyViewed({ currentProductId }: RecentlyViewedProps) {
  const viewedIds = useRecentlyViewed(currentProductId);

  const { data: products } = useQuery({
    queryKey: ["recently-viewed", viewedIds],
    queryFn: async () => {
      if (viewedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("id", viewedIds);
      if (error) throw error;
      // Maintain order
      return viewedIds.map((id) => data.find((p) => p.id === id)).filter(Boolean) as typeof data;
    },
    enabled: viewedIds.length > 0,
  });

  if (!products || products.length === 0) return null;

  return (
    <section className="mt-12" aria-label="Recently viewed products">
      <h2 className="text-2xl font-bold mb-6">Recently Viewed</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
