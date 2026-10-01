import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Terms & Conditions | ShopHub"
        description="Read ShopHub's terms and conditions covering orders, payments, shipping, returns and user responsibilities."
        canonical="/terms"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "What payment methods does ShopHub accept?", acceptedAnswer: { "@type": "Answer", text: "ShopHub accepts UPI, credit/debit cards, net banking, wallets, and Cash on Delivery (COD)." } },
            { "@type": "Question", name: "What is ShopHub's shipping policy?", acceptedAnswer: { "@type": "Answer", text: "We deliver within the estimated timeframe at checkout. Shipping charges are displayed before payment." } },
            { "@type": "Question", name: "How do I create an account on ShopHub?", acceptedAnswer: { "@type": "Answer", text: "You can sign up using your email address. You must be at least 18 years old to use our services." } },
          ],
        }}
      />
      <Navbar />
      <div className="container px-4 py-12 max-w-3xl prose prose-sm dark:prose-invert">
        <h1>Terms & Conditions</h1>
        <p className="text-muted-foreground">Last updated: March 2, 2026</p>

        <h2>1. Introduction</h2>
        <p>Welcome to ShopHub. By accessing or using our website and services, you agree to be bound by these Terms & Conditions. Please read them carefully before making any purchase.</p>

        <h2>2. Eligibility</h2>
        <p>You must be at least 18 years of age to use this website. By using our services, you represent that you meet this requirement.</p>

        <h2>3. Products & Pricing</h2>
        <p>All products listed on our website are subject to availability. Prices are displayed in Indian Rupees (INR) and include applicable taxes unless stated otherwise. We reserve the right to modify prices at any time without prior notice.</p>

        <h2>4. Orders & Payment</h2>
        <p>Once you place an order, you will receive a confirmation. We accept payments via UPI, credit/debit cards, net banking, wallets, and Cash on Delivery (COD). All online payments are processed securely through our payment gateway partner.</p>

        <h2>5. Shipping & Delivery</h2>
        <p>We aim to deliver products within the estimated timeframe mentioned during checkout. Delivery times may vary based on location and product availability. Shipping charges, if any, will be displayed at checkout.</p>

        <h2>6. User Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.</p>

        <h2>7. Intellectual Property</h2>
        <p>All content on this website, including text, images, logos, and designs, is the property of ShopHub and is protected by intellectual property laws.</p>

        <h2>8. Limitation of Liability</h2>
        <p>ShopHub shall not be liable for any indirect, incidental, or consequential damages arising from the use of our website or products.</p>

        <h2>9. Governing Law</h2>
        <p>These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Mumbai, Maharashtra.</p>

        <h2>10. Contact</h2>
        <p>For questions about these terms, please contact us at <strong>ShopsHub@gmail.com</strong>.</p>
      </div>
    </div>
  );
}
