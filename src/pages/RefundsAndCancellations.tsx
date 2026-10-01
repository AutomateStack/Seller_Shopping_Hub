import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";

export default function RefundsAndCancellations() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Refunds & Cancellations Policy | ShopHub"
        description="Learn about ShopHub's refund and cancellation policies. Easy returns within 7 days, quick refund processing."
        canonical="/refunds"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Can I cancel my order?", acceptedAnswer: { "@type": "Answer", text: "Yes, you can cancel before it ships. Contact ShopsHub@gmail.com with your order ID." } },
            { "@type": "Question", name: "What is ShopHub's return policy?", acceptedAnswer: { "@type": "Answer", text: "We accept returns within 7 days of delivery if the product is unused and in original packaging." } },
            { "@type": "Question", name: "How long do refunds take?", acceptedAnswer: { "@type": "Answer", text: "Approved refunds are processed within 5-7 business days to your original payment method." } },
            { "@type": "Question", name: "What items are non-refundable?", acceptedAnswer: { "@type": "Answer", text: "Used/damaged products, gift cards, downloadable products, and items marked non-returnable." } },
          ],
        }}
      />
      <Navbar />
      <div className="container px-4 py-12 max-w-3xl prose prose-sm dark:prose-invert">
        <h1>Refunds & Cancellations</h1>
        <p className="text-muted-foreground">Last updated: March 2, 2026</p>

        <h2>1. Cancellation Policy</h2>
        <p>You may cancel your order before it has been shipped. Once an order is shipped, it cannot be cancelled. To request a cancellation, please contact our support team at <strong>ShopsHub@gmail.com</strong> with your order ID.</p>

        <h2>2. Return Policy</h2>
        <p>We accept returns within <strong>7 days</strong> of delivery, provided the product is unused, in its original packaging, and in the same condition as received. Certain categories such as perishable goods, personal care items, and customized products are non-returnable.</p>

        <h2>3. Refund Process</h2>
        <ul>
          <li>Once we receive and inspect the returned product, we will notify you of the approval or rejection of your refund.</li>
          <li>Approved refunds will be processed within <strong>5–7 business days</strong> to your original payment method.</li>
          <li>For COD orders, refunds will be initiated via bank transfer. You will be asked to provide your bank details.</li>
        </ul>

        <h2>4. Non-Refundable Items</h2>
        <ul>
          <li>Products that have been used, damaged, or altered after delivery</li>
          <li>Gift cards and downloadable products</li>
          <li>Items marked as "non-returnable" on the product page</li>
        </ul>

        <h2>5. Damaged or Defective Products</h2>
        <p>If you receive a damaged or defective product, please contact us within <strong>48 hours</strong> of delivery with photos of the product. We will arrange a free replacement or full refund.</p>

        <h2>6. Late or Missing Refunds</h2>
        <p>If you haven't received your refund within the stated timeframe, please check with your bank first. If the issue persists, contact us at <strong>ShopsHub@gmail.com</strong>.</p>

        <h2>7. Contact Us</h2>
        <p>For any refund or cancellation queries, email us at <strong>ShopsHub@gmail.com</strong>.</p>
      </div>
    </div>
  );
}
