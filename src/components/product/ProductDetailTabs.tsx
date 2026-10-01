import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ProductQA } from "@/components/product/ProductQA";
import { Package, FileText, Star, HelpCircle, MessageCircleQuestion } from "lucide-react";

interface ProductDetailTabsProps {
  productId: string;
  description: string | null;
  category: string | null;
}

export function ProductDetailTabs({ productId, description, category }: ProductDetailTabsProps) {
  return (
    <div className="mt-16 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
      <Tabs defaultValue="description" className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="description" className="rounded-lg gap-2 py-2.5 px-4 text-sm">
            <FileText className="h-4 w-4" />
            Description
          </TabsTrigger>
          <TabsTrigger value="specifications" className="rounded-lg gap-2 py-2.5 px-4 text-sm">
            <Package className="h-4 w-4" />
            Specifications
          </TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-lg gap-2 py-2.5 px-4 text-sm">
            <Star className="h-4 w-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="qa" className="rounded-lg gap-2 py-2.5 px-4 text-sm">
            <MessageCircleQuestion className="h-4 w-4" />
            Q&amp;A
          </TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg gap-2 py-2.5 px-4 text-sm">
            <HelpCircle className="h-4 w-4" />
            FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qa" className="mt-6">
          <ProductQA productId={productId} />
        </TabsContent>

        <TabsContent value="description" className="mt-6">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            {description ? (
              <div
                className="leading-relaxed space-y-2"
                dangerouslySetInnerHTML={{
                  __html: description
                    .replace(/### (.+)/g, '<h3 class="text-base font-semibold mt-4 mb-1 text-foreground">$1</h3>')
                    .replace(/## (.+)/g, '<h2 class="text-lg font-bold mt-5 mb-2 text-foreground">$1</h2>')
                    .replace(/\*\*(.+?)\*\*/g, "<strong class='text-foreground'>$1</strong>")
                    .replace(/\*(.+?)\*/g, "<em>$1</em>")
                    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>')
                    .replace(/^---$/gm, '<hr class="my-4 border-border" />')
                    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
                    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
                    .replace(/\n/g, "<br />"),
                }}
              />
            ) : (
              <p className="text-muted-foreground italic">No detailed description available for this product.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="specifications" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {[
              { label: "Category", value: category || "General" },
              { label: "Brand", value: "ShopHub" },
              { label: "Material", value: "Premium Quality" },
              { label: "Weight", value: "Varies by product" },
              { label: "Warranty", value: "1 Year Manufacturer Warranty" },
              { label: "Country of Origin", value: "India" },
              { label: "Return Policy", value: "7 Days Easy Return" },
              { label: "Package Includes", value: "1 Unit + Accessories" },
              { label: "Care Instructions", value: "Refer to product label" },
              { label: "Certification", value: "ISI / BIS Certified" },
            ].map((spec, i) => (
              <div
                key={spec.label}
                className={`flex items-center justify-between py-3 px-4 rounded-lg ${i % 2 === 0 ? "bg-muted/30" : ""}`}
              >
                <span className="text-sm text-muted-foreground">{spec.label}</span>
                <span className="text-sm font-medium text-foreground">{spec.value}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <ProductReviews productId={productId} />
        </TabsContent>

        <TabsContent value="faq" className="mt-6">
          <div className="space-y-4">
            {[
              { q: "Is this product genuine?", a: "Yes, all products on ShopHub are 100% genuine and sourced directly from authorized distributors." },
              { q: "What is the return policy?", a: "We offer a 7-day easy return policy. If you're not satisfied, you can return the product in its original condition." },
              { q: "How long does delivery take?", a: "Standard delivery takes 3-7 business days depending on your location. Express delivery is available in select cities." },
              { q: "Is Cash on Delivery available?", a: "Yes, COD is available for orders up to ₹10,000 in most serviceable areas." },
            ].map((item) => (
              <div key={item.q} className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm font-semibold text-foreground mb-1">{item.q}</p>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
