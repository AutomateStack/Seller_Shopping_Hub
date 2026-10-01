import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Card, CardContent } from "@/components/ui/card";
import { Layers } from "lucide-react";

interface FrequentlyBoughtTogetherProps {
  productId: string;
}

/**
 * Mines `order_items` to find products that appear in the same orders as the
 * current product. Falls back silently when there isn't enough data yet.
 * Read-only and additive — does not change cart/order behavior.
 */
export function FrequentlyBoughtTogether({ productId }: FrequentlyBoughtTogetherProps) {
  const { data: coProducts } = useQuery({
    queryKey: ["fbt", productId],
    enabled: !!productId,
    queryFn: async () => {
      // 1. Find every order containing this product.
      const { data: anchorRows } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("product_id", productId)
        .limit(500);
      const orderIds = Array.from(new Set((anchorRows ?? []).map((r) => r.order_id))).slice(0, 200);
      if (orderIds.length === 0) return [];

      // 2. Pull other items from those orders and tally co-occurrence.
      const { data: peers } = await supabase
        .from("order_items")
        .select("product_id")
        .in("order_id", orderIds)
        .neq("product_id", productId)
        .not("product_id", "is", null);
      const counts = new Map<string, number>();
      for (const r of peers ?? []) {
        if (!r.product_id) continue;
        counts.set(r.product_id, (counts.get(r.product_id) ?? 0) + 1);
      }
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);
      if (topIds.length === 0) return [];

      // 3. Fetch product details.
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock")
        .in("id", topIds);
      // Preserve the popularity order
      const order = new Map(topIds.map((id, i) => [id, i]));
      return (products ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
    staleTime: 10 * 60 * 1000,
  });

  const items = useMemo(() => coProducts ?? [], [coProducts]);
  if (items.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="fbt-heading">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="fbt-heading" className="text-xl font-bold">Frequently bought together</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((p) => (
          <Link key={p.id} to={`/products/${p.id}`} className="group">
            <Card className="overflow-hidden hover:shadow-lg transition-shadow border-border/60">
              <div className="aspect-square bg-muted overflow-hidden">
                <OptimizedImage
                  src={p.image_url}
                  alt={p.name}
                  width={300}
                  height={300}
                  responsiveWidths={[200, 400]}
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <CardContent className="p-3">
                <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {p.name}
                </p>
                <p className="mt-1 text-base font-bold text-primary">₹{Number(p.price).toFixed(0)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}