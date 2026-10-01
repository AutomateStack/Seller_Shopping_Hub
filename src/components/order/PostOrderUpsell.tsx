import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/format";

interface Props { categoryHints?: (string | null)[]; excludeIds?: string[] }

/**
 * Shows complementary products on the order confirmation page.
 * Encourages a follow-up purchase using the buyer's just-purchased categories.
 */
export function PostOrderUpsell({ categoryHints = [], excludeIds = [] }: Props) {
  const cats = Array.from(new Set(categoryHints.filter(Boolean) as string[]));
  const { data: products } = useQuery({
    queryKey: ["post-order-upsell", cats.join(","), excludeIds.length],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name, price, image_url, category").gt("stock", 0).limit(4);
      if (cats.length > 0) q = q.in("category", cats);
      if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);
      const { data } = await q;
      if ((data?.length ?? 0) >= 2) return data!;
      // Fallback: featured
      const { data: featured } = await supabase.from("products").select("id, name, price, image_url, category").eq("featured", true).gt("stock", 0).limit(4);
      return featured || [];
    },
  });

  if (!products || products.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">You might also like</h2>
          <Link to="/products" className="text-xs text-primary inline-flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            See all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {products.slice(0, 4).map((p) => (
            <Link
              key={p.id}
              to={`/products/${p.id}`}
              className="group block rounded-lg border bg-background overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="aspect-square bg-muted overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                ) : null}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-foreground line-clamp-2 min-h-[2rem]">{p.name}</p>
                <p className="text-sm font-bold text-primary mt-1">{formatINR(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
