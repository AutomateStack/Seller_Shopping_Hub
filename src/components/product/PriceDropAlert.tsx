import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePriceWatch } from "@/hooks/use-price-watch";
import { toast } from "sonner";

interface Props {
  productId: string;
  productName: string;
  currentPrice: number;
}

export function PriceDropAlert({ productId, productName, currentPrice }: Props) {
  const { isWatching, watch, unwatch } = usePriceWatch();
  const active = isWatching(productId);

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="sm"
      className="gap-1.5"
      onClick={() => {
        if (active) {
          unwatch(productId);
          toast("Price alert removed");
        } else {
          watch(productId, productName, currentPrice);
          toast.success("Price alert set", { description: "We'll notify you when this product drops in price." });
        }
      }}
    >
      {active ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {active ? "Alert on" : "Notify on price drop"}
    </Button>
  );
}