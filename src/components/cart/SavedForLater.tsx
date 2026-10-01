import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocalList } from "@/hooks/use-local-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bookmark, Trash2, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export const SAVED_FOR_LATER_KEY = "shophub_saved_for_later_v1";

interface Props {
  userId?: string;
  onMoveToCart?: () => void;
}

export function SavedForLater({ userId, onMoveToCart }: Props) {
  const { items, remove } = useLocalList(SAVED_FOR_LATER_KEY, 25);

  const { data: products } = useQuery({
    queryKey: ["saved-for-later", items],
    enabled: items.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock")
        .in("id", items);
      if (error) throw error;
      return items.map((id) => data?.find((p) => p.id === id)).filter(Boolean) as any[];
    },
  });

  if (items.length === 0) return null;

  const moveToCart = async (productId: string) => {
    if (!userId) return;
    const { data: existing } = await supabase
      .from("cart").select("*").eq("user_id", userId).eq("product_id", productId).maybeSingle();
    if (existing) {
      await supabase.from("cart").update({ quantity: (existing.quantity || 1) + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("cart").insert({ user_id: userId, product_id: productId, quantity: 1 });
    }
    remove(productId);
    toast.success("Moved to cart");
    onMoveToCart?.();
  };

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-primary" />
        Saved for later ({items.length})
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {products?.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-3 flex gap-3">
              <Link to={`/products/${p.id}`} className="w-20 h-20 rounded bg-muted flex-shrink-0 overflow-hidden">
                <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-full h-full object-cover" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/products/${p.id}`} className="font-medium text-sm line-clamp-2 hover:text-primary">{p.name}</Link>
                <p className="text-sm font-semibold text-primary mt-1">₹{Number(p.price).toFixed(0)}</p>
                <div className="flex gap-1.5 mt-2">
                  <Button size="sm" variant="default" className="h-8 gap-1 text-xs" onClick={() => moveToCart(p.id)} disabled={(p.stock ?? 0) <= 0}>
                    <ShoppingCart className="h-3 w-3" />
                    {(p.stock ?? 0) > 0 ? "Move to cart" : "Out of stock"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => remove(p.id)} aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}