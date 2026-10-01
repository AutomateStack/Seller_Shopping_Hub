import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/WishlistButton";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWishlist } from "@/hooks/use-wishlist";
import { EmptyState } from "@/components/ui/EmptyState";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";

export default function Wishlist() {
  const { wishlistIds, isLoading: wishlistLoading, isLoggedIn } = useWishlist();
  const navigate = useNavigate();

  const { data: products, isLoading } = useQuery({
    queryKey: ["wishlist-products", wishlistIds],
    enabled: wishlistIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("id", wishlistIds);
      if (error) throw error;
      return data;
    },
  });

  const loading = wishlistLoading || isLoading;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="My Wishlist | ShopHub" description="View and manage your saved products on ShopHub." noindex />
      <Navbar />
      <div className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Wishlist</h1>
          <p className="text-muted-foreground">Products you've saved for later</p>
        </div>

        {!isLoggedIn ? (
          <EmptyState
            icon={Heart}
            title="Sign in to view your wishlist"
            description="Save products you love and come back to them anytime."
            actionLabel="Sign In"
            onAction={() => navigate("/auth")}
          />
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-square bg-muted animate-pulse" />
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`}>
                <Card className="group overflow-hidden hover:shadow-lg transition-smooth cursor-pointer h-full relative">
                  <div className="absolute top-2 right-2 z-10">
                    <WishlistButton productId={product.id} />
                  </div>
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={product.image_url || "/placeholder.svg"}
                      alt={product.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-smooth"
                      loading="lazy"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2 line-clamp-2">{product.name}</h3>
                    {product.category && (
                      <p className="text-xs text-muted-foreground mb-2">{product.category}</p>
                    )}
                    <p className="text-2xl font-bold text-primary">₹{product.price.toFixed(2)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Browse products and tap the heart icon to save them here."
            actionLabel="Browse Products"
            onAction={() => navigate("/products")}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
