import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { PrefetchLink } from "@/components/PrefetchLink";

interface Props { productId: string }

export function AIRecommendations({ productId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-recs", productId],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: rec } = await supabase.functions.invoke("ai-recommendations", {
        body: { productId },
      });
      const ids: string[] = rec?.recommendations ?? [];
      if (!ids.length) return [];
      const { data: products } = await supabase
        .from("products").select("id, name, price, image_url").in("id", ids);
      // preserve AI ordering
      return ids.map(id => products?.find(p => p.id === id)).filter(Boolean) as any[];
    },
  });

  if (isLoading) {
    return (
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Picked for you</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (!data?.length) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Picked for you</h2>
        <span className="text-xs text-muted-foreground">AI-curated</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.map(p => (
          <PrefetchLink key={p.id} to={`/products/${p.id}`}>
            <Card className="group overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="aspect-square bg-muted overflow-hidden">
                <OptimizedImage
                  src={p.image_url || "/placeholder.svg"}
                  alt={p.name}
                  width={300}
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary">{p.name}</h3>
                <p className="text-base font-bold text-primary">₹{Number(p.price).toFixed(0)}</p>
              </CardContent>
            </Card>
          </PrefetchLink>
        ))}
      </div>
    </section>
  );
}