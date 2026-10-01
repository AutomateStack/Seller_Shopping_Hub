import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Clock, ArrowRight } from "lucide-react";

function getEndOfDayUTC() {
  const now = new Date();
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  if (end.getTime() - now.getTime() < 3600000) {
    end.setUTCDate(end.getUTCDate() + 1);
  }
  return end;
}

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(getTimeDiff(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeDiff(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

function getTimeDiff(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-foreground text-background font-bold text-xl md:text-2xl rounded-lg w-12 h-12 md:w-14 md:h-14 flex items-center justify-center tabular-nums shadow-md">
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-[10px] md:text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">{label}</span>
    </div>
  );
}

export function DealsSection() {
  const deadline = useState(() => getEndOfDayUTC())[0];
  const { hours, minutes, seconds } = useCountdown(deadline);

  const { data: dealProducts } = useQuery({
    queryKey: ["deal-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("featured", true)
        .gt("stock", 0)
        .order("price", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  if (!dealProducts || dealProducts.length === 0) return null;

  return (
    <section className="py-14 md:py-20 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-secondary/5 to-primary/5 pointer-events-none" />

      <div className="container px-4 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive mb-3">
              <Flame className="h-3.5 w-3.5" />
              Today's Hot Deals
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Deals of the Day
            </h2>
            <p className="text-muted-foreground mt-1 max-w-md">
              Grab these limited-time offers before they're gone!
            </p>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-2 bg-card rounded-2xl border shadow-sm px-6 py-4">
            <Clock className="h-5 w-5 text-destructive mr-1 shrink-0" />
            <span className="text-sm font-medium text-muted-foreground mr-2 hidden sm:block">Ends in</span>
            <div className="flex items-center gap-2">
              <TimeBlock value={hours} label="Hrs" />
              <span className="text-xl font-bold text-muted-foreground -mt-4">:</span>
              <TimeBlock value={minutes} label="Min" />
              <span className="text-xl font-bold text-muted-foreground -mt-4">:</span>
              <TimeBlock value={seconds} label="Sec" />
            </div>
          </div>
        </div>

        {/* Deal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {dealProducts.map((product, i) => {
            const discount = [30, 25, 20][i] || 15;
            const originalPrice = Math.round(product.price / (1 - discount / 100));

            return (
              <Link key={product.id} to={`/products/${product.id}`}>
                <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-transparent hover:border-primary/20 h-full relative">
                  <Badge className="absolute top-3 left-3 z-10 bg-destructive text-destructive-foreground text-xs font-bold px-2.5 py-1">
                    {discount}% OFF
                  </Badge>
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={product.image_url || "/placeholder.svg"}
                      alt={product.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">
                        ₹{product.price.toFixed(0)}
                      </span>
                      <span className="text-sm text-muted-foreground line-through">
                        ₹{originalPrice}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Selling fast</span>
                        <span>{Math.min(product.stock || 0, 20)} left</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-destructive transition-all duration-500"
                          style={{ width: `${Math.max(15, 100 - (product.stock || 0) * 5)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link to="/products">
            <Button variant="outline" size="lg">
              View All Deals <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
