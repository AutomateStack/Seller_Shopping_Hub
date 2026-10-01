import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Truck, RotateCcw, Bookmark, Tag } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SEOHead } from "@/components/SEOHead";
import { Footer } from "@/components/home/Footer";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { SavedForLater, SAVED_FOR_LATER_KEY } from "@/components/cart/SavedForLater";
import { useLocalList } from "@/hooks/use-local-list";
import { calculateVolumeDiscount, getApplicableTier, formatINR } from "@/lib/format";

export default function Cart() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const savedList = useLocalList(SAVED_FOR_LATER_KEY, 25);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  const { data: cartItems, isLoading } = useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart")
        .select(`*, products:product_id (id, name, price, image_url, stock, volume_tiers)`)
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartId, quantity }: { cartId: string; quantity: number }) => {
      const { error } = await supabase.from("cart").update({ quantity }).eq("id", cartId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (cartId: string) => {
      const { error } = await supabase.from("cart").delete().eq("id", cartId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast({ title: "Item removed", description: "Item removed from cart" });
    },
  });

  const saveForLater = async (item: any) => {
    savedList.add(item.products?.id);
    await supabase.from("cart").delete().eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["cart"] });
    toast({ title: "Saved for later", description: `${item.products?.name} moved to saved items.` });
  };

  // Swipe-to-delete state (mobile only)
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const touchStart = useRef<{ id: string; x: number; y: number; locked: boolean } | null>(null);

  const onTouchStart = (id: string) => (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { id, x: t.clientX, y: t.clientY, locked: false };
  };
  const onTouchMove = (id: string) => (e: React.TouchEvent) => {
    if (!touchStart.current || touchStart.current.id !== id) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (!touchStart.current.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      touchStart.current.locked = Math.abs(dx) > Math.abs(dy);
      if (!touchStart.current.locked) return;
    }
    if (dx < 0) {
      setSwipeOffsets((p) => ({ ...p, [id]: Math.max(dx, -120) }));
    }
  };
  const onTouchEnd = (id: string) => () => {
    const offset = swipeOffsets[id] || 0;
    if (offset < -80) {
      setSwipeOffsets((p) => ({ ...p, [id]: 0 }));
      removeItemMutation.mutate(id);
    } else {
      setSwipeOffsets((p) => ({ ...p, [id]: 0 }));
    }
    touchStart.current = null;
  };

  const total = cartItems?.reduce((sum, item: any) => sum + (item.products?.price || 0) * item.quantity, 0) || 0;
  const itemCount = cartItems?.reduce((sum, item: any) => sum + item.quantity, 0) || 0;
  const volumeDiscount = cartItems
    ? calculateVolumeDiscount(
        cartItems.map((item: any) => ({
          quantity: item.quantity,
          price: item.products?.price || 0,
          volume_tiers: item.products?.volume_tiers,
        }))
      )
    : 0;
  const discountedTotal = Math.max(0, total - volumeDiscount);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="container px-4 py-16 flex-1">
          <div className="max-w-md mx-auto text-center">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Add some products to get started</p>
            <Button onClick={() => navigate("/products")} variant="premium">Shop Now</Button>
          </div>
          <div className="max-w-3xl mx-auto">
            <SavedForLater userId={user?.id} />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 md:pb-0">
      <SEOHead title="Shopping Cart — ShopHub" description="Review items in your cart and proceed to checkout." noindex />
      <Navbar />

      <div className="container px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <span className="text-sm text-muted-foreground">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item: any) => (
              <div key={item.id} className="relative overflow-hidden rounded-lg">
                {/* Swipe-reveal delete background (mobile) */}
                <div className="absolute inset-y-0 right-0 w-32 bg-destructive flex items-center justify-center md:hidden pointer-events-none">
                  <Trash2 className="h-5 w-5 text-destructive-foreground" />
                  <span className="ml-2 text-sm font-medium text-destructive-foreground">Remove</span>
                </div>
                <Card
                  className="overflow-hidden relative transition-transform"
                  style={{ transform: `translateX(${swipeOffsets[item.id] || 0}px)` }}
                  onTouchStart={onTouchStart(item.id)}
                  onTouchMove={onTouchMove(item.id)}
                  onTouchEnd={onTouchEnd(item.id)}
                >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Link to={`/products/${item.products?.id}`} className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted block">
                      <OptimizedImage
                        src={item.products?.image_url}
                        alt={item.products?.name || ""}
                        className="h-full w-full object-cover hover:scale-105 transition-transform"
                        width={96}
                        height={96}
                        responsiveWidths={[96, 192]}
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link to={`/products/${item.products?.id}`} className="font-semibold mb-1 hover:text-primary transition-colors line-clamp-1 block">
                        {item.products?.name}
                      </Link>
                      <p className="text-lg font-bold text-primary">₹{item.products?.price.toFixed(2)}</p>
                      {(() => {
                        const tier = getApplicableTier(item.quantity, item.products?.volume_tiers);
                        if (!tier) return null;
                        return (
                          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">
                            <Tag className="h-3 w-3" />
                            {tier.min_qty}+ units · {tier.discount_percent}% off
                          </div>
                        );
                      })()}

                      <div className="mt-2 flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-11 w-11 md:h-8 md:w-8"
                          onClick={() => item.quantity > 1 && updateQuantityMutation.mutate({ cartId: item.id, quantity: item.quantity - 1 })}>
                          <Minus className="h-4 w-4 md:h-3 md:w-3" />
                        </Button>
                        <span className="w-12 text-center font-medium tabular-nums">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-11 w-11 md:h-8 md:w-8"
                          onClick={() => item.quantity < item.products.stock && updateQuantityMutation.mutate({ cartId: item.id, quantity: item.quantity + 1 })}
                          disabled={item.quantity >= item.products.stock}>
                          <Plus className="h-4 w-4 md:h-3 md:w-3" />
                        </Button>
                      </div>
                      <p className="md:hidden text-[10px] text-muted-foreground mt-1.5">Tip: swipe left to remove</p>
                    </div>

                    <div className="flex flex-col items-end justify-between">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => saveForLater(item)} aria-label="Save for later" title="Save for later">
                          <Bookmark className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeItemMutation.mutate(item.id)} aria-label="Remove item">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {(() => {
                        const tier = getApplicableTier(item.quantity, item.products?.volume_tiers);
                        const lineTotal = item.products?.price * item.quantity;
                        const lineDiscount = tier ? lineTotal * (tier.discount_percent / 100) : 0;
                        const finalLineTotal = lineTotal - lineDiscount;
                        return (
                          <div className="text-right">
                            {tier && (
                              <p className="text-xs text-muted-foreground line-through">₹{lineTotal.toFixed(2)}</p>
                            )}
                            <p className="text-lg font-bold">₹{finalLineTotal.toFixed(2)}</p>
                            {tier && (
                              <p className="text-[10px] text-green-600">Saved {formatINR(lineDiscount, { compact: true })}</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
                </Card>
              </div>
            ))}
            <SavedForLater userId={user?.id} />
          </div>

          <div>
            <Card className="sticky top-20">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                    <span className="font-medium">₹{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium text-green-600">Free</span>
                  </div>
                </div>

                <div className="border-t pt-4 mb-6">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button className="w-full" size="lg" variant="premium" onClick={() => navigate("/checkout")}>
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    <span>Secure checkout</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Truck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span>Free shipping on all orders</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RotateCcw className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span>7-day easy returns</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />

      {/* Sticky mobile checkout bar */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex items-center gap-3 safe-area-bottom">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] text-muted-foreground">Total ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
          <span className="text-lg font-bold text-primary">₹{total.toFixed(2)}</span>
        </div>
        <Button
          className="ml-auto h-11 rounded-xl text-sm font-semibold"
          variant="premium"
          onClick={() => navigate("/checkout")}
        >
          Checkout
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
