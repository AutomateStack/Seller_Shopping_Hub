import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface StickyAddToCartBarProps {
  productName: string;
  imageUrl: string | null;
  price: number;
  inStock: boolean;
  isAddingToCart: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
  /** Pixel scroll depth at which the bar appears (default 600). */
  showAfter?: number;
}

/**
 * Desktop-only sticky reassurance bar that re-surfaces the primary purchase
 * actions after the shopper scrolls past the hero of the product detail page.
 * Mobile already has its own bottom action bar.
 */
export function StickyAddToCartBar({
  productName,
  imageUrl,
  price,
  inStock,
  isAddingToCart,
  onAddToCart,
  onBuyNow,
  showAfter = 600,
}: StickyAddToCartBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > showAfter);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfter]);

  return (
    <div
      aria-hidden={!visible}
      className={[
        "hidden md:flex fixed inset-x-0 top-0 z-40",
        "bg-background/95 backdrop-blur border-b border-border shadow-sm",
        "transition-transform duration-300",
        visible ? "translate-y-0" : "-translate-y-full",
      ].join(" ")}
    >
      <div className="container mx-auto flex items-center gap-4 px-4 py-2.5 max-w-7xl">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
            <OptimizedImage
              src={imageUrl}
              alt={productName}
              width={48}
              height={48}
              responsiveWidths={[48, 96]}
              sizes="48px"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{productName}</p>
            <p className="text-base font-bold text-primary">₹{price.toFixed(0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={onAddToCart}
            disabled={!inStock || isAddingToCart}
          >
            {isAddingToCart ? "Adding…" : "Add to cart"}
          </Button>
          <Button
            variant="premium"
            size="sm"
            className="min-h-[44px]"
            onClick={onBuyNow}
            disabled={!inStock || isAddingToCart}
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}