import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, X } from "lucide-react";

const NAMES = ["Priya", "Rahul", "Aarav", "Anika", "Vikram", "Sneha", "Arjun", "Kavya", "Rohan", "Diya", "Karan", "Meera"];
const CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata", "Jaipur", "Ahmedabad", "Lucknow"];
const MINS_AGO = [3, 7, 12, 18, 25, 34, 42, 56];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const SESSION_KEY = "shophub_sold_ticker_dismissed";

export function RecentlySoldTicker() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);

  const { data: products } = useQuery({
    queryKey: ["sold-ticker-products"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("name, image_url")
        .gt("stock", 0)
        .limit(12);
      return data || [];
    },
  });

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setDismissed(true);
      return;
    }
    if (!products || products.length === 0) return;

    let cancelled = false;
    const showOnce = () => {
      if (cancelled) return;
      setIdx((i) => (i + 1) % products.length);
      setVisible(true);
      setTimeout(() => !cancelled && setVisible(false), 5500);
    };
    const initial = setTimeout(showOnce, 8000);
    const interval = setInterval(showOnce, 18000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [products]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem(SESSION_KEY, "1");
  };

  if (dismissed || !products || products.length === 0) return null;
  const product = products[idx];
  if (!product) return null;

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 left-4 z-40 max-w-[300px] transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-lg p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="h-10 w-10 object-cover rounded-lg" />
          ) : (
            <ShoppingBag className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground leading-tight">
            <strong>{pick(NAMES)}</strong> from {pick(CITIES)} just bought
          </p>
          <p className="text-xs text-muted-foreground truncate">{product.name}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{pick(MINS_AGO)} minutes ago</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}