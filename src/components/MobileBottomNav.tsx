import { Home, ShoppingBag, ShoppingCart, Heart, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: ShoppingBag, label: "Shop", path: "/products" },
  { icon: ShoppingCart, label: "Cart", path: "/cart" },
  { icon: Heart, label: "Wishlist", path: "/wishlist" },
  { icon: User, label: "Account", path: "/profile" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: cartCount = 0 } = useQuery({
    queryKey: ["cart", user?.id, "count"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("cart")
        .select("quantity")
        .eq("user_id", user.id);
      return data?.reduce((sum, item) => sum + (item.quantity || 0), 0) ?? 0;
    },
  });

  // Hide on admin pages
  if (location.pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur border-t border-border safe-area-bottom" aria-label="Mobile navigation">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const resolvedPath = !user && (tab.path === "/cart" || tab.path === "/wishlist" || tab.path === "/profile")
            ? "/auth"
            : tab.path;

          return (
            <Link
              key={tab.path}
              to={resolvedPath}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <tab.icon className="h-5 w-5" />
                {tab.path === "/cart" && user && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
