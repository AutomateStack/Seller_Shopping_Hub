import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";

export default function ShippingPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Shipping & Delivery Policy | ShopHub"
        description="ShopHub shipping and delivery policy: order processing times, delivery timelines, shipping charges and tracking."
        canonical="/shipping"
      />
      <Navbar />
      <div className="container px-4 py-12 max-w-3xl prose prose-sm dark:prose-invert">
        <h1>Shipping & Delivery Policy</h1>
        <p className="text-muted-foreground">Last updated: July 5, 2026</p>

        <h2>1. Order Processing</h2>
        <p>Orders are processed within <strong>1–2 business days</strong> after payment confirmation. Orders placed on Sundays or public holidays are processed on the next working day.</p>

        <h2>2. Delivery Timelines</h2>
        <ul>
          <li><strong>Metro cities:</strong> 3–5 business days</li>
          <li><strong>Tier 2 & Tier 3 cities:</strong> 5–7 business days</li>
          <li><strong>Remote/Northeast locations:</strong> 7–10 business days</li>
        </ul>
        <p>Estimated delivery dates are shown at checkout. Timelines may vary due to weather, courier delays or unforeseen circumstances.</p>

        <h2>3. Shipping Charges</h2>
        <p>Shipping charges (if applicable) are calculated based on order value, weight and destination, and are displayed clearly at checkout before payment. We offer <strong>free shipping</strong> on qualifying orders as indicated on product/checkout pages.</p>

        <h2>4. Order Tracking</h2>
        <p>Once your order is dispatched, you will receive a tracking number via email and SMS. You can also view real-time status under <strong>My Orders</strong> in your account.</p>

        <h2>5. Delivery Partners</h2>
        <p>We ship via reputed logistics partners including Delhivery, Blue Dart, DTDC, XpressBees, India Post and others based on the delivery pincode.</p>

        <h2>6. Serviceable Locations</h2>
        <p>We currently ship across India. International shipping is not available at this time. If your pincode is non-serviceable, this will be indicated at checkout.</p>

        <h2>7. Undelivered / Returned Shipments</h2>
        <p>If a shipment is returned to us due to an incorrect address, unavailability of the recipient or refusal to accept, re-shipping charges may apply. For prepaid orders, we will refund the order value less the applicable shipping charge.</p>

        <h2>8. Damaged or Missing Items</h2>
        <p>If your parcel arrives damaged or tampered with, please refuse delivery or record a video while opening the package and contact us within <strong>48 hours</strong>. See our <a href="/refunds">Refunds & Cancellations</a> policy for next steps.</p>

        <h2>9. Contact Us</h2>
        <p>For any shipping-related queries, contact:</p>
        <p>
          <strong>ShopHub</strong><br />
          Email: <strong>ShopsHub@gmail.com</strong><br />
          Address: Hyderabad, Telangana, India
        </p>
      </div>
    </div>
  );
}