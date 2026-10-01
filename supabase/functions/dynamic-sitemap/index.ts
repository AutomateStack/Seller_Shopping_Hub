import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/xml",
  "Cache-Control": "public, max-age=3600",
};

const BASE_URL = "https://shopshub.lovable.app";

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  // Fetch products, blog posts, and categories in parallel
  const [productsRes, blogsRes, categoriesRes] = await Promise.all([
    supabase.from("products").select("id, name, image_url, updated_at"),
    supabase.from("blog_posts").select("slug, updated_at").eq("published", true),
    supabase.from("categories").select("slug, updated_at"),
  ]);

  const products = productsRes.data || [];
  const blogs = blogsRes.data || [];
  const categories = categoriesRes.data || [];

  const staticPages = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/products", changefreq: "daily", priority: "0.9" },
    { loc: "/blog", changefreq: "weekly", priority: "0.7" },
    { loc: "/lucky-draw", changefreq: "weekly", priority: "0.7" },
    { loc: "/quiz", changefreq: "weekly", priority: "0.6" },
    { loc: "/contest-rules", changefreq: "monthly", priority: "0.4" },
    { loc: "/contact", changefreq: "monthly", priority: "0.5" },
    { loc: "/terms", changefreq: "monthly", priority: "0.3" },
    { loc: "/refunds", changefreq: "monthly", priority: "0.3" },
  ];

  const urls = staticPages.map(
    (p) => `  <url>
    <loc>${BASE_URL}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  );

  for (const cat of categories) {
    const lastmod = cat.updated_at ? `\n    <lastmod>${new Date(cat.updated_at).toISOString().split("T")[0]}</lastmod>` : "";
    urls.push(`  <url>
    <loc>${BASE_URL}/products?category=${encodeURIComponent(cat.slug)}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    urls.push(`  <url>
    <loc>${BASE_URL}/shop/${encodeURIComponent(cat.slug)}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  for (const product of products) {
    const lastmod = product.updated_at ? `\n    <lastmod>${new Date(product.updated_at).toISOString().split("T")[0]}</lastmod>` : "";
    const imageEntry = product.image_url
      ? `\n    <image:image>\n      <image:loc>${escapeXml(product.image_url)}</image:loc>\n      <image:title>${escapeXml(product.name || "")}</image:title>\n    </image:image>`
      : "";
    urls.push(`  <url>
    <loc>${BASE_URL}/products/${product.id}</loc>${lastmod}${imageEntry}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  for (const blog of blogs) {
    const lastmod = blog.updated_at ? `\n    <lastmod>${new Date(blog.updated_at).toISOString().split("T")[0]}</lastmod>` : "";
    urls.push(`  <url>
    <loc>${BASE_URL}/blog/${blog.slug}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, { headers: corsHeaders });
});
