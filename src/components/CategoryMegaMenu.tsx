import { Link } from "react-router-dom";
import { ChevronDown, Shirt, Gem, Smartphone, Home, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCategories } from "@/hooks/use-categories";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shirt,
  Gem,
  Smartphone,
  Home,
};

export function CategoryMegaMenu() {
  const { data: categories } = useCategories();

  if (!categories || categories.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          Shop by Category
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[640px] p-0 bg-popover border-border shadow-xl"
      >
        <div className="grid grid-cols-2 gap-0">
          {categories.map((cat) => {
            const Icon = (cat.icon && ICON_MAP[cat.icon]) || Package;
            return (
              <div
                key={cat.id}
                className="p-4 border-b border-r border-border/50 last:border-r-0 [&:nth-last-child(-n+2)]:border-b-0"
              >
                <Link
                  to={`/products?category=${cat.slug}`}
                  className="flex items-center gap-2 mb-3 group"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    {cat.name}
                  </span>
                </Link>
                <ul className="space-y-1.5 ml-10">
                  {cat.subcategories.length === 0 ? (
                    <li className="text-xs text-muted-foreground italic">No subcategories</li>
                  ) : (
                    cat.subcategories.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          to={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors block py-0.5"
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-border bg-muted/30">
          <Link
            to="/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all products →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Mobile-friendly accordion version for the side drawer */
export function CategoryMobileList({ onNavigate }: { onNavigate?: () => void }) {
  const { data: categories } = useCategories();
  if (!categories) return null;
  return (
    <div className="space-y-1">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Shop by Category
      </p>
      {categories.map((cat) => {
        const Icon = (cat.icon && ICON_MAP[cat.icon]) || Package;
        return (
          <details key={cat.id} className="group">
            <summary className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted cursor-pointer list-none">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-primary" />
                {cat.name}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <div className="ml-9 mt-1 mb-2 space-y-0.5">
              <Link
                to={`/products?category=${cat.slug}`}
                onClick={onNavigate}
                className="block text-sm text-primary py-1 font-medium"
              >
                All {cat.name}
              </Link>
              {cat.subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  to={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                  onClick={onNavigate}
                  className="block text-sm text-muted-foreground hover:text-primary py-1"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
