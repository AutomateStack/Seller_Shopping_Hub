import { useEffect, useRef, useState } from "react";
import { Users, Package, Star, Truck } from "lucide-react";

const stats = [
  { icon: Users, value: 10000, suffix: "+", label: "Happy Customers" },
  { icon: Package, value: 500, suffix: "+", label: "Quality Products" },
  { icon: Star, value: 4.9, suffix: "/5", label: "Average Rating", decimals: 1 },
  { icon: Truck, value: 50000, suffix: "+", label: "Orders Delivered" },
];

function AnimatedNumber({ value, suffix, decimals = 0 }: { value: number; suffix: string; decimals?: number }) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const start = performance.now();

          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * value;
            if (decimals > 0) {
              setDisplay(current.toFixed(decimals));
            } else {
              setDisplay(Math.floor(current).toLocaleString("en-IN"));
            }
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, decimals, hasAnimated]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

export function SocialProofCounters() {
  return (
    <section className="py-14 bg-gradient-to-br from-primary/5 via-accent/30 to-secondary/5 border-y border-border">
      <div className="container px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center group">
              <div className="flex justify-center mb-3">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-3xl md:text-4xl font-bold text-foreground tabular-nums">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
