import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X, CheckCircle2, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/WishlistButton";
import { SEOHead } from "@/components/SEOHead";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { Footer } from "@/components/home/Footer";
import { CategorySidebar } from "@/components/CategorySidebar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCategories } from "@/hooks/use-categories";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Loader2, ArrowDown } from "lucide-react";

type SortOption = "newest" | "oldest" | "price-asc" | "price-desc" | "name-asc" | "name-desc" | "rating-desc" | "popularity-desc";

export default function Products() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const categoryFromUrl = searchParams.get("category");
  const subcategoryFromUrl = searchParams.get("subcategory");
  const searchFromUrl = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [category, setCategory] = useState<string>(categoryFromUrl || "all");
  const { data: taxonomy } = useCategories();

  // Resolve subcategory slug -> id (memoized)
  const activeSubcategoryId = useMemo(() => {
    if (!subcategoryFromUrl || !taxonomy) return null;
    for (const c of taxonomy) {
      const s = c.subcategories.find((sub) => sub.slug === subcategoryFromUrl);
      if (s) return s.id;
    }
    return null;
  }, [subcategoryFromUrl, taxonomy]);

  // Resolve category slug -> name (legacy `category` text column uses display name)
  const categoryNameFromSlug = useMemo(() => {
    if (!categoryFromUrl || !taxonomy) return null;
    return taxonomy.find((c) => c.slug === categoryFromUrl)?.name ?? null;
  }, [categoryFromUrl, taxonomy]);

  // Sync category filter from URL changes
  useEffect(() => {
    if (categoryNameFromSlug) {
      setCategory(categoryNameFromSlug);
    } else if (categoryFromUrl) {
      setCategory(categoryFromUrl);
    }
  }, [categoryFromUrl, categoryNameFromSlug]);

  // Sync search input when ?search= URL param changes (e.g., from Navbar search)
  useEffect(() => {
    setSearchInput(searchFromUrl);
    setSearchTerm(searchFromUrl);
  }, [searchFromUrl]);

  // Debounce search to avoid firing a query on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [showFilters, setShowFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Fetch max price for slider range
  const { data: priceStats } = useQuery({
    queryKey: ["price-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("price")
        .order("price", { ascending: false })
        .limit(1);
      if (error) throw error;
      const maxPrice = data?.[0]?.price ?? 10000;
      return { max: Math.ceil(maxPrice) };
    },
  });

  const maxPrice = priceStats?.max ?? 100000;

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", searchTerm, category, sortBy, priceRange, activeSubcategoryId, inStockOnly, selectedCategories],
    placeholderData: (prev: any) => prev,
    queryFn: async () => {
      let query = supabase.from("products").select("*");

      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`);
      }

      if (activeSubcategoryId) {
        query = query.eq("subcategory_id", activeSubcategoryId);
      } else if (selectedCategories.length > 0) {
        query = query.in("category", selectedCategories);
      } else if (category && category !== "all") {
        query = query.eq("category", category);
      }

      query = query.gte("price", priceRange[0]).lte("price", priceRange[1]);

      if (inStockOnly) {
        query = query.gt("stock", 0);
      }

      switch (sortBy) {
        case "newest":
          query = query.order("created_at", { ascending: false });
          break;
        case "oldest":
          query = query.order("created_at", { ascending: true });
          break;
        case "price-asc":
          query = query.order("price", { ascending: true });
          break;
        case "price-desc":
          query = query.order("price", { ascending: false });
          break;
        case "name-asc":
          query = query.order("name", { ascending: true });
          break;
        case "name-desc":
          query = query.order("name", { ascending: false });
          break;
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch review averages to support rating filter (client-side filter so we still benefit from above query)
  const { data: ratingMap } = useQuery({
    queryKey: ["product-ratings"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("product_reviews").select("product_id, rating");
      const map: Record<string, { sum: number; count: number }> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.product_id]) map[r.product_id] = { sum: 0, count: 0 };
        map[r.product_id].sum += r.rating;
        map[r.product_id].count += 1;
      });
      const avg: Record<string, number> = {};
      for (const k in map) avg[k] = map[k].sum / map[k].count;
      return avg;
    },
  });

  // Popularity map = total units sold per product (from order_items)
  const { data: popularityMap } = useQuery({
    queryKey: ["product-popularity"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("order_items").select("product_id, quantity");
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        if (!r.product_id) return;
        map[r.product_id] = (map[r.product_id] || 0) + (r.quantity || 0);
      });
      return map;
    },
  });

  const filteredProducts = useMemo(() => {
    if (!products) return products;
    let list = minRating === 0 ? products : products.filter((p: any) => (ratingMap?.[p.id] ?? 0) >= minRating);
    if (sortBy === "rating-desc") {
      list = [...list].sort((a: any, b: any) => (ratingMap?.[b.id] ?? 0) - (ratingMap?.[a.id] ?? 0));
    } else if (sortBy === "popularity-desc") {
      list = [...list].sort((a: any, b: any) => (popularityMap?.[b.id] ?? 0) - (popularityMap?.[a.id] ?? 0));
    }
    return list;
  }, [products, minRating, ratingMap, popularityMap, sortBy]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category")
        .not("category", "is", null);
      if (error) throw error;
      const uniqueCategories = Array.from(new Set(data.map(p => p.category)));
      return uniqueCategories;
    },
  });

  const hasActiveFilters = category !== "all" || priceRange[0] > 0 || priceRange[1] < maxPrice || inStockOnly || minRating > 0 || selectedCategories.length > 0;

  // Pull-to-refresh on mobile — re-fetches the products list
  const { pullDistance, isRefreshing, threshold } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ["products"] });
  });

  const clearFilters = () => {
    setCategory("all");
    setPriceRange([0, maxPrice]);
    setSearchInput("");
    setSearchTerm("");
    setSortBy("newest");
    setInStockOnly(false);
    setMinRating(0);
    setSelectedCategories([]);
  };

  return (
    <div className="min-h-screen bg-background" id="main-content" role="main">
      {/* Pull-to-refresh indicator (mobile only) */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-transform"
          style={{ transform: `translateY(${Math.min(pullDistance, threshold)}px)`, opacity: Math.min(1, pullDistance / threshold) }}
          aria-hidden="true"
        >
          <div className="bg-popover border rounded-full shadow-lg h-9 w-9 flex items-center justify-center">
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <ArrowDown
                className="h-4 w-4 text-primary transition-transform"
                style={{ transform: pullDistance >= threshold ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            )}
          </div>
        </div>
      )}
      <SEOHead
        title={
          categoryNameFromSlug
            ? `${categoryNameFromSlug} — Buy Online at Best Prices | ShopHub`
            : subcategoryFromUrl
              ? `${subcategoryFromUrl.replace(/-/g, " ")} — Shop Online | ShopHub`
              : "Shop All Products — Electronics, Fashion & More | ShopHub"
        }
        description={
          categoryNameFromSlug
            ? `Shop ${categoryNameFromSlug.toLowerCase()} online at ShopHub. ${products?.length ?? 0}+ products with fast delivery, secure payments and easy returns.`
            : "Browse our complete collection of electronics, clothing, home essentials and more. Filter by category, price, and sort to find exactly what you need."
        }
        canonical={
          categoryFromUrl
            ? `/products?category=${categoryFromUrl}`
            : "/products"
        }
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://shopshub.lovable.app/" },
              { "@type": "ListItem", position: 2, name: "Products", item: "https://shopshub.lovable.app/products" },
              ...(categoryNameFromSlug ? [{ "@type": "ListItem", position: 3, name: categoryNameFromSlug }] : []),
            ],
          },
          ...(products && products.length > 0 ? [{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: categoryNameFromSlug ? `${categoryNameFromSlug} — ShopHub` : "ShopHub Products",
            numberOfItems: products.length,
            itemListElement: products.slice(0, 20).map((p: any, i: number) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `https://shopshub.lovable.app/products/${p.id}`,
              name: p.name,
            })),
          }] : []),
        ]}
      />
      <Navbar />

      <div className="container px-4 py-8">
        <BreadcrumbNav
          items={[
            { label: "Products", href: "/products" },
            ...(categoryNameFromSlug ? [{ label: categoryNameFromSlug }] : []),
          ]}
        />
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">
            {categoryNameFromSlug || "All Products"}
          </h1>
          <p className="text-muted-foreground">
            {subcategoryFromUrl
              ? `Browsing ${subcategoryFromUrl.replace(/-/g, " ")}`
              : "Browse our complete collection of amazing products"}
          </p>
          {filteredProducts && <p className="text-sm text-muted-foreground mt-1">{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found</p>}
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar — desktop only */}
          <div className="hidden lg:block">
            <CategorySidebar
              activeCategory={categoryFromUrl}
              activeSubcategory={subcategoryFromUrl}
            />
          </div>

          <div>

        {/* Search + Sort Row */}
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="popularity-desc">Most Popular</SelectItem>
              <SelectItem value="rating-desc">Top Rated</SelectItem>
              <SelectItem value="price-asc">Price: Low → High</SelectItem>
              <SelectItem value="price-desc">Price: High → Low</SelectItem>
              <SelectItem value="name-asc">Name: A → Z</SelectItem>
              <SelectItem value="name-desc">Name: Z → A</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <Card className="mb-6">
            <CardContent className="p-4 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                {/* Multi-select categories */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Categories (multi-select)</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {categories?.map((cat) => {
                      const checked = selectedCategories.includes(cat!);
                      return (
                        <label key={cat} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${checked ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/40"}`}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              setSelectedCategories(prev => c ? [...prev, cat!] : prev.filter(x => x !== cat));
                            }}
                            className="h-3 w-3"
                          />
                          {cat}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Min rating */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Minimum Rating</label>
                  <div className="flex gap-2">
                    {[0, 3, 4, 4.5].map(r => (
                      <Button
                        key={r}
                        type="button"
                        size="sm"
                        variant={minRating === r ? "default" : "outline"}
                        onClick={() => setMinRating(r)}
                        className="gap-1"
                      >
                        {r === 0 ? "Any" : <><Star className="h-3 w-3 fill-current" />{r}+</>}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  Price Range: ₹{priceRange[0].toLocaleString()} – ₹{priceRange[1].toLocaleString()}
                </label>
                <Slider
                  min={0}
                  max={maxPrice}
                  step={Math.max(1, Math.floor(maxPrice / 100))}
                  value={priceRange}
                  onValueChange={(v) => setPriceRange(v as [number, number])}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={inStockOnly} onCheckedChange={(c) => setInStockOnly(!!c)} />
                  In stock only
                </label>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
                    <X className="h-3.5 w-3.5" /> Clear all
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active filter count */}
        {hasActiveFilters && !showFilters && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filters active</span>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(true)} className="text-xs h-auto py-1 px-2">
              Edit
            </Button>
          </div>
        )}

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-square bg-muted animate-pulse" />
                <CardContent className="p-3 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                  <div className="flex justify-between pt-1">
                    <div className="h-6 bg-muted rounded animate-pulse w-20" />
                    <div className="h-4 bg-muted rounded animate-pulse w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts && filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`}>
                <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer h-full relative hover:-translate-y-1.5 border-transparent hover:border-primary/20">
                  <div className="absolute top-2 right-2 z-10">
                    <WishlistButton productId={product.id} />
                  </div>
                  <div className="aspect-square overflow-hidden bg-muted relative">
                    <img
                      src={product.image_url || "/placeholder.svg"}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* Quick view overlay */}
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-semibold">Sold Out</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-1 line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
                    {product.category && (
                      <p className="text-xs text-muted-foreground mb-2 inline-flex items-center gap-1 bg-accent/50 px-2 py-0.5 rounded-full">{product.category}</p>
                    )}
                    <div className="flex items-baseline justify-between mt-2">
                      <p className="text-2xl font-bold text-primary">
                        ₹{product.price.toFixed(0)}
                      </p>
                      {product.stock > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                          {product.stock} left
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <EmptyState
              icon={Search}
              title={searchTerm ? `No results for "${searchTerm}"` : "No products found"}
              description="Try a different keyword, broaden your filters, or explore a trending category below."
              secondary={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters} className="min-h-[44px]">
                    Clear all filters
                  </Button>
                ) : undefined
              }
            />
            {categories && categories.length > 0 && (
              <div className="text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Try a category</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {categories.slice(0, 8).map((cat) => (
                    <Button
                      key={cat}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearFilters();
                        setCategory(cat!);
                      }}
                      className="rounded-full"
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
