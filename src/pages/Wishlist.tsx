import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/WishlistButton";
import { Link } from "react-router-dom";
import { Heart, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWishlist } from "@/hooks/use-wishlist";
import { useMarketplaceWishlist } from "@/hooks/use-marketplace-wishlist";
import { EmptyState } from "@/components/ui/EmptyState";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";

const db = supabase as any;

export default function Wishlist() {
  const { wishlistIds, isLoading: wishlistLoading, isLoggedIn } = useWishlist();
  const marketplaceWishlist = useMarketplaceWishlist();
  const marketplaceIds = marketplaceWishlist.wishlistIds;
  const navigate = useNavigate();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["wishlist-products", wishlistIds],
    enabled: isLoggedIn && wishlistIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").in("id", wishlistIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: marketplaceProducts = [], isLoading: marketplaceLoading } = useQuery({
    queryKey: ["marketplace-wishlist-products", marketplaceIds],
    enabled: marketplaceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.schema("catalog").from("products")
        .select("id,title,category,price,mrp,stock_quantity,image_urls")
        .in("id", marketplaceIds)
        .eq("status", "approved");
      if (error) throw error;
      const byId = new Map((data ?? []).map((product: any) => [product.id, product]));
      return marketplaceIds.map((id) => byId.get(id)).filter((product: any) => !!product);
    },
  });

  const loading = wishlistLoading || productsLoading || marketplaceLoading;
  const hasSavedProducts = (isLoggedIn && products.length > 0) || marketplaceProducts.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="My Wishlist | ShopHub" description="View and manage your saved products on ShopHub." noindex />
      <Navbar />
      <main className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">My Wishlist</h1>
          <p className="text-muted-foreground">Products you've saved for later, on this device and in your account.</p>
        </div>

        {marketplaceProducts.length > 0 && (
          <section className="mb-10" aria-labelledby="marketplace-wishlist-heading">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="marketplace-wishlist-heading" className="text-2xl font-bold">Seller marketplace</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your saved products from ShopHub sellers.</p>
              </div>
              <Button variant="outline" asChild><Link to="/products">Browse products</Link></Button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {marketplaceProducts.map((product: any) => (
                <Link key={product.id} to={`/marketplace/products/${product.id}`} className="block h-full">
                  <Card className="group relative h-full overflow-hidden transition-shadow hover:shadow-lg">
                    <div className="absolute right-2 top-2 z-10">
                      <WishlistButton productId={product.id} marketplace />
                    </div>
                    <div className="aspect-square overflow-hidden bg-muted">
                      {product.image_urls?.[0]
                        ? <img src={product.image_urls[0]} alt={product.title} loading="lazy" className="h-full w-full object-contain p-3 transition-transform group-hover:scale-105" />
                        : <div className="flex h-full items-center justify-center"><Package className="h-10 w-10 text-muted-foreground" /></div>}
                    </div>
                    <CardContent className="p-4">
                      {product.category && <p className="mb-1 text-xs text-muted-foreground">{product.category}</p>}
                      <h3 className="line-clamp-2 font-semibold">{product.title}</h3>
                      <div className="mt-2 flex flex-wrap items-baseline gap-2">
                        <span className="font-bold text-primary">₹{Number(product.price).toFixed(2)}</span>
                        {product.mrp && Number(product.mrp) > Number(product.price) && <span className="text-xs text-muted-foreground line-through">₹{Number(product.mrp).toFixed(2)}</span>}
                      </div>
                      {Number(product.stock_quantity) > 0 ? <p className="mt-1 text-xs text-emerald-700">In stock</p> : <p className="mt-1 text-xs text-muted-foreground">Currently out of stock</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {isLoggedIn && products.length > 0 && (
          <section className="mb-10" aria-labelledby="catalog-wishlist-heading">
            <h2 id="catalog-wishlist-heading" className="mb-5 text-2xl font-bold">ShopHub catalogue</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product: any) => (
                <Link key={product.id} to={`/products/${product.id}`} className="block h-full">
                  <Card className="group relative h-full overflow-hidden transition-shadow hover:shadow-lg">
                    <div className="absolute right-2 top-2 z-10"><WishlistButton productId={product.id} /></div>
                    <div className="aspect-square overflow-hidden bg-muted">
                      <img src={product.image_url || "/placeholder.svg"} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="mb-2 line-clamp-2 font-semibold">{product.name}</h3>
                      {product.category && <p className="mb-2 text-xs text-muted-foreground">{product.category}</p>}
                      <p className="text-xl font-bold text-primary">₹{Number(product.price).toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {loading && !hasSavedProducts && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Card key={i} className="overflow-hidden"><div className="aspect-square animate-pulse bg-muted" /><CardContent className="space-y-2 p-4"><div className="mb-2 h-4 animate-pulse rounded bg-muted" /><div className="h-6 w-1/2 animate-pulse rounded bg-muted" /></CardContent></Card>)}
          </div>
        )}

        {!loading && !hasSavedProducts && (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Browse products and tap the heart icon to save favourites. Marketplace products can be saved without signing in."
            actionLabel="Browse Products"
            onAction={() => navigate("/products")}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
