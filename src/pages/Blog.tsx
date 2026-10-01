import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEOHead";

// Estimate reading time from content length
function readingTime(content: string) {
  const words = content.split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

const Blog = () => {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const [featured, ...rest] = posts || [];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Blog — Tips, Insights & Shopping Guides | ShopHub"
        description="Read the latest tips, product guides, and shopping insights on the ShopHub blog. Stay informed with fresh content on electronics, fashion, and more."
        canonical="/blog"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://shopshub.lovable.app/" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://shopshub.lovable.app/blog" },
            ],
          },
          ...(posts && posts.length > 0 ? [{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "ShopHub Blog",
            numberOfItems: posts.length,
            itemListElement: posts.map((p: any, i: number) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `https://shopshub.lovable.app/blog/${p.slug}`,
              name: p.title,
            })),
          }] : []),
        ]}
      />
      <Navbar />

      {/* Hero Header */}
      <section className="bg-gradient-hero py-16">
        <div className="container px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-3">
            Our Blog
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto">
            Insights, tips, and stories — fresh content delivered daily.
          </p>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardContent className="p-5 space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-10">
            {/* Featured (first) post — large card */}
            {featured && (
              <Link to={`/blog/${featured.slug}`} className="block group">
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 md:flex">
                  {featured.featured_image_url && (
                    <div className="md:w-1/2 h-64 md:h-auto overflow-hidden">
                      <img
                        src={featured.featured_image_url}
                        alt={featured.title}
                        loading="eager"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <CardContent className={`flex flex-col justify-center p-8 ${featured.featured_image_url ? "md:w-1/2" : "w-full"}`}>
                    <Badge className="w-fit mb-3">Featured</Badge>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3 group-hover:text-primary transition-colors line-clamp-3">
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="text-muted-foreground mb-4 line-clamp-3">
                        {featured.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(featured.created_at), "MMM dd, yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {readingTime(featured.content)}
                      </span>
                    </div>
                    <Button variant="link" className="w-fit p-0 h-auto text-primary gap-1">
                      Read Article <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Remaining posts grid */}
            {rest.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((post) => (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="block group">
                    <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                      {post.featured_image_url && (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={post.featured_image_url}
                            alt={post.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                      )}
                      <CardContent className="p-5">
                        <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                            {post.excerpt}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(post.created_at), "MMM dd, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {readingTime(post.content)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-muted-foreground text-lg mb-2">No blog posts yet.</p>
            <p className="text-muted-foreground text-sm">Check back soon for fresh content!</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Blog;
