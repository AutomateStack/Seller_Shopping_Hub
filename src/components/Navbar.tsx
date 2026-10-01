import { ShoppingCart, User, Menu, Package, Heart, Phone, Gift, Brain } from "lucide-react";
import { NavbarSearch } from "@/components/NavbarSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { PrefetchLink } from "@/components/PrefetchLink";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryMegaMenu, CategoryMobileList } from "@/components/CategoryMegaMenu";

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdmin(session.user.id);
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const NavLinks = () => (
    <>
      {[
        { to: "/", label: "Home" },
        { to: "/products", label: "Products" },
      ].map(({ to, label }) => (
        <PrefetchLink key={to} to={to}>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 relative ${isActive(to) ? "text-primary font-semibold" : ""}`}
          >
            {label}
            {isActive(to) && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </Button>
        </PrefetchLink>
      ))}
      <CategoryMegaMenu />
      {[
        { to: "/blog", label: "Blog" },
        { to: "/lucky-draw", label: "Lucky Draw", icon: Gift },
        { to: "/quiz", label: "Quiz", icon: Brain },
        { to: "/contact", label: "Contact", icon: Phone },
      ].map(({ to, label, icon: Icon }) => (
        <PrefetchLink key={to} to={to}>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 relative ${isActive(to) ? "text-primary font-semibold" : ""}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
            {isActive(to) && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </Button>
        </PrefetchLink>
      ))}
      {isAdmin && (
        <Link to="/admin">
          <Button variant="ghost" size="sm" className={`gap-1.5 relative ${isActive("/admin") ? "text-primary font-semibold" : ""}`}>
            <Package className="h-4 w-4" />
            Admin
            {isActive("/admin") && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </Button>
        </Link>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm" aria-label="Primary navigation">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center space-x-2">
            <Package className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              ShopHub
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <NavLinks />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <NavbarSearch />
          <ThemeToggle />
          {user && (
            <Link to="/wishlist">
              <Button variant="ghost" size="icon" aria-label="Wishlist">
                <Heart className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>
          )}
          {user && (
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs" aria-hidden="true">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            </Link>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="User account menu">
                  <User className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/orders")}>
                  My Orders
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/wishlist")}>
                  My Wishlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/wallet")}>
                  My Wallet
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm">Sign In</Button>
            </Link>
          )}

          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="overflow-y-auto">
              <div className="flex flex-col gap-2 mt-8">
                <Link to="/">
                  <Button variant="ghost" className="w-full justify-start">Home</Button>
                </Link>
                <Link to="/products">
                  <Button variant="ghost" className="w-full justify-start">All Products</Button>
                </Link>

                <div className="border-t border-border pt-3 mt-1">
                  <CategoryMobileList />
                </div>

                <div className="border-t border-border pt-3 mt-1 flex flex-col gap-1">
                  <Link to="/blog">
                    <Button variant="ghost" className="w-full justify-start">Blog</Button>
                  </Link>
                  <Link to="/lucky-draw">
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Gift className="h-4 w-4" />
                      Lucky Draw
                    </Button>
                  </Link>
                  <Link to="/quiz">
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Brain className="h-4 w-4" />
                      Quiz
                    </Button>
                  </Link>
                  <Link to="/contact">
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <Phone className="h-4 w-4" />
                      Contact Us
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Link to="/admin">
                      <Button variant="ghost" className="w-full justify-start gap-2">
                        <Package className="h-4 w-4" />
                        Admin
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};
