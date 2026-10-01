import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ProductQuickViewProps {
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    description?: string | null;
    stock?: number | null;
    category?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductQuickView({ product, open, onOpenChange }: ProductQuickViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!product) return null;

  const handleAddToCart = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { navigate("/auth"); onOpenChange(false); return; }

    const userId = session.user.id;
    const { data: existing } = await supabase
      .from("cart")
      .select("*")
      .eq("user_id", userId)
      .eq("product_id", product.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("cart").update({ quantity: (existing.quantity || 1) + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("cart").insert({ user_id: userId, product_id: product.id, quantity: 1 });
    }

    queryClient.invalidateQueries({ queryKey: ["cart"] });
    toast({ title: "Added to cart", description: `${product.name} added successfully` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">{product.name} - Quick View</DialogTitle>
        <div className="grid md:grid-cols-2 gap-0">
          <div className="aspect-square bg-muted">
            <img
              src={product.image_url || "/placeholder.svg"}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-6 flex flex-col justify-between">
            <div>
              {product.category && (
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {product.category}
                </span>
              )}
              <h3 className="text-xl font-bold mt-1 mb-2">{product.name}</h3>
              <p className="text-2xl font-bold text-primary mb-4">₹{product.price.toFixed(0)}</p>
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-4 mb-4">{product.description}</p>
              )}
              <p className="text-sm">
                {(product.stock ?? 0) > 0 ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">✓ In Stock</span>
                ) : (
                  <span className="text-destructive font-medium">Out of Stock</span>
                )}
              </p>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                className="flex-1 gap-2"
                onClick={handleAddToCart}
                disabled={(product.stock ?? 0) <= 0}
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => { onOpenChange(false); navigate(`/products/${product.id}`); }}
              >
                <ExternalLink className="h-4 w-4" />
                Details
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
