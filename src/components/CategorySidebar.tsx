import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { cn } from "@/lib/utils";

interface Props {
  activeCategory?: string | null;
  activeSubcategory?: string | null;
}

export function CategorySidebar({ activeCategory, activeSubcategory }: Props) {
  const { data: categories } = useCategories();
  if (!categories) return null;

  return (
    <aside className="space-y-4">
      <Link
        to="/products"
        className={cn(
          "flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors",
          !activeCategory
            ? "bg-primary/10 text-primary"
            : "text-foreground hover:bg-muted"
        )}
      >
        <Package className="h-4 w-4" />
        All Products
      </Link>
      {categories.map((cat) => {
        const isActive = activeCategory === cat.slug;
        return (
          <div key={cat.id}>
            <Link
              to={`/products?category=${cat.slug}`}
              className={cn(
                "block text-sm font-semibold px-3 py-2 rounded-md transition-colors",
                isActive && !activeSubcategory
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {cat.name}
            </Link>
            {isActive && cat.subcategories.length > 0 && (
              <ul className="mt-1 ml-3 border-l border-border pl-3 space-y-0.5">
                {cat.subcategories.map((sub) => {
                  const subActive = activeSubcategory === sub.slug;
                  return (
                    <li key={sub.id}>
                      <Link
                        to={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                        className={cn(
                          "block text-sm px-2 py-1 rounded transition-colors",
                          subActive
                            ? "text-primary font-medium bg-primary/5"
                            : "text-muted-foreground hover:text-primary"
                        )}
                      >
                        {sub.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </aside>
  );
}
