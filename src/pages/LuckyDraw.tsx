import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";
import { Footer } from "@/components/home/Footer";
import { LuckyDrawHero } from "@/components/luckydraw/LuckyDrawHero";
import { ActiveDraws } from "@/components/luckydraw/ActiveDraws";
import { RecentWinners } from "@/components/luckydraw/RecentWinners";
import { HowItWorks } from "@/components/luckydraw/HowItWorks";
import { LegalDisclaimer } from "@/components/luckydraw/LegalDisclaimer";
import { ReferralSection } from "@/components/luckydraw/ReferralSection";
import { LuckyDrawStats } from "@/components/luckydraw/LuckyDrawStats";
import { ProvablyFair } from "@/components/luckydraw/ProvablyFair";
import { MyEntriesPanel } from "@/components/luckydraw/MyEntriesPanel";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

export default function LuckyDraw() {
  const [user, setUser] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");

  // Store referral code for signup
  useEffect(() => {
    if (refCode) {
      sessionStorage.setItem("shophub_ref", refCode);
    }
  }, [refCode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background" id="main-content" role="main">
      <SEOHead
        title="Weekly Lucky Draw — Win up to ₹5,000 | ShopHub"
        description="Join ShopHub's Weekly Lucky Draw. Free entry, refer friends for bonus entries, and win real cash prizes. Provably fair draws with instant wallet payout."
        canonical="/lucky-draw"
        image="https://shopshub.lovable.app/lucky-draw-og.jpg"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: "ShopHub Weekly Lucky Draw",
          description:
            "Weekly promotional lucky draw with free entry, referral bonuses and instant wallet payout. Provably fair with public seed and hash.",
          eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
          eventStatus: "https://schema.org/EventScheduled",
          isAccessibleForFree: true,
          url: "https://shopshub.lovable.app/lucky-draw",
          organizer: {
            "@type": "Organization",
            name: "ShopHub",
            url: "https://shopshub.lovable.app",
          },
          location: {
            "@type": "VirtualLocation",
            url: "https://shopshub.lovable.app/lucky-draw",
          },
        }}
      />
      <Navbar />
      <LuckyDrawHero user={user} />
      <LuckyDrawStats />
      {user && <MyEntriesPanel user={user} />}
      <HowItWorks />
      <ActiveDraws user={user} />
      {user && <ReferralSection userId={user.id} />}
      <RecentWinners />
      <ProvablyFair />
      <LegalDisclaimer />
      <Footer />
    </div>
  );
}
