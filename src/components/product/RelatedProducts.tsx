import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface RelatedProductsProps {
  productId: string;
  category: string | null;
}

export function RelatedProducts({ productId, category }: RelatedProductsProps) {
  const { data: products } = useQuery({
    queryKey: ["related-products", productId, category],
    enabled: !!category,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, category")
        .eq("category", category!)
        .neq("id", productId)
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  if (!products || products.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-bold mb-6">Related Products</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <Link key={p.id} to={`/products/${p.id}`}>
            <Card className="group overflow-hidden hover:shadow-lg transition-all cursor-pointer h-full">
              <div className="aspect-square overflow-hidden bg-muted">
                <OptimizedImage
                  src={p.image_url}
                  alt={p.name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  responsiveWidths={[200, 400]}
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-1">{p.name}</h3>
                <p className="text-primary font-bold">₹{p.price.toFixed(2)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
