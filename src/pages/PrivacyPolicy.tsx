import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Privacy Policy | ShopHub"
        description="Read ShopHub's privacy policy on how we collect, use, store and protect your personal information."
        canonical="/privacy"
      />
      <Navbar />
      <div className="container px-4 py-12 max-w-3xl prose prose-sm dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: July 5, 2026</p>

        <h2>1. Introduction</h2>
        <p>ShopHub ("we", "our", "us") respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, disclose and safeguard your information when you visit our website or make a purchase.</p>

        <h2>2. Information We Collect</h2>
        <ul>
          <li><strong>Personal details</strong> — name, email address, phone number, shipping and billing address.</li>
          <li><strong>Payment information</strong> — processed securely by our PCI-DSS compliant payment gateway partner. We do not store card numbers or CVV on our servers.</li>
          <li><strong>Order & account data</strong> — order history, wishlist, cart items, reviews and preferences.</li>
          <li><strong>Technical data</strong> — IP address, browser type, device information, and cookies.</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To process and deliver your orders</li>
          <li>To send order updates, invoices and customer support communications</li>
          <li>To personalise your shopping experience and recommend relevant products</li>
          <li>To send marketing emails (only with your consent; you can unsubscribe anytime)</li>
          <li>To prevent fraud, comply with legal obligations and improve our services</li>
        </ul>

        <h2>4. Sharing of Information</h2>
        <p>We do not sell your personal data. We share information only with:</p>
        <ul>
          <li>Payment gateway partners to process transactions</li>
          <li>Logistics and courier partners to deliver your orders</li>
          <li>Service providers who help us operate our website (email, analytics, hosting)</li>
          <li>Government or law-enforcement authorities when required by law</li>
        </ul>

        <h2>5. Cookies</h2>
        <p>We use cookies and similar technologies to remember your preferences, keep you signed in, and analyse site traffic. You can control cookies through your browser settings.</p>

        <h2>6. Data Security</h2>
        <p>We use industry-standard measures including HTTPS/TLS encryption, secure authentication and access controls to protect your data. However, no method of transmission over the Internet is 100% secure.</p>

        <h2>7. Data Retention</h2>
        <p>We retain your personal data only as long as necessary to fulfil the purposes described in this policy or as required by law (for example, tax and accounting records).</p>

        <h2>8. Your Rights</h2>
        <p>You have the right to access, correct, update or request deletion of your personal information. To exercise these rights, email us at <strong>ShopsHub@gmail.com</strong>.</p>

        <h2>9. Children's Privacy</h2>
        <p>Our services are not intended for children under 18. We do not knowingly collect personal information from children.</p>

        <h2>10. Changes to this Policy</h2>
        <p>We may update this Privacy Policy from time to time. The latest version will always be available on this page with the updated date.</p>

        <h2>11. Contact Us</h2>
        <p>For any privacy-related queries, contact us at:</p>
        <p>
          <strong>ShopHub</strong><br />
          Email: <strong>ShopsHub@gmail.com</strong><br />
          Address: Hyderabad, Telangana, India
        </p>
      </div>
    </div>
  );
}