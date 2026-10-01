import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { SEOHead } from "@/components/SEOHead";

function readingTime(content: string) {
  const words = content.split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

const BlogPost = () => {
  const { slug } = useParams();

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .single();

      if (error) throw error;

      if (data?.author_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.author_id)
          .single();
        return { ...data, author: profile } as typeof data & { author: { full_name: string } | null };
      }

      return { ...data, author: null } as typeof data & { author: { full_name: string } | null };
    },
  });

  const { data: relatedPosts } = useQuery({
    queryKey: ["blog-related", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, featured_image_url, created_at")
        .eq("published", true)
        .neq("slug", slug!)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!slug,
  });

  return (
    <div className="min-h-screen bg-background">
      {post && (
        <SEOHead
          title={`${post.title} — ShopHub Blog`}
          description={post.excerpt || post.content.slice(0, 155)}
          canonical={`/blog/${post.slug}`}
          image={post.featured_image_url || undefined}
          type="article"
          jsonLd={[
            {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: post.title,
              description: post.excerpt || post.content.slice(0, 155),
              image: post.featured_image_url || "",
              datePublished: post.created_at,
              dateModified: post.updated_at,
              wordCount: post.content.split(/\s+/).length,
              timeRequired: `PT${Math.max(1, Math.round(post.content.split(/\s+/).length / 200))}M`,
              inLanguage: "en",
              author: { "@type": "Person", name: post.author?.full_name || "ShopHub" },
              publisher: {
                "@type": "Organization",
                name: "ShopHub",
                url: "https://shopshub.lovable.app",
              },
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `https://shopshub.lovable.app/blog/${post.slug}`,
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://shopshub.lovable.app/" },
                { "@type": "ListItem", position: 2, name: "Blog", item: "https://shopshub.lovable.app/blog" },
                { "@type": "ListItem", position: 3, name: post.title },
              ],
            },
          ]}
        />
      )}
      <Navbar />

      {/* Hero image */}
      {post?.featured_image_url && !isLoading && (
        <div className="relative h-72 md:h-96 overflow-hidden">
          <img
            src={post.featured_image_url}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        </div>
      )}

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Link to="/blog">
            <Button variant="ghost" className="mb-6 -ml-2 gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Button>
          </Link>

          {isLoading ? (
            <div className="animate-pulse space-y-6">
              <div className="h-10 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="space-y-3 pt-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`h-4 bg-muted rounded ${i % 5 === 4 ? "w-4/5" : "w-full"}`} />
                ))}
              </div>
            </div>
          ) : post ? (
            <article>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                {post.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap gap-4 mb-8 pb-6 border-b text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(post.created_at), "MMMM dd, yyyy")}
                </span>
                {post.author?.full_name && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {post.author.full_name}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {readingTime(post.content)}
                </span>
              </div>

              {/* Excerpt / intro highlight */}
              {post.excerpt && (
                <p className="text-lg text-muted-foreground leading-relaxed mb-8 pl-4 border-l-4 border-primary italic">
                  {post.excerpt}
                </p>
              )}

              {/* Content */}
              <div
                className="prose prose-neutral dark:prose-invert max-w-none
                  prose-headings:font-bold prose-headings:tracking-tight
                  prose-p:leading-relaxed prose-p:text-foreground/90
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-img:rounded-xl prose-img:shadow-md
                  prose-blockquote:border-primary prose-blockquote:text-muted-foreground
                  prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5
                  prose-strong:text-foreground"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
              />

              {/* Footer nav */}
              <div className="mt-12 pt-8 border-t">
                <Link to="/blog">
                  <Button variant="outline" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    All Articles
                  </Button>
                </Link>
              </div>

              {/* Related Posts — internal linking for SEO */}
              {relatedPosts && relatedPosts.length > 0 && (
                <section className="mt-16 pt-10 border-t" aria-labelledby="related-heading">
                  <h2 id="related-heading" className="text-2xl font-bold mb-6">Continue Reading</h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {relatedPosts.map((rp: any) => (
                      <Link key={rp.id} to={`/blog/${rp.slug}`} className="group block rounded-xl border bg-card hover:shadow-lg transition-all overflow-hidden">
                        {rp.featured_image_url && (
                          <div className="h-36 overflow-hidden">
                            <img
                              src={rp.featured_image_url}
                              alt={rp.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors mb-1">
                            {rp.title}
                          </h3>
                          {rp.excerpt && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{rp.excerpt}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </article>
          ) : (
            <div className="text-center py-24">
              <p className="text-muted-foreground text-lg mb-4">Blog post not found.</p>
              <Link to="/blog">
                <Button variant="premium">Browse Blog</Button>
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPost;
