import { Shield, Truck, RotateCcw, CreditCard } from "lucide-react";

const badges = [
  { icon: Truck, label: "Free Delivery", desc: "On orders over ₹499" },
  { icon: Shield, label: "Secure Payment", desc: "100% protected" },
  { icon: RotateCcw, label: "Easy Returns", desc: "7-day return policy" },
  { icon: CreditCard, label: "COD Available", desc: "Pay on delivery" },
];

export function ProductTrustBadges() {
  return (
    <div className="grid grid-cols-2 gap-3 mt-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
      {badges.map((badge) => (
        <div
          key={badge.label}
          className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border"
        >
          <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <badge.icon className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{badge.label}</p>
            <p className="text-[11px] text-muted-foreground">{badge.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
