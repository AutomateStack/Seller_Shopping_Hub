import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePriceWatch } from "@/hooks/use-price-watch";
import { Link } from "react-router-dom";

/**
 * Background watcher: every session, checks if any watched product price dropped.
 * Notifies via sonner toast and updates the stored "lastPrice" so we don't re-notify.
 */
export function PriceDropWatcher() {
  const { list, updatePrices } = usePriceWatch();
  const notifiedRef = useRef(false);

  const ids = list.map((w) => w.productId);

  const { data } = useQuery({
    queryKey: ["price-watch-check", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .in("id", ids);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!data || notifiedRef.current) return;
    const drops = data.filter((p: any) => {
      const w = list.find((x) => x.productId === p.id);
      return w && Number(p.price) < w.lastPrice;
    });
    if (drops.length > 0) {
      notifiedRef.current = true;
      drops.slice(0, 3).forEach((p: any) => {
        const w = list.find((x) => x.productId === p.id)!;
        const saved = (w.lastPrice - Number(p.price)).toFixed(0);
        toast.success(`💰 Price dropped: ${p.name}`, {
          description: `Now ₹${Number(p.price).toFixed(0)} (saved ₹${saved})`,
          action: { label: "View", onClick: () => window.location.assign(`/products/${p.id}`) },
          duration: 8000,
        });
      });
      // Update stored lastPrice so we don't spam on next mount
      updatePrices(drops.map((p: any) => ({ productId: p.id, price: Number(p.price) })));
    }
  }, [data, list, updatePrices]);

  return null;
}