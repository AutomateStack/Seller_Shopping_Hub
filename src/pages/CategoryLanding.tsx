import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { SEOHead } from "@/components/SEOHead";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCategories } from "@/hooks/use-categories";
import { formatINR } from "@/lib/format";
import { ArrowRight, ShieldCheck, Truck, RefreshCw, PackageSearch } from "lucide-react";

const BASE_URL = "https://shopshub.lovable.app";

const CategoryLanding = () => {
  const { slug = "" } = useParams();
  const { data: taxonomy } = useCategories();

  const category = useMemo(
    () => taxonomy?.find((c) => c.slug === slug) ?? null,
    [taxonomy, slug]
  );

  const { data: products, isLoading } = useQuery({
    queryKey: ["category-landing-products", category?.name],
    enabled: !!category?.name,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock, category, description")
        .eq("category", category!.name)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data || [];
    },
  });

  const priceStats = useMemo(() => {
    if (!products?.length) return null;
    const prices = products.map((p) => Number(p.price)).filter((n) => n > 0);
    if (!prices.length) return null;
    return { low: Math.min(...prices), high: Math.max(...prices) };
  }, [products]);

  const name = category?.name ?? slug.replace(/-/g, " ");
  const title = `Buy ${name} Online — Best Prices & Fast Delivery | ShopHub`;
  const description = `Shop ${name} at ShopHub. Compare top picks, genuine products, secure payments, fast delivery across India and easy returns.`;

  const faqs = [
    {
      q: `How long does delivery take for ${name}?`,
      a: `Most ${name} orders are dispatched within 24 hours and delivered in 2–6 business days depending on your PIN code. You can check the exact date on any product page.`,
    },
    {
      q: `Can I return ${name} if I change my mind?`,
      a: `Yes. Eligible items can be returned within the return window shown on the product page. Raise a return request from your Orders page and we arrange pickup.`,
    },
    {
      q: `Are payments secure?`,
      a: `All payments are processed through Razorpay with bank-grade encryption. Cash on delivery is also available on eligible orders.`,
    },
    {
      q: `Do you offer bulk discounts on ${name}?`,
      a: `Many products include volume tiers — the discount is applied automatically in your cart when you buy more quantity.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: `${BASE_URL}/shop/${slug}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Shop", item: `${BASE_URL}/products` },
        { "@type": "ListItem", position: 3, name, item: `${BASE_URL}/shop/${slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    ...(products?.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: products.slice(0, 12).map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${BASE_URL}/products/${p.id}`,
              name: p.name,
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={title} description={description} canonical={`/shop/${slug}`} jsonLd={jsonLd} />
      <Navbar />

      <main className="container px-4 py-8">
        <BreadcrumbNav items={[{ label: "Products", href: "/products" }, { label: name }]} />

        <header className="mt-6 mb-10 max-w-3xl">
          <Badge variant="secondary" className="mb-3">Category guide</Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Buy {name} online at the best prices
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Browse our curated {name.toLowerCase()} range{priceStats ? ` starting from ${formatINR(priceStats.low)}` : ""}.
            Every listing is checked for quality, ships with tracked delivery and is backed by our easy returns policy.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Button asChild>
              <Link to={`/products?category=${slug}`}>
                Shop all {name} <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/blog">Read buying guides</Link>
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Truck, title: "Fast, tracked delivery", body: "Dispatch within 24 hours on most in-stock items." },
            { icon: ShieldCheck, title: "Secure payments", body: "Razorpay-protected checkout plus cash on delivery." },
            { icon: RefreshCw, title: "Easy returns", body: "Raise a return from your Orders page in a couple of taps." },
          ].map(({ icon: Icon, title: t, body }) => (
            <div key={t} className="surface-elevated rounded-xl p-5">
              <Icon className="h-5 w-5 text-primary mb-3" />
              <h2 className="font-semibold text-sm mb-1">{t}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        {!!category?.subcategories?.length && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Shop by type</h2>
            <div className="flex flex-wrap gap-2">
              {category.subcategories.map((sub) => (
                <Button key={sub.id} asChild variant="outline" size="sm">
                  <Link to={`/products?category=${slug}&subcategory=${sub.slug}`}>{sub.name}</Link>
                </Button>
              ))}
            </div>
          </section>
        )}

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Top picks in {name}</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Nothing here yet"
              description={`We're adding ${name.toLowerCase()} soon. Browse the rest of the store meanwhile.`}
              secondary={<Button asChild><Link to="/products">Browse all products</Link></Button>}
            />
          )}
        </section>

        <section className="max-w-3xl mb-12">
          <h2 className="text-xl font-semibold mb-4">{name} — frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="surface-elevated rounded-xl p-5">
                <h3 className="font-medium mb-1.5">{f.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CategoryLanding;
