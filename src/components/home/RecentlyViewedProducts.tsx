import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock3, Package } from "lucide-react";

export const RECENTLY_VIEWED_PRODUCTS_KEY = "shophub-recently-viewed-products-v1";
const db = supabase as any;

function readRecentlyViewedIds(): string[] {
  try {
    const value = localStorage.getItem(RECENTLY_VIEWED_PRODUCTS_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

export function RecentlyViewedProducts() {
  const [productIds, setProductIds] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setProductIds(readRecentlyViewedIds());
    refresh();
    window.addEventListener("shophub-recently-viewed-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("shophub-recently-viewed-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["recently-viewed-marketplace-products", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const { data, error } = await db.schema("catalog").from("products")
        .select("id,title,category,price,mrp,stock_quantity,image_urls")
        .in("id", productIds)
        .eq("status", "approved");
      if (error) throw error;
      const byId = new Map((data || []).map((product: any) => [product.id, product]));
      return productIds.map((id) => byId.get(id)).filter((product: any) => !!product);
    },
    enabled: productIds.length > 0,
    staleTime: 60 * 1000,
  });

  if (!products.length) return null;

  return (
    <section className="container mx-auto max-w-6xl px-4 py-10" aria-labelledby="recently-viewed-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary"><Clock3 className="h-4 w-4" /> Pick up where you left off</p>
          <h2 id="recently-viewed-heading" className="mt-1 text-2xl font-bold md:text-3xl">Recently viewed</h2>
          <p className="mt-1 text-sm text-muted-foreground">Products you’ve looked at recently on this device.</p>
        </div>
        <Button variant="outline" asChild><Link to="/products">Browse all products</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {products.map((product: any) => (
          <Link key={product.id} to={`/marketplace/products/${product.id}`} className="group block h-full">
            <Card className="h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <div className="aspect-square overflow-hidden bg-muted">
                {product.image_urls?.[0]
                  ? <img src={product.image_urls[0]} alt={product.title} loading="lazy" className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]" />
                  : <div className="flex h-full items-center justify-center"><Package className="h-10 w-10 text-muted-foreground" /></div>}
              </div>
              <CardContent className="p-3 md:p-4">
                {product.category && <p className="mb-1 text-xs text-muted-foreground">{product.category}</p>}
                <h3 className="line-clamp-2 min-h-10 text-sm font-semibold transition-colors group-hover:text-primary">{product.title}</h3>
                <div className="mt-2 flex flex-wrap items-baseline gap-2">
                  <span className="font-bold text-primary">₹{Number(product.price).toFixed(2)}</span>
                  {product.mrp && Number(product.mrp) > Number(product.price) && <span className="text-xs text-muted-foreground line-through">₹{Number(product.mrp).toFixed(2)}</span>}
                </div>
                {Number(product.stock_quantity) > 0
                  ? <p className="mt-1 text-xs text-emerald-700">In stock</p>
                  : <p className="mt-1 text-xs text-muted-foreground">Currently out of stock</p>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
