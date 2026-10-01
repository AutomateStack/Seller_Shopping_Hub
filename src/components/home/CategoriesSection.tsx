import { Link } from "react-router-dom";
import { Smartphone, Shirt, Home, BookOpen, Dumbbell, Sparkles } from "lucide-react";

const categories = [
  { name: "Electronics", icon: Smartphone, bg: "bg-primary/10", iconColor: "text-primary" },
  { name: "Clothing", icon: Shirt, bg: "bg-destructive/10", iconColor: "text-destructive" },
  { name: "Home & Kitchen", icon: Home, bg: "bg-secondary/10", iconColor: "text-secondary" },
  { name: "Books", icon: BookOpen, bg: "bg-accent", iconColor: "text-accent-foreground" },
  { name: "Sports", icon: Dumbbell, bg: "bg-primary/10", iconColor: "text-primary" },
  { name: "Beauty", icon: Sparkles, bg: "bg-secondary/10", iconColor: "text-secondary" },
];

export function CategoriesSection() {
  return (
    <section className="py-14 md:py-18">
      <div className="container px-4">
        <div className="text-center mb-10 animate-fade-in-up">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">
            Browse by Category
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Shop What You Love</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat, i) => (
            <div
              key={cat.name}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <Link
                to={`/products?category=${encodeURIComponent(cat.name)}`}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className={`h-14 w-14 rounded-xl ${cat.bg} flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300`}>
                  <cat.icon className={`h-7 w-7 ${cat.iconColor}`} />
                </div>
                <span className="font-semibold text-sm text-foreground text-center">{cat.name}</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
