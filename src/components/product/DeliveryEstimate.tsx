import { useState } from "react";
import { Truck, RotateCcw, ShieldCheck, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Metro / tier-1 prefixes get faster delivery; everything else is standard.
const FAST_PREFIXES = ["11", "12", "40", "41", "50", "51", "56", "57", "60", "61", "70", "71", "38", "39"];

function estimateDays(pin: string) {
  const prefix = pin.slice(0, 2);
  if (FAST_PREFIXES.includes(prefix)) return { min: 2, max: 3, label: "Express serviceable" };
  return { min: 4, max: 7, label: "Standard delivery" };
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
}

export function DeliveryEstimate() {
  const [pin, setPin] = useState(() => localStorage.getItem("delivery_pincode") || "");
  const [result, setResult] = useState<{ min: number; max: number; label: string } | null>(() => {
    const saved = localStorage.getItem("delivery_pincode");
    return saved && /^\d{6}$/.test(saved) ? estimateDays(saved) : null;
  });
  const [error, setError] = useState("");

  const check = () => {
    if (!/^\d{6}$/.test(pin)) {
      setError("Enter a valid 6-digit PIN code");
      setResult(null);
      return;
    }
    setError("");
    localStorage.setItem("delivery_pincode", pin);
    setResult(estimateDays(pin));
  };

  const fallback = addDays(5);

  return (
    <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
      <div className="space-y-2">
        <label htmlFor="pincode" className="text-sm font-medium text-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" aria-hidden="true" /> Check delivery date
        </label>
        <div className="flex gap-2">
          <Input
            id="pincode"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder="Enter PIN code"
            className="h-11"
          />
          <Button onClick={check} variant="outline" className="h-11 shrink-0">Check</Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Truck className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">Free Delivery</p>
          {result ? (
            <p className="text-xs text-muted-foreground">
              {result.label} to {pin} · arrives {addDays(result.min)} – {addDays(result.max)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Typically by {fallback}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <RotateCcw className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">Easy Returns</p>
          <p className="text-xs text-muted-foreground">7-day hassle-free returns</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">Secure Payment</p>
          <p className="text-xs text-muted-foreground">100% secure checkout</p>
        </div>
      </div>
    </div>
  );
}
