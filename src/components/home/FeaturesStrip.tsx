import { Truck, Shield, CreditCard, ShoppingBag } from "lucide-react";

const features = [
  { icon: Truck, title: "Free Delivery", desc: "Orders above ₹499" },
  { icon: Shield, title: "Secure Payment", desc: "100% protected" },
  { icon: CreditCard, title: "Easy Returns", desc: "7-day hassle-free" },
  { icon: ShoppingBag, title: "Quality Products", desc: "Curated items only" },
];

export function FeaturesStrip() {
  return (
    <section className="py-4 bg-card border-b border-border relative z-20 -mt-8">
      <div className="container px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 bg-card rounded-2xl shadow-lg border border-border p-4 md:p-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/50 transition-colors group cursor-default"
            >
              <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-accent shrink-0 group-hover:bg-primary/10 group-hover:scale-110 transition-all duration-300">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
