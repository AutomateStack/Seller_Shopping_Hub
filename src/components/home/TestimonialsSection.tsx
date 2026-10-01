import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Verified Buyer",
    rating: 5,
    text: "Amazing quality products and super fast delivery! I've been shopping here for months and never been disappointed.",
    initials: "PS",
  },
  {
    name: "Rahul Patel",
    role: "Verified Buyer",
    rating: 5,
    text: "The best online shopping experience I've had. Great prices, easy returns, and excellent customer support.",
    initials: "RP",
  },
  {
    name: "Ananya Gupta",
    role: "Verified Buyer",
    rating: 4,
    text: "Love the curated selection of products. Everything I've ordered has exceeded my expectations in quality.",
    initials: "AG",
  },
  {
    name: "Vikram Singh",
    role: "Verified Buyer",
    rating: 5,
    text: "Secure payments and hassle-free returns make this my go-to store. Highly recommend to everyone!",
    initials: "VS",
  },
];

const avatarColors = [
  "bg-primary/15 text-primary",
  "bg-secondary/15 text-secondary",
  "bg-accent text-accent-foreground",
  "bg-destructive/10 text-destructive",
];

export function TestimonialsSection() {
  return (
    <section className="py-16 md:py-20 bg-muted/30">
      <div className="container px-4">
        <div className="mb-10 text-center animate-fade-in-up">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">
            What customers say
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Loved by Thousands</h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Real reviews from real customers who trust ShopHub for their everyday needs.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <Card className="border shadow-sm hover:shadow-xl transition-all duration-300 h-full hover:-translate-y-1.5 relative overflow-hidden group bg-card">
                <div className="absolute top-4 right-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity">
                  <Quote className="h-14 w-14 text-primary" />
                </div>
                <CardContent className="pt-6 relative">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 ${s < t.rating ? "fill-secondary text-secondary" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed italic">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${avatarColors[i % avatarColors.length]}`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
