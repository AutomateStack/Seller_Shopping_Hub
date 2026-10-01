import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";
import { Footer } from "@/components/home/Footer";

export default function ContestRules() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Contest Rules | ShopHub Lucky Draw" description="Rules and guidelines for ShopHub Lucky Draw promotional reward program." canonical="/lucky-draw/rules" />
      <Navbar />
      <div className="container px-4 py-12 max-w-3xl mx-auto prose prose-sm">
        <h1 className="text-3xl font-bold mb-6">Contest Rules</h1>

        <h2>1. Eligibility</h2>
        <p>Open to all registered ShopHub users aged 18 and above. Employees of ShopHub and their immediate family members are not eligible.</p>

        <h2>2. Entry Methods</h2>
        <ul>
          <li><strong>Free Entry:</strong> Every registered user receives 1 free entry per active draw. No purchase necessary.</li>
          <li><strong>Paid Entry:</strong> Additional entries may be purchased at ₹1 per entry from wallet balance.</li>
          <li><strong>Referral Entry:</strong> Users earn 1 bonus entry for each successful referral (new user who registers using their referral link).</li>
          <li><strong>Milestone Bonuses:</strong> Additional bonus entries at referral milestones (5, 10, 25 referrals).</li>
        </ul>

        <h2>3. Draw Process</h2>
        <p>Winners are selected using a cryptographically verifiable random algorithm. Each draw generates a unique seed and hash for transparency. The draw process is deterministic once the seed is generated — the same seed will always produce the same result.</p>

        <h2>4. Prizes</h2>
        <p>Prize amounts and positions are displayed on each draw card before entry. Prizes are credited to winners' ShopHub wallets immediately upon draw completion. Winners can withdraw via UPI.</p>

        <h2>5. No Guarantee of Winning</h2>
        <p>This is a promotional reward program. Participation does not guarantee any prize. The probability of winning depends on the total number of entries.</p>

        <h2>6. Anti-Fraud</h2>
        <p>ShopHub reserves the right to disqualify entries suspected of fraud, including but not limited to: multiple accounts, bot entries, or coordinated manipulation. Users may be asked to verify their identity.</p>

        <h2>7. Withdrawals</h2>
        <p>Minimum withdrawal amount is ₹10. Withdrawals are processed within 3-5 business days. ShopHub reserves the right to request identity verification before processing large withdrawals.</p>

        <h2>8. Modifications</h2>
        <p>ShopHub reserves the right to modify, suspend, or cancel any draw at its discretion. In case of cancellation, all paid entries will be refunded to user wallets.</p>

        <h2>9. Governing Law</h2>
        <p>These rules are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in the relevant jurisdiction.</p>
      </div>
      <Footer />
    </div>
  );
}
